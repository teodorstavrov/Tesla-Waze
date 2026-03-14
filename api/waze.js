// Vercel Edge Function — Live traffic alerts
// Pipeline: Waze TGeoRSS → TomTom (fallback) → normalized events

export const config = { runtime: 'edge', maxDuration: 25 }

// ─── Waze type normalisation ─────────────────────────────────────────────────
const WAZE_TYPE = {
  POLICE: 'police', POLICE_HIDING: 'police', POLICE_VISIBLE: 'police',
  ACCIDENT: 'accident', ACCIDENT_MINOR: 'accident', ACCIDENT_MAJOR: 'accident',
  HAZARD: 'hazard', HAZARD_ON_ROAD: 'hazard', HAZARD_ON_SHOULDER: 'hazard',
  HAZARD_WEATHER: 'hazard', HAZARD_ON_ROAD_OBJECT: 'hazard',
  HAZARD_ON_ROAD_POT_HOLE: 'hazard', HAZARD_ON_ROAD_LANE_CLOSED: 'hazard',
  JAM: 'traffic', JAM_MODERATE_TRAFFIC: 'traffic', JAM_HEAVY_TRAFFIC: 'traffic',
  JAM_STAND_STILL_TRAFFIC: 'traffic', JAM_LIGHT_TRAFFIC: 'traffic',
  CONSTRUCTION: 'construction', ROAD_CLOSED: 'road_closure',
}

const WAZE_TITLE = {
  POLICE: 'Police', POLICE_HIDING: 'Police (hiding)', POLICE_VISIBLE: 'Police',
  ACCIDENT: 'Accident', ACCIDENT_MINOR: 'Minor accident', ACCIDENT_MAJOR: 'Major accident',
  HAZARD: 'Road hazard', HAZARD_WEATHER: 'Weather hazard',
  JAM: 'Traffic jam', JAM_HEAVY_TRAFFIC: 'Heavy traffic', JAM_STAND_STILL_TRAFFIC: 'Standstill',
  CONSTRUCTION: 'Construction', ROAD_CLOSED: 'Road closed',
}

