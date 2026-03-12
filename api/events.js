// Vercel Edge Function — Waze international (row-rtserver) + fallback
export const config = { runtime: 'edge' }

const WAZE_TYPE_MAP = {
  POLICE: 'police', HAZARD: 'hazard', ACCIDENT: 'accident',
  JAM: 'traffic', ROAD_CLOSED: 'road_closure', CONSTRUCTION: 'construction',
  WEATHERHAZARD: 'hazard',
}

function normalizeAlert(alert) {
  const type = WAZE_TYPE_MAP[alert.type] ?? 'hazard'
  return {
    id: `waze-${alert.uuid}`,
    type,
    position: { lat: alert.location.y, lng: alert.location.x },
    title: formatTitle(alert),
    description: alert.reportDescription ?? undefined,
    severity: mapSeverity(alert.reliability ?? 3),
    confidence: Math.min(100, Math.round((alert.confidence ?? 5) * 10)),
    votes: alert.nThumbsUp ?? 0,
    source: 'waze',
    reportedAt: new Date(alert.pubMillis ?? Date.now()).toISOString(),
    expiresAt: new Date((alert.pubMillis ?? Date.now()) + 2 * 3600 * 1000).toISOString(),
    speed: alert.speed ?? undefined,
  }
}

function formatTitle(alert) {
  const sub = (alert.subtype ?? '').toLowerCase().replace(/_/g, ' ')
  if (alert.type === 'POLICE') return 'Police reported'
  if (alert.type === 'ACCIDENT') return sub ? `Accident: ${sub}` : 'Accident'
  if (alert.type === 'CONSTRUCTION') return 'Construction zone'
  if (alert.type === 'ROAD_CLOSED') return 'Road closure'
  if (alert.type === 'HAZARD' || alert.type === 'WEATHERHAZARD') return sub ? `Hazard: ${sub}` : 'Road hazard'
  return alert.street ?? alert.type
}

function mapSeverity(r) {
  if (r >= 8) return 5; if (r >= 6) return 4
  if (r >= 4) return 3; if (r >= 2) return 2; return 1
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.waze.com/live-map',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.waze.com',
}

async function fetchWaze(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default async function handler(req) {
  const url = new URL(req.url)
  const north = parseFloat(url.searchParams.get('north') ?? '')
  const south = parseFloat(url.searchParams.get('south') ?? '')
  const east  = parseFloat(url.searchParams.get('east')  ?? '')
  const west  = parseFloat(url.searchParams.get('west')  ?? '')

  if ([north, south, east, west].some(isNaN)) {
    return new Response(JSON.stringify({ error: 'Missing bbox' }), { status: 400 })
  }

  const events = []
  let source = 'none'

  // Try international row-rtserver first (Europe, Asia, etc.)
  const rowUrl = `https://www.waze.com/row-rtserver/web/TGeoRSS?bottom=${south}&left=${west}&ma=500&mj=100&mu=20&right=${east}&top=${north}&types=alerts,jams,irregularities`
  // Fallback: US/global live-map endpoint
  const liveUrl = `https://www.waze.com/live-map/api/georss?bottom=${south}&left=${west}&ma=600&mj=100&mu=30&right=${east}&top=${north}&types=alerts,jams`
  // Alternate row endpoint
  const rowAltUrl = `https://www.waze.com/row-user-display-res/web/georss?bottom=${south}&left=${west}&ma=500&mj=200&mu=20&right=${east}&top=${north}&types=alerts,jams`

  let data = null

  for (const [endpoint, label] of [[rowUrl, 'row-rtserver'], [liveUrl, 'live-map'], [rowAltUrl, 'row-alt']]) {
    try {
      data = await fetchWaze(endpoint)
      source = label
      break
    } catch (err) {
      console.error(`Waze [${label}] failed:`, err.message)
    }
  }

  if (data) {
    const alerts = data.alerts ?? data.rss?.channel?.item ?? []
    const jams   = data.jams ?? data.irregularities ?? []

    for (const alert of alerts) {
      if (alert?.location?.x && alert?.location?.y) {
        events.push(normalizeAlert(alert))
      }
    }

    for (const jam of jams) {
      const line = jam.line ?? jam.segments ?? []
      const mid  = line[Math.floor(line.length / 2)]
      if (mid) {
        events.push({
          id: `waze-jam-${jam.uuid ?? Math.random()}`,
          type: 'traffic',
          position: { lat: mid.y ?? mid.lat, lng: mid.x ?? mid.lng },
          title: `Heavy traffic${jam.street ? ` on ${jam.street}` : ''}`,
          description: `${(jam.speedKMH ?? 0).toFixed(0)} km/h · ${((jam.length ?? 0) / 1000).toFixed(1)} km`,
          severity: Math.min(5, jam.level ?? 2),
          confidence: 85,
          votes: 0,
          source: 'waze',
          reportedAt: new Date().toISOString(),
        })
      }
    }
  }

  // Deduplicate
  const seen = new Map()
  for (const e of events) {
    const key = `${e.type}:${Math.round(e.position.lat * 100)},${Math.round(e.position.lng * 100)}`
    if (!seen.has(key) || e.confidence > seen.get(key).confidence) seen.set(key, e)
  }

  const result = Array.from(seen.values())

  return new Response(
    JSON.stringify({
      events: result,
      total: result.length,
      source,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=10, stale-while-revalidate=5',
        'Access-Control-Allow-Origin': '*',
      }
    }
  )
}
