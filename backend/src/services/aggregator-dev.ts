// Dev version of aggregator — uses plain lat/lng columns (no PostGIS)
import { fetchWazeData, normalizeWazeAlert } from './wazeService'
import { fetchTrafficIncidents } from './trafficService'
import { db } from '../db'

interface BBox { north: number; south: number; east: number; west: number }

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
}

export async function fetchEvents(bbox: BBox): Promise<AggregatedEvent[]> {
  const [wazeData, trafficData, userReports] = await Promise.allSettled([
    fetchWazeData(bbox),
    fetchTrafficIncidents(bbox),
    fetchUserReports(bbox),
  ])

  const events: AggregatedEvent[] = []

  if (wazeData.status === 'fulfilled') {
    const { alerts, jams } = wazeData.value
    alerts.forEach(a => events.push(normalizeWazeAlert(a)))
    jams.forEach(jam => {
      const mid = jam.line[Math.floor(jam.line.length / 2)]
      events.push({
        id: `waze-jam-${jam.uuid}`,
        type: 'traffic',
        position: { lat: mid.y, lng: mid.x },
        title: `Heavy traffic${jam.street ? ` on ${jam.street}` : ''}`,
        description: `${jam.speedKMH.toFixed(0)} km/h`,
        severity: Math.min(5, jam.level) as 1 | 2 | 3 | 4 | 5,
        confidence: 85,
        votes: 0,
        source: 'waze',
        reportedAt: new Date().toISOString(),
      })
    })
  }

  if (trafficData.status === 'fulfilled') {
    trafficData.value.forEach(inc => {
      events.push({ ...inc, confidence: 90, votes: 0, source: 'traffic_api', reportedAt: new Date().toISOString() })
    })
  }

  if (userReports.status === 'fulfilled') {
    events.push(...userReports.value)
  }

  return deduplicateEvents(events)
}

async function fetchUserReports(bbox: BBox): Promise<AggregatedEvent[]> {
  try {
    const { rows } = await db.query(`
      SELECT id, type, lat, lng, upvotes, downvotes, confirmed, created_at, expires_at
      FROM user_reports
      WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        AND expires_at > NOW()
        AND (upvotes - downvotes) >= -2
      ORDER BY created_at DESC
      LIMIT 200
    `, [bbox.south, bbox.north, bbox.west, bbox.east])

    return rows.map((r: Record<string, unknown>) => ({
      id: `report-${r.id}`,
      type: r.type as string,
      position: { lat: r.lat as number, lng: r.lng as number },
      title: `${r.type} reported nearby`,
      severity: (r.confirmed ? 3 : 2) as 1 | 2 | 3 | 4 | 5,
      confidence: r.confirmed ? 80 : Math.max(30, 50 + ((r.upvotes as number) - (r.downvotes as number)) * 5),
      votes: r.upvotes as number,
      source: 'user_report',
      reportedAt: r.created_at as string,
      expiresAt: r.expires_at as string,
    }))
  } catch {
    return []
  }
}

function deduplicateEvents(events: AggregatedEvent[]): AggregatedEvent[] {
  const seen = new Map<string, AggregatedEvent>()
  for (const e of events) {
    const key = `${e.type}:${Math.round(e.position.lat * 100)},${Math.round(e.position.lng * 100)}`
    if (!seen.has(key) || e.confidence > seen.get(key)!.confidence) seen.set(key, e)
  }
  return Array.from(seen.values())
}