// ─── Waze TGeoRSS feed ────────────────────────────────────────────────────────
async function fetchWaze(south, west, north, east) {
  const bbox = `${west},${south},${east},${north}`
  const url = `https://www.waze.com/row-rtserver/web/TGeoRSS?bbox=${bbox}&ma=600&mj=100&mu=100`

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/xml, */*',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      'Referer': 'https://www.waze.com/live-map/',
      'Origin': 'https://www.waze.com',
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`Waze ${res.status}`)

  const text = await res.text()
  if (text.trim().startsWith('<!')) throw new Error('Waze blocked (HTML response)')

  // JSON response
  if (text.trim().startsWith('{')) {
    return parseWazeJSON(JSON.parse(text))
  }

  // XML/GeoRSS response
  return parseWazeXML(text)
}

function parseWazeJSON(data) {
  const events = []
  const items = [...(data.alerts ?? []), ...(data.jams ?? [])]

  for (const item of items) {
    const rawType = (item.type ?? '').toUpperCase()
    const rawSub  = (item.subtype ?? '').toUpperCase()
    const type = WAZE_TYPE[rawSub] ?? WAZE_TYPE[rawType]
    if (!type) continue

    const lat = item.location?.y ?? item.lat
    const lng = item.location?.x ?? item.lon
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue

    events.push({
      id: `waze-${item.uuid ?? item.id ?? Math.random().toString(36).slice(2)}`,
      type,
      position: { lat, lng },
      title: WAZE_TITLE[rawSub] ?? WAZE_TITLE[rawType] ?? rawType,
      severity: Math.min(5, Math.max(1, Math.round((item.severity ?? item.level ?? 2) / 2))),
      confidence: Math.round((item.confidence ?? 5) * 10),
      votes: item.nThumbsUp ?? 0,
      source: 'waze',
      reportedAt: item.pubMillis
        ? new Date(item.pubMillis).toISOString()
        : new Date().toISOString(),
    })
  }

  return events
}

function parseWazeXML(xml) {
  const events = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]

    const tag = (name) => {
      const r = new RegExp(`<(?:[a-z]+:)?${name}[^>]*>([^<]*)<\\/(?:[a-z]+:)?${name}>`, 'i')
      return r.exec(block)?.[1]?.trim() ?? null
    }

    const rawType = (tag('type') ?? '').toUpperCase()
    const rawSub  = (tag('subtype') ?? '').toUpperCase()
    const type = WAZE_TYPE[rawSub] ?? WAZE_TYPE[rawType]
    if (!type) continue

    const pt = /<georss:point>\s*([\d.-]+)\s+([\d.-]+)\s*<\/georss:point>/i.exec(block)
    if (!pt) continue

    const lat = parseFloat(pt[1])
    const lng = parseFloat(pt[2])
    if (isNaN(lat) || isNaN(lng)) continue

    events.push({
      id: `waze-${Math.random().toString(36).slice(2)}`,
      type,
      position: { lat, lng },
      title: WAZE_TITLE[rawSub] ?? WAZE_TITLE[rawType] ?? rawType,
      severity: 2,
      confidence: Math.min(100, parseInt(tag('confidence') ?? '50', 10) * 10),
      votes: parseInt(tag('nThumbsUp') ?? '0', 10),
      source: 'waze',
      reportedAt: new Date().toISOString(),
    })
  }

  return events
}

// ─── TomTom incidents (fallback) ──────────────────────────────────────────────
async function fetchTomTom(south, west, north, east, apiKey) {
  const fields = encodeURIComponent(
    '{incidents{type,geometry{type,coordinates},properties{id,magnitudeOfDelay,events{description,iconCategory},from,to}}}'
  )
  const res = await fetch(
    `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${west},${south},${east},${north}&fields=${fields}&language=en-GB&timeValidityFilter=present`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data = await res.json()

  const CAT = { 1:'accident', 2:'hazard', 3:'construction', 4:'road_closure', 5:'road_closure', 6:'traffic', 7:'traffic', 8:'traffic', 9:'hazard', 14:'construction' }

  return (data.incidents ?? []).map(inc => {
    const p      = inc.properties ?? {}
    const coords = inc.geometry?.coordinates
    const pt     = Array.isArray(coords?.[0]) ? coords[0] : (coords ?? [])
    const ev     = (p.events ?? [])[0] ?? {}
    const lat = pt[1], lng = pt[0]
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null
    return {
      id: `tt-${p.id}`,
      type: CAT[ev.iconCategory] ?? 'traffic',
      position: { lat, lng },
      title: ev.description ?? 'Traffic incident',
      severity: Math.min(5, Math.max(1, p.magnitudeOfDelay ?? 1)),
      confidence: 90,
      votes: 0,
      source: 'traffic_api',
      reportedAt: new Date().toISOString(),
    }
  }).filter(Boolean)
}

// ─── Dedup by rounded coordinates ────────────────────────────────────────────
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
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    })
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

  // 1. Waze TGeoRSS — live police, accidents, hazards, traffic
  try {
    const wazeEvents = await fetchWaze(south, west, north, east)
    events.push(...wazeEvents)
    sources.push(`waze:${wazeEvents.length}`)
  } catch (err) {
    console.error('[Waze] Error:', err.message)
    sources.push('waze:error')
  }

  // 2. TomTom — fallback when Waze is blocked/empty
  const tomtomKey = process.env.TOMTOM_API_KEY
  if (tomtomKey && events.length === 0) {
    try {
      const ttEvents = await fetchTomTom(south, west, north, east, tomtomKey)
      events.push(...ttEvents)
      sources.push(`tomtom:${ttEvents.length}`)
    } catch (err) {
      console.error('[TomTom] Error:', err.message)
      sources.push('tomtom:error')
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
