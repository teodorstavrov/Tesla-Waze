// Vercel Edge Function — Live traffic alerts
// Sources: TomTom (primary) + HERE Traffic (fallback, no key needed)

export const config = { runtime: 'edge', maxDuration: 25 }

// ─── TomTom ───────────────────────────────────────────────────────────────────
const TT_CAT = {
  1: 'accident', 2: 'hazard', 3: 'construction',
  4: 'road_closure', 5: 'road_closure',
  6: 'traffic', 7: 'traffic', 8: 'traffic',
  9: 'hazard', 14: 'construction',
}

async function fetchTomTom(south, west, north, east, apiKey) {
  const fields = encodeURIComponent(
    '{incidents{type,geometry{type,coordinates},properties{id,magnitudeOfDelay,events{description,iconCategory},from,to}}}'
  )
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${west},${south},${east},${north}&fields=${fields}&language=en-GB&timeValidityFilter=present`

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TomTom ${res.status}: ${body.slice(0, 120)}`)
  }
  const data = await res.json()

  return (data.incidents ?? []).flatMap(inc => {
    const p      = inc.properties ?? {}
    const coords = inc.geometry?.coordinates
    const pt     = Array.isArray(coords?.[0]) ? coords[0] : (coords ?? [])
    const ev     = (p.events ?? [])[0] ?? {}
    const lat = pt[1], lng = pt[0]
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return []
    return [{
      id: `tt-${p.id ?? Math.random().toString(36).slice(2)}`,
      type: TT_CAT[ev.iconCategory] ?? 'traffic',
      position: { lat, lng },
      title: ev.description ?? 'Traffic incident',
      severity: Math.min(5, Math.max(1, p.magnitudeOfDelay ?? 1)),
      confidence: 90,
      votes: 0,
      source: 'traffic_api',
      reportedAt: new Date().toISOString(),
    }]
  })
}

// ─── HERE Traffic (no API key needed for basic flow/incidents) ────────────────
// Uses HERE's open vector tile incidents — free, works server-side
async function fetchHERE(south, west, north, east) {
  // HERE Traffic incidents via open REST endpoint
  const url = `https://data.traffic.hereapi.com/v7/incidents?in=bbox:${west},${south},${east},${north}&locationReferencing=none`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HERE ${res.status}`)
  const data = await res.json()

  const TYPE_MAP = {
    accident: 'accident', construction: 'construction',
    disabledVehicle: 'hazard', massTransit: 'traffic', misc: 'hazard',
    plannedEvent: 'hazard', roadClosure: 'road_closure',
    roadHazard: 'hazard', weather: 'hazard',
    congestion: 'traffic', flow: 'traffic',
  }

  return (data.results ?? []).flatMap(item => {
    const loc = item.location?.shape?.links?.[0]
    const pt  = loc?.points?.[0] ?? item.location?.originalLocation
    if (!pt) return []
    const lat = pt.lat ?? pt.latitude
    const lng = pt.lng ?? pt.longitude
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return []
    const rawType = (item.incidentDetails?.type ?? 'misc').toLowerCase()
    const type = TYPE_MAP[rawType] ?? 'hazard'
    return [{
      id: `here-${item.incidentDetails?.id ?? Math.random().toString(36).slice(2)}`,
      type,
      position: { lat, lng },
      title: item.incidentDetails?.description?.value ?? rawType,
      severity: Math.min(5, Math.max(1, item.incidentDetails?.criticality ?? 2)),
      confidence: 80,
      votes: 0,
      source: 'traffic_api',
      reportedAt: new Date().toISOString(),
    }]
  })
}

// ─── Waze TGeoRSS (try multiple endpoints, likely blocked but worth trying) ────
async function fetchWaze(south, west, north, east) {
  const ENDPOINTS = [
    `https://www.waze.com/live-map/api/georss?top=${north}&bottom=${south}&left=${west}&right=${east}&env=row&types=alerts,jams`,
    `https://www.waze.com/row-rtserver/web/TGeoRSS?bbox=${west},${south},${east},${north}&ma=600&mj=100&mu=100`,
  ]

  const WAZE_TYPE = {
    POLICE:'police', POLICE_HIDING:'police', POLICE_VISIBLE:'police',
    ACCIDENT:'accident', ACCIDENT_MINOR:'accident', ACCIDENT_MAJOR:'accident',
    HAZARD:'hazard', HAZARD_ON_ROAD:'hazard', HAZARD_WEATHER:'hazard',
    JAM:'traffic', JAM_HEAVY_TRAFFIC:'traffic', JAM_STAND_STILL_TRAFFIC:'traffic',
    JAM_MODERATE_TRAFFIC:'traffic', CONSTRUCTION:'construction', ROAD_CLOSED:'road_closure',
  }

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/xml, */*',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
          'Referer': 'https://www.waze.com/live-map/',
        },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const text = await res.text()
      if (text.trim().startsWith('<!')) continue

      const data = JSON.parse(text)
      const items = [...(data.alerts ?? []), ...(data.jams ?? [])]
      const events = items.flatMap(item => {
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
          title: rawSub || rawType,
          severity: Math.min(5, Math.max(1, Math.round((item.severity ?? 2) / 2))),
          confidence: Math.round((item.confidence ?? 5) * 10),
          votes: item.nThumbsUp ?? 0,
          source: 'waze',
          reportedAt: item.pubMillis ? new Date(item.pubMillis).toISOString() : new Date().toISOString(),
        }]
      })
      if (events.length > 0) return events
    } catch { /* try next */ }
  }
  throw new Error('All Waze endpoints failed or blocked')
}

