import axios from 'axios'
import { TrafficEvent, EVStation, Route, RouteMode, BoundingBox, LatLng, UserReport } from '../types'

const client = axios.create({
  baseURL: '/api',
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' }
})

// ─── Events ─────────────────────────────────────────────────────────────────
export const fetchEvents = async (bbox: BoundingBox): Promise<TrafficEvent[]> => {
  const { data } = await client.get('/events', {
    params: { north: bbox.north, south: bbox.south, east: bbox.east, west: bbox.west }
  })
  return data.events ?? []
}

export const fetchWazeAlerts = async (bbox: BoundingBox): Promise<TrafficEvent[]> => {
  const { data } = await client.get('/waze', {
    params: { north: bbox.north, south: bbox.south, east: bbox.east, west: bbox.west }
  })
  return data.events ?? []
}

export const fetchEventsAlongRoute = async (polyline: LatLng[]): Promise<TrafficEvent[]> => {
  const { data } = await client.post('/events/route', { polyline, bufferMeters: 200 })
  return data.events ?? []
}

// ─── EV Stations ─────────────────────────────────────────────────────────────
export const fetchEVStations = async (bbox: BoundingBox): Promise<EVStation[]> => {
  const { data } = await client.get('/ev/stations', {
    params: { north: bbox.north, south: bbox.south, east: bbox.east, west: bbox.west }
  })
  return data.stations ?? []
}

export const fetchEVStation = async (id: string): Promise<EVStation> => {
  const { data } = await client.get(`/ev/stations/${id}`)
  return data.station
}

// ─── Routes ──────────────────────────────────────────────────────────────────
export const calculateRoutes = async (
  origin: LatLng,
  destination: LatLng,
  modes?: RouteMode[]
): Promise<Route[]> => {
  const { data } = await client.post('/routes/calculate', {
    origin,
    destination,
    modes: modes ?? ['fastest', 'least_traffic', 'least_cameras', 'lowest_risk']
  })
  return data.routes ?? []
}

export const geocodeAddress = async (query: string, near?: LatLng): Promise<Array<{ label: string; position: LatLng }>> => {
  const { data } = await client.get('/routes/geocode', { params: { q: query, ...near } })
  return data.results ?? []
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export const submitReport = async (
  type: UserReport['type'],
  position: LatLng
): Promise<UserReport> => {
  const { data } = await client.post('/reports', { type, position })
  return data.report
}

export const fetchReports = async (bbox: BoundingBox): Promise<TrafficEvent[]> => {
  const { data } = await client.get('/reports', {
    params: { north: bbox.north, south: bbox.south, east: bbox.east, west: bbox.west }
  })
  const LABELS: Record<string, string> = {
    police: 'Police (reported)', speed_camera: 'Speed camera (reported)',
    accident: 'Accident (reported)', hazard: 'Hazard (reported)'
  }
  return (data.reports ?? []).map((r: UserReport & { lat: number; lng: number; expiresAt: string }) => ({
    id: `report-${r.id}`,
    type: r.type as TrafficEvent['type'],
    position: { lat: r.lat, lng: r.lng },
    title: LABELS[r.type] ?? r.type,
    severity: 3 as const,
    confidence: 70,
    votes: r.upvotes ?? 1,
    source: 'user_report' as const,
    reportedAt: r.createdAt,
    expiresAt: r.expiresAt,
  }))
}

export const voteReport = async (id: string, vote: 'up' | 'down'): Promise<void> => {
  await client.post(`/reports/${id}/vote`, { vote })
}

// ─── Risk Zones ───────────────────────────────────────────────────────────────
export const fetchRiskZones = async (bbox: BoundingBox) => {
  const { data } = await client.get('/risk/zones', {
    params: { north: bbox.north, south: bbox.south, east: bbox.east, west: bbox.west }
  })
  return data.zones ?? []
}

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthCheck = async (): Promise<boolean> => {
  try {
    await client.get('/health', { timeout: 3000 })
    return true
  } catch {
    return false
  }
}
