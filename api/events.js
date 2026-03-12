// Vercel serverless function — aggregates Waze + user bbox events
export const config = { runtime: 'edge' }

const WAZE_TYPE_MAP = {
  POLICE: 'police', HAZARD: 'hazard', ACCIDENT: 'accident',
  JAM: 'traffic', ROAD_CLOSED: 'road_closure', CONSTRUCTION: 'construction',
}

function normalizeAlert(alert) {
  const type = WAZE_TYPE_MAP[alert.type] ?? 'hazard'
  return {
    id: `waze-${alert.uuid}`,
    type,
    position: { lat: alert.location.y, lng: alert.location.x },
    title: formatTitle(alert),
    description: alert.reportDescription,
    severity: mapSeverity(alert.reliability ?? 3),
    confidence: Math.min(100, Math.round((alert.confidence ?? 5) * 10)),
    votes: alert.nThumbsUp ?? 0,
    source: 'waze',
    reportedAt: new Date(alert.pubMillis ?? Date.now()).toISOString(),
    expiresAt: new Date((alert.pubMillis ?? Date.now()) + 2 * 3600 * 1000).toISOString(),
    speed: alert.speed,
  }
}

function formatTitle(alert) {
  if (alert.type === 'POLICE') return 'Police reported'
  if (alert.type === 'ACCIDENT') return 'Accident'
  if (alert.type === 'CONSTRUCTION') return 'Construction zone'
  if (alert.type === 'ROAD_CLOSED') return 'Road closure'
  if (alert.type === 'HAZARD') {
    const sub = (alert.subtype ?? '').toLowerCase().replace(/_/g, ' ')
    return sub ? `Hazard: ${sub}` : 'Road hazard'
  }
  return alert.street ?? alert.type
}

function mapSeverity(r) {
  if (r >= 8) return 5; if (r >= 6) return 4
  if (r >= 4) return 3; if (r >= 2) return 2; return 1
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

  try {
    const wazeUrl = `https://www.waze.com/live-map/api/georss?bottom=${south}&left=${west}&ma=600&mj=100&mu=30&right=${east}&top=${north}&types=alerts,jams`
    const res = await fetch(wazeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer': 'https://www.waze.com/',
        'Accept': 'application/json, text/javascript, */*',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      ;(data.alerts ?? []).forEach(a => events.push(normalizeAlert(a)))
      ;(data.jams ?? []).forEach(jam => {
        const mid = jam.line?.[Math.floor((jam.line?.length ?? 1) / 2)]
        if (mid) {
          events.push({
            id: `waze-jam-${jam.uuid}`,
            type: 'traffic',
            position: { lat: mid.y, lng: mid.x },
            title: `Heavy traffic${jam.street ? ` on ${jam.street}` : ''}`,
            description: `${(jam.speedKMH ?? 0).toFixed(0)} km/h · ${((jam.length ?? 0) / 1000).toFixed(1)}km`,
            severity: Math.min(5, jam.level ?? 1),
            confidence: 85,
            votes: 0,
            source: 'waze',
            reportedAt: new Date().toISOString(),
          })
        }
      })
    }
  } catch (err) {
    console.error('Waze fetch error:', err.message)
  }

  // Deduplicate
  const seen = new Map()
  for (const e of events) {
    const key = `${e.type}:${Math.round(e.position.lat * 100)},${Math.round(e.position.lng * 100)}`
    if (!seen.has(key) || e.confidence > seen.get(key).confidence) seen.set(key, e)
  }

  return new Response(
    JSON.stringify({ events: Array.from(seen.values()), total: seen.size, timestamp: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=10' } }
  )
}
