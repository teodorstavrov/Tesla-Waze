// Direct browser-side Waze fetch
// Browser requests bypass server-side IP blocking — Waze allows CORS from browsers

import { BoundingBox, TrafficEvent } from '../types'

const WAZE_TYPE: Record<string, TrafficEvent['type']> = {
  POLICE: 'police', POLICE_HIDING: 'police', POLICE_VISIBLE: 'police',
  ACCIDENT: 'accident', ACCIDENT_MINOR: 'accident', ACCIDENT_MAJOR: 'accident',
  HAZARD: 'hazard', HAZARD_ON_ROAD: 'hazard', HAZARD_ON_SHOULDER: 'hazard',
  HAZARD_WEATHER: 'hazard', HAZARD_ON_ROAD_OBJECT: 'hazard',
  HAZARD_ON_ROAD_POT_HOLE: 'hazard', HAZARD_ON_ROAD_LANE_CLOSED: 'hazard',
  JAM: 'traffic', JAM_MODERATE_TRAFFIC: 'traffic', JAM_HEAVY_TRAFFIC: 'traffic',
  JAM_STAND_STILL_TRAFFIC: 'traffic', JAM_LIGHT_TRAFFIC: 'traffic',
  CONSTRUCTION: 'construction', ROAD_CLOSED: 'road_closure',
}

const WAZE_TITLE: Record<string, string> = {
  POLICE: 'Police', POLICE_HIDING: 'Police (hiding)', POLICE_VISIBLE: 'Police',
  ACCIDENT: 'Accident', ACCIDENT_MINOR: 'Minor accident', ACCIDENT_MAJOR: 'Major accident',
  HAZARD: 'Road hazard', HAZARD_WEATHER: 'Weather hazard', HAZARD_ON_ROAD: 'Road hazard',
  JAM: 'Traffic jam', JAM_HEAVY_TRAFFIC: 'Heavy traffic',
  JAM_STAND_STILL_TRAFFIC: 'Standstill traffic', CONSTRUCTION: 'Construction',
  ROAD_CLOSED: 'Road closed',
}

function normalizeItems(items: any[]): TrafficEvent[] {
  return items.flatMap(item => {
    const rawType = (item.type ?? '').toUpperCase()
    const rawSub  = (item.subtype ?? '').toUpperCase()
    const type = WAZE_TYPE[rawSub] ?? WAZE_TYPE[rawType]
    if (!type) return []

    const lat = item.location?.y ?? item.lat
    const lng = item.location?.x ?? item.lon
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return []

    return [{
      id: `waze-${item.uuid ?? item.id ?? Math.random().toString(36).slice(2)}`,
      type,
      position: { lat, lng },
      title: WAZE_TITLE[rawSub] ?? WAZE_TITLE[rawType] ?? rawType,
      severity: Math.min(5, Math.max(1, Math.round((item.severity ?? item.level ?? 2) / 2))) as 1|2|3|4|5,
      confidence: Math.min(100, Math.round((item.confidence ?? 5) * 10)),
      votes: item.nThumbsUp ?? 0,
      source: 'waze' as const,
      reportedAt: item.pubMillis
        ? new Date(item.pubMillis).toISOString()
        : new Date().toISOString(),
    }]
  })
}

// Waze endpoints — try in order, first success wins
const WAZE_ENDPOINTS = (bbox: BoundingBox) => [
  `https://www.waze.com/live-map/api/georss?top=${bbox.north}&bottom=${bbox.south}&left=${bbox.west}&right=${bbox.east}&env=row&types=alerts,jams`,
  `https://www.waze.com/row-rtserver/web/TGeoRSS?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&ma=600&mj=100&mu=100`,
]

export async function fetchWazeDirect(bbox: BoundingBox): Promise<TrafficEvent[]> {
  for (const url of WAZE_ENDPOINTS(bbox)) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json, */*' },
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) continue

      const text = await res.text()
      if (!text || text.trim().startsWith('<!')) continue

      const data = JSON.parse(text)
      const events = normalizeItems([
        ...(data.alerts ?? []),
        ...(data.jams ?? []),
      ])

      if (events.length > 0) {
        console.log(`[Waze direct] ${events.length} events from ${url}`)
        return events
      }
    } catch {
      // CORS error or network error — try next endpoint
    }
  }
  return []
}
