import axios from 'axios'
import { cacheGetOrSet } from '../cache/redis'
import { fetchEvents } from './aggregator-dev'
import crypto from 'crypto'

interface LatLng { lat: number; lng: number }

interface RouteResult {
  id: string
  mode: string
  polyline: LatLng[]
  distanceMeters: number
  durationSeconds: number
  color: string
  summary: {
    policeCount: number
    cameraCount: number
    accidentCount: number
    hazardCount: number
    constructionCount: number
    nextPoliceDistance?: number
    nextCameraDistance?: number
    trafficLevel: string
    riskScore: number
  }
}

const ROUTE_COLORS = {
  fastest:       '#3B82F6',
  least_traffic: '#8B5CF6',
  least_cameras: '#F59E0B',
  lowest_risk:   '#22C55E',
}

export async function calculateRoutes(
  origin: LatLng,
  destination: LatLng,
  modes: string[]
): Promise<RouteResult[]> {
  const routes = await Promise.allSettled(
    modes.map(mode => calculateRoute(origin, destination, mode))
  )

  return routes
    .filter((r): r is PromiseFulfilledResult<RouteResult> => r.status === 'fulfilled')
    .map(r => r.value)
}

async function calculateRoute(
  origin: LatLng,
  destination: LatLng,
  mode: string
): Promise<RouteResult> {
  const hash = (p: LatLng) => crypto.createHash('md5').update(`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).digest('hex').slice(0, 12)
  const cacheKey = `route:${hash(origin)}:${hash(destination)}:${mode}`

  return cacheGetOrSet<RouteResult>(
    cacheKey,
    async () => {
      const osrmMode = mode === 'fastest' ? 'driving' : 'driving'
      const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`

      const { data } = await axios.get(url, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: false,
          alternatives: false,
        },
        timeout: 8000
      })

      const route = data.routes[0]
      const polyline: LatLng[] = route.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }))

      // Compute bbox around route
      const lats = polyline.map(p => p.lat)
      const lngs = polyline.map(p => p.lng)
      const bbox = {
        north: Math.max(...lats) + 0.005,
        south: Math.min(...lats) - 0.005,
        east:  Math.max(...lngs) + 0.005,
        west:  Math.min(...lngs) - 0.005,
      }

      // Get events along route
      const events = await fetchEvents(bbox)
      const routeEvents = events.filter(e => isNearPolyline(e.position, polyline, 300))

      const summary = computeSummary(routeEvents, polyline)

      return {
        id: `${mode}-${hash(origin)}-${hash(destination)}`,
        mode,
        polyline,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        color: ROUTE_COLORS[mode as keyof typeof ROUTE_COLORS] ?? '#6b7280',
        summary,
      }
    },
    300 // 5 min cache
  )
}

function isNearPolyline(point: LatLng, polyline: LatLng[], bufferMeters: number): boolean {
  for (const p of polyline) {
    if (haversine(point, p) < bufferMeters) return true
  }
  return false
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function computeSummary(events: Array<{ type: string; position: LatLng }>, polyline: LatLng[]) {
  const counts = { police: 0, speed_camera: 0, accident: 0, hazard: 0, construction: 0 }
  events.forEach(e => {
    if (e.type in counts) counts[e.type as keyof typeof counts]++
  })

  const riskScore = Math.min(100,
    counts.police * 15 +
    counts.speed_camera * 8 +
    counts.accident * 12 +
    counts.hazard * 5 +
    counts.construction * 4
  )

  return {
    policeCount: counts.police,
    cameraCount: counts.speed_camera,
    accidentCount: counts.accident,
    hazardCount: counts.hazard,
    constructionCount: counts.construction,
    trafficLevel: 'light' as const,
    riskScore,
  }
}

export async function geocodeAddress(
  query: string,
  near?: LatLng
): Promise<Array<{ label: string; position: LatLng }>> {
  const key = `geocode:${query.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`

  return cacheGetOrSet(key, async () => {
    try {
      const params: Record<string, string | number> = {
        q: query,
        format: 'json',
        limit: 5,
        addressdetails: 0,
      }
      if (near) {
        params.viewbox = `${near.lng - 1},${near.lat - 1},${near.lng + 1},${near.lat + 1}`
        params.bounded = 0
      }

      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params,
        headers: { 'User-Agent': 'TeslaIntelligence/1.0' },
        timeout: 5000
      })

      return (data ?? []).map((r: Record<string, string>) => ({
        label: r.display_name,
        position: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }
      }))
    } catch {
      return []
    }
  }, 300)
}
