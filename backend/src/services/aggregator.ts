import { fetchWazeData, normalizeWazeAlert } from './wazeService'
import { fetchTrafficIncidents } from './trafficService'
import { db } from '../db'
import { v4 as uuidv4 } from 'uuid'

interface BBox {
  north: number; south: number; east: number; west: number
}

export interface AggregatedEvent {
  id: string
  type: string
  position: { lat: number; lng: number }
  title: string
  description?: string
  severity: number
  confidence: number
  votes: number
  source: string
  reportedAt: string
  expiresAt?: string
  speed?: number
  direction?: number
}

export async function fetchEvents(bbox: BBox): Promise<AggregatedEvent[]> {
  const [wazeData, trafficData, userReports] = await Promise.allSettled([
    fetchWazeData(bbox),
    fetchTrafficIncidents(bbox),
    fetchUserReports(bbox),
  ])

  const events: AggregatedEvent[] = []

  // Waze events
  if (wazeData.status === 'fulfilled') {
    const { alerts, jams } = wazeData.value
    alerts.forEach(alert => events.push(normalizeWazeAlert(alert)))

    // Normalize jams as traffic events
    jams.forEach(jam => {
      const midIdx = Math.floor(jam.line.length / 2)
      const mid = jam.line[midIdx]
      events.push({
        id: `waze-jam-${jam.uuid}`,
        type: 'traffic',
        position: { lat: mid.y, lng: mid.x },
        title: `Heavy traffic${jam.street ? ` on ${jam.street}` : ''}`,
        description: `${jam.speedKMH.toFixed(0)} km/h · ${(jam.length / 1000).toFixed(1)}km`,
        severity: (Math.min(5, jam.level) as 1 | 2 | 3 | 4 | 5),
        confidence: 85,
        votes: 0,
        source: 'waze',
        reportedAt: new Date().toISOString(),
      })
    })
  }

  // TomTom incidents
  if (trafficData.status === 'fulfilled') {
    trafficData.value.forEach(inc => {
      events.push({
        ...inc,
        confidence: 90,
        votes: 0,
        source: 'traffic_api',
        reportedAt: new Date().toISOString(),
      })
    })
  }

  // User reports from DB
  if (userReports.status === 'fulfilled') {
    events.push(...userReports.value)
  }

  // Deduplicate by proximity & type
  return deduplicateEvents(events)
}

async function fetchUserReports(bbox: BBox): Promise<AggregatedEvent[]> {
  try {
    const { rows } = await db.query<{
      id: string; type: string; lat: number; lng: number;
      upvotes: number; downvotes: number; confirmed: boolean;
      created_at: string; expires_at: string;
    }>(`
      SELECT
        r.id, r.type,
        ST_Y(r.position::geometry) AS lat,
        ST_X(r.position::geometry) AS lng,
        r.upvotes, r.downvotes, r.confirmed,
        r.created_at, r.expires_at
      FROM user_reports r
      WHERE
        r.position && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        AND r.expires_at > NOW()
        AND (r.upvotes - r.downvotes) >= -2
      ORDER BY r.created_at DESC
      LIMIT 200
    `, [bbox.west, bbox.south, bbox.east, bbox.north])

    return rows.map(row => ({
      id: `report-${row.id}`,
      type: row.type,
      position: { lat: row.lat, lng: row.lng },
      title: formatReportTitle(row.type),
      severity: (row.confirmed ? 3 : 2) as 1 | 2 | 3 | 4 | 5,
      confidence: row.confirmed ? 80 : Math.max(30, 50 + (row.upvotes - row.downvotes) * 5),
      votes: row.upvotes,
      source: 'user_report',
      reportedAt: row.created_at,
      expiresAt: row.expires_at,
    }))
  } catch {
    return []
  }
}

function formatReportTitle(type: string): string {
  const titles: Record<string, string> = {
    police: 'Police reported by user',
    accident: 'Accident reported by user',
    speed_camera: 'Speed camera reported by user',
    hazard: 'Hazard reported by user',
  }
  return titles[type] ?? 'Incident reported'
}

function deduplicateEvents(events: AggregatedEvent[]): AggregatedEvent[] {
  const seen = new Map<string, AggregatedEvent>()

  for (const event of events) {
    // Create grid key at ~100m resolution
    const gridKey = `${event.type}:${Math.round(event.position.lat * 100)},${Math.round(event.position.lng * 100)}`

    if (!seen.has(gridKey)) {
      seen.set(gridKey, event)
    } else {
      // Keep higher confidence event
      const existing = seen.get(gridKey)!
      if (event.confidence > existing.confidence) {
        seen.set(gridKey, event)
      }
    }
  }

  return Array.from(seen.values())
}
