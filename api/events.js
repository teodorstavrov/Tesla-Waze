// Vercel Edge Function — Traffic events
// Sources: Overpass API (OSM speed cameras) + TomTom/HERE (if keys set)
export const config = {
  runtime: 'edge',
  // Extend Vercel edge timeout to 25s (max allowed)
  maxDuration: 25,
}

// ─── Overpass — speed cameras from OpenStreetMap ──────────────────────────────
async function fetchOverpass(south, west, north, east) {
  const query = `[out:json][timeout:15];
(
  node["highway"="speed_camera"](${south},${west},${north},${east});
  node["enforcement"="maxspeed"](${south},${west},${north},${east});
  node["highway"="stop"](${south},${west},${north},${east});
);
out body;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(18000),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  const data = await res.json()

  return (data.elements ?? []).map(el => ({
    id: `osm-${el.id}`,
    type: 'speed_camera',
    position: { lat: el.lat, lng: el.lon },
    title: 'Speed camera',
    description: el.tags?.maxspeed ? `Limit: ${el.tags.maxspeed} km/h` : undefined,
    severity: 3,
    confidence: 95,
    votes: 5,
    source: 'osm',
    reportedAt: new Date().toISOString(),
    speed: el.tags?.maxspeed ? parseInt(el.tags.maxspeed) : undefined,
    direction: el.tags?.direction ? parseInt(el.tags.direction) : undefined,
  }))
}

// ─── TomTom Incidents (optional, needs TOMTOM_API_KEY env var) ────────────────
async function fetchTomTom(south, west, north, east, apiKey) {
  const fields = `{incidents{type,geometry{type,coordinates},properties{id,magnitudeOfDelay,events{description,iconCategory},from,to}}}`
  const res = await fetch(
    `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${west},${south},${east},${north}&fields=${fields}&language=en-GB&timeValidityFilter=present`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data = await res.json()

  const TYPE = { 1:'accident',2:'hazard',3:'construction',4:'road_closure',5:'road_closure',6:'traffic',7:'traffic',8:'traffic',9:'hazard',14:'construction' }
  return (data.incidents ?? []).map(inc => {
    const p = inc.properties ?? {}
    const c = inc.geometry?.coordinates ?? [0,0]
    const ev = (p.events ?? [])[0] ?? {}
    return {
      id: `tt-${p.id}`,
      type: TYPE[ev.iconCategory] ?? 'traffic',
      position: { lat: c[1], lng: c[0] },
      title: ev.description ?? 'Traffic incident',
      severity: Math.min(5, Math.max(1, p.magnitudeOfDelay ?? 1)),
      confidence: 90,
      votes: 0,
      source: 'tomtom',
      reportedAt: new Date().toISOString(),
    }
  })
}

function dedup(events) {
  const seen = new Map()
  for (const e of events) {
    const key = `${e.type}:${Math.round(e.position.lat * 100)},${Math.round(e.position.lng * 100)}`
    if (!seen.has(key) || e.confidence > seen.get(key).confidence) seen.set(key, e)
  }
  return Array.from(seen.values())
}

export default async function handler(req) {
  const url    = new URL(req.url)
  const north  = parseFloat(url.searchParams.get('north') ?? '')
  const south  = parseFloat(url.searchParams.get('south') ?? '')
  const east   = parseFloat(url.searchParams.get('east')  ?? '')
  const west   = parseFloat(url.searchParams.get('west')  ?? '')

  if ([north, south, east, west].some(isNaN)) {
    return new Response(JSON.stringify({ error: 'Missing bbox' }), { status: 400 })
  }

  const events  = []
  const sources = []

  // 1. Speed cameras via Overpass (always free, always works)
  try {
    const cams = await fetchOverpass(south, west, north, east)
    events.push(...cams)
    sources.push(`osm:${cams.length}`)
  } catch (err) {
    console.error('Overpass error:', err.message)
    sources.push('osm:error')
  }

  // 2. TomTom live incidents (free 2500/day — set TOMTOM_API_KEY in Vercel env)
  if (process.env.TOMTOM_API_KEY) {
    try {
      const incs = await fetchTomTom(south, west, north, east, process.env.TOMTOM_API_KEY)
      events.push(...incs)
      sources.push(`tomtom:${incs.length}`)
    } catch (err) {
      console.error('TomTom error:', err.message)
    }
  }

  const result = dedup(events)

  return new Response(
    JSON.stringify({ events: result, total: result.length, sources, timestamp: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=30', 'Access-Control-Allow-Origin': '*' } }
  )
}
