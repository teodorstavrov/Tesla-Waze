// Vercel Edge Function — Speed cameras only (OSM/Overpass)
// Live incidents (police/accidents/hazards/traffic) → /api/waze
export const config = { runtime: 'edge', maxDuration: 25 }

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

async function fetchOverpass(south, west, north, east) {
  const query = `[out:json][timeout:12];(node["highway"="speed_camera"](${south},${west},${north},${east});node["enforcement"="maxspeed"](${south},${west},${north},${east}););out body;`
  const body  = `data=${encodeURIComponent(query)}`
  const hdrs  = { 'Content-Type': 'application/x-www-form-urlencoded' }

  const tryMirror = (mirror) =>
    fetch(mirror, { method: 'POST', headers: hdrs, body, signal: AbortSignal.timeout(13000) })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(data => (data.elements ?? []).map(el => ({
        id:          `osm-${el.id}`,
        type:        'speed_camera',
        position:    { lat: el.lat, lng: el.lon },
        title:       'Speed camera',
        description: el.tags?.maxspeed ? `Limit: ${el.tags.maxspeed} km/h` : undefined,
        severity:    3,
        confidence:  95,
        votes:       5,
        source:      'osm',
        reportedAt:  new Date().toISOString(),
        speed:       el.tags?.maxspeed ? parseInt(el.tags.maxspeed) : undefined,
        direction:   el.tags?.direction ? parseInt(el.tags.direction) : undefined,
      })))

  return Promise.any(OVERPASS_MIRRORS.map(tryMirror))
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } })
  }

  const url   = new URL(req.url)
  const north = parseFloat(url.searchParams.get('north') ?? '')
  const south = parseFloat(url.searchParams.get('south') ?? '')
  const east  = parseFloat(url.searchParams.get('east')  ?? '')
  const west  = parseFloat(url.searchParams.get('west')  ?? '')

  if ([north, south, east, west].some(isNaN)) {
    return new Response(JSON.stringify({ error: 'Missing bbox' }), { status: 400 })
  }

  const events  = []
  const sources = []

  try {
    const cams = await fetchOverpass(south, west, north, east)
    events.push(...cams)
    sources.push(`osm:${cams.length}`)
  } catch (err) {
    console.error('Overpass all mirrors failed:', err?.errors?.map(e => e.message).join(', ') ?? err.message)
    sources.push('osm:error')
  }

  return new Response(
    JSON.stringify({ events, total: events.length, sources, timestamp: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300', 'Access-Control-Allow-Origin': '*' } }
  )
}