// ─── Dedup ────────────────────────────────────────────────────────────────────
function dedup(events) {
  const seen = new Map()
  for (const e of events) {
    const key = `${e.type}:${Math.round(e.position.lat * 100)},${Math.round(e.position.lng * 100)}`
    if (!seen.has(key) || e.confidence > seen.get(key).confidence) seen.set(key, e)
  }
  return Array.from(seen.values())
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } })
  }

  const url   = new URL(req.url)
  let north, south, east, west

  const bboxParam = url.searchParams.get('bbox')
  if (bboxParam) {
    const [w, s, e, n] = bboxParam.split(',').map(Number)
    west = w; south = s; east = e; north = n
  } else {
    north = parseFloat(url.searchParams.get('north') ?? '')
    south = parseFloat(url.searchParams.get('south') ?? '')
    east  = parseFloat(url.searchParams.get('east')  ?? '')
    west  = parseFloat(url.searchParams.get('west')  ?? '')
  }

  if ([north, south, east, west].some(isNaN)) {
    return new Response(JSON.stringify({ error: 'Missing bbox params' }), { status: 400 })
  }

  const events  = []
  const sources = []

  // 1. Waze (likely blocked, but try first — it's free)
  try {
    const wazeEvents = await fetchWaze(south, west, north, east)
    events.push(...wazeEvents)
    sources.push(`waze:${wazeEvents.length}`)
  } catch (err) {
    sources.push(`waze:blocked`)
  }

  // 2. TomTom — primary paid source
  const tomtomKey = process.env.TOMTOM_API_KEY
  if (tomtomKey) {
    try {
      const ttEvents = await fetchTomTom(south, west, north, east, tomtomKey)
      events.push(...ttEvents)
      sources.push(`tomtom:${ttEvents.length}`)
    } catch (err) {
      sources.push(`tomtom:error(${err.message.slice(0, 60)})`)
    }
  } else {
    sources.push('tomtom:no-key')
  }

  // 3. HERE Traffic — free, no key required
  if (events.length === 0) {
    try {
      const hereEvents = await fetchHERE(south, west, north, east)
      events.push(...hereEvents)
      sources.push(`here:${hereEvents.length}`)
    } catch (err) {
      sources.push(`here:error(${err.message.slice(0, 40)})`)
    }
  }

  const result = dedup(events)

  return new Response(
    JSON.stringify({ events: result, total: result.length, sources, timestamp: new Date().toISOString() }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=10',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    }
  )
}
