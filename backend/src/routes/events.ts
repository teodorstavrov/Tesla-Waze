import { Router, Request, Response } from 'express'
import { fetchEvents } from '../services/aggregator-dev'

const router = Router()

// GET /api/events?north=&south=&east=&west=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { north, south, east, west } = req.query as Record<string, string>

    if (!north || !south || !east || !west) {
      return res.status(400).json({ error: 'Missing bbox parameters' })
    }

    const bbox = {
      north: parseFloat(north),
      south: parseFloat(south),
      east:  parseFloat(east),
      west:  parseFloat(west),
    }

    if (Object.values(bbox).some(isNaN)) {
      return res.status(400).json({ error: 'Invalid bbox parameters' })
    }

    const events = await fetchEvents(bbox)

    return res.json({
      events,
      total: events.length,
      bbox,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Events] GET error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/events/route — events along a polyline
router.post('/route', async (req: Request, res: Response) => {
  try {
    const { polyline, bufferMeters = 200 } = req.body as {
      polyline: Array<{ lat: number; lng: number }>
      bufferMeters?: number
    }

    if (!Array.isArray(polyline) || polyline.length < 2) {
      return res.status(400).json({ error: 'Invalid polyline' })
    }

    // Compute bounding box
    const lats = polyline.map(p => p.lat)
    const lngs = polyline.map(p => p.lng)
    const buf = bufferMeters / 111000

    const bbox = {
      north: Math.max(...lats) + buf,
      south: Math.min(...lats) - buf,
      east:  Math.max(...lngs) + buf,
      west:  Math.min(...lngs) - buf,
    }

    const allEvents = await fetchEvents(bbox)

    // Filter to events within buffer of the route
    const routeEvents = allEvents.filter(event => {
      return isWithinBuffer(event.position, polyline, bufferMeters)
    })

    return res.json({ events: routeEvents, total: routeEvents.length })
  } catch (err) {
    console.error('[Events] Route error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

function isWithinBuffer(
  point: { lat: number; lng: number },
  polyline: Array<{ lat: number; lng: number }>,
  bufferMeters: number
): boolean {
  const R = 6371000
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistance(point, polyline[i], polyline[i + 1], R)
    if (dist < bufferMeters) return true
  }
  return false
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }, R: number): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function pointToSegmentDistance(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  R: number
): number {
  const d1 = haversine(p, a, R)
  const d2 = haversine(p, b, R)
  const d3 = haversine(a, b, R)
  if (d3 === 0) return d1
  const t = Math.max(0, Math.min(1, ((d1 ** 2 + d3 ** 2 - d2 ** 2) / (2 * d1 * d3))))
  return Math.sqrt(Math.max(0, d1 ** 2 - (t * d1) ** 2))
}

export default router
