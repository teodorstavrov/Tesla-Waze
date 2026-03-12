import axios from 'axios'
import { cacheGetOrSet } from '../cache/redis'

interface WazeBBox {
  north: number
  south: number
  east: number
  west: number
}

export interface WazeAlert {
  uuid: string
  type: string
  subtype?: string
  location: { x: number; y: number }
  street?: string
  country?: string
  city?: string
  reportDescription?: string
  reliability: number
  confidence: number
  nThumbsUp?: number
  reportRating?: number
  pubMillis: number
  speed?: number
}

export interface WazeJam {
  uuid: string
  level: number // 0-5
  speedKMH: number
  line: Array<{ x: number; y: number }>
  street?: string
  length: number
  delay: number
}

export interface WazeData {
  alerts: WazeAlert[]
  jams: WazeJam[]
}

const WAZE_TYPE_MAP: Record<string, string> = {
  POLICE:       'police',
  HAZARD:       'hazard',
  ACCIDENT:     'accident',
  JAM:          'traffic',
  ROAD_CLOSED:  'road_closure',
  CONSTRUCTION: 'construction',
}

export async function fetchWazeData(bbox: WazeBBox): Promise<WazeData> {
  const key = `waze:${bbox.south.toFixed(3)},${bbox.west.toFixed(3)},${bbox.north.toFixed(3)},${bbox.east.toFixed(3)}`

  return cacheGetOrSet<WazeData>(
    key,
    async () => {
      try {
        const response = await axios.get(process.env.WAZE_BASE_URL + '/georss', {
          params: {
            bottom: bbox.south,
            left: bbox.west,
            ma: 600,
            mj: 100,
            mu: 30,
            right: bbox.east,
            top: bbox.north,
            types: 'alerts,jams'
          },
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Tesla Browser) Chrome/120.0'
          }
        })

        return {
          alerts: response.data?.alerts ?? [],
          jams: response.data?.jams ?? [],
        }
      } catch (err) {
        console.error('[WazeService] Fetch error:', err)
        return { alerts: [], jams: [] }
      }
    },
    10 // 10 second cache
  )
}

export function normalizeWazeAlert(alert: WazeAlert) {
  const type = WAZE_TYPE_MAP[alert.type] ?? 'hazard'

  return {
    id: `waze-${alert.uuid}`,
    type,
    position: { lat: alert.location.y, lng: alert.location.x },
    title: formatAlertTitle(alert),
    description: alert.reportDescription,
    severity: mapSeverity(alert.reliability),
    confidence: Math.round(alert.confidence * 10),
    votes: alert.nThumbsUp ?? 0,
    source: 'waze' as const,
    reportedAt: new Date(alert.pubMillis).toISOString(),
    expiresAt: new Date(alert.pubMillis + 2 * 60 * 60 * 1000).toISOString(),
    speed: alert.speed,
  }
}

function formatAlertTitle(alert: WazeAlert): string {
  const type = alert.type
  const sub = alert.subtype

  if (type === 'POLICE') return 'Police reported'
  if (type === 'HAZARD') return sub ? `Hazard: ${sub.toLowerCase().replace(/_/g, ' ')}` : 'Road hazard'
  if (type === 'ACCIDENT') return 'Accident'
  if (type === 'CONSTRUCTION') return 'Construction zone'
  if (type === 'ROAD_CLOSED') return 'Road closure'
  return alert.street ?? type
}

function mapSeverity(reliability: number): 1 | 2 | 3 | 4 | 5 {
  if (reliability >= 8) return 5
  if (reliability >= 6) return 4
  if (reliability >= 4) return 3
  if (reliability >= 2) return 2
  return 1
}
