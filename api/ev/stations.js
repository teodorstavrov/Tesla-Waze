// Vercel Edge Function — EV charging stations
// Sources: OpenChargeMap (primary) + OpenStreetMap/Overpass (secondary) + Tesla Supercharger (tertiary)
export const config = { runtime: 'edge', maxDuration: 25 }

const HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

// ─── OpenChargeMap ────────────────────────────────────────────────────────────
async function fetchOCM(lat, lng, apiKey) {
  const url = `https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lng}&distance=20&distanceunit=km&maxresults=200&compact=true&verbose=false${apiKey ? `&key=${apiKey}` : ''}`
  const res  = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`OCM ${res.status}`)
  const data = await res.json()

  return (data ?? [])
    .filter(s => {
      const a = s.AddressInfo ?? {}
      return typeof a.Latitude === 'number' && typeof a.Longitude === 'number' &&
             !isNaN(a.Latitude) && !isNaN(a.Longitude)
    })
    .map(s => {
      const addr  = s.AddressInfo ?? {}
      const conns = (s.Connections ?? []).map(c => ({
        type:      c.ConnectionType?.Title ?? 'Unknown',
        powerKw:   c.PowerKW ?? 0,
        available: c.StatusType?.IsOperational !== false,
        total:     1,
      }))
      return {
        id:            `ocm-${s.ID}`,
        name:          addr.Title ?? 'EV Station',
        position:      { lat: addr.Latitude, lng: addr.Longitude },
        operator:      s.OperatorInfo?.Title ?? 'Unknown',
        connectors:    conns,
        totalPorts:    s.NumberOfPoints ?? conns.length ?? 1,
        availablePorts: conns.filter(c => c.available).length,
        isTesla:       (s.OperatorInfo?.Title ?? '').toLowerCase().includes('tesla'),
        amenities:     [],
        pricePerKwh:   undefined,
      }
    })
}

// ─── OpenStreetMap / Overpass ─────────────────────────────────────────────────
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

function parseOverpassElements(elements) {
  const parsed = (elements ?? []).map(el => {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) return null

    const tags     = el.tags ?? {}
    const operator = tags['operator'] ?? tags['brand'] ?? 'Unknown'
    const name     = tags['name'] ?? operator ?? 'Charging Station'

    return {
      id:             `osm-${el.id}`,
      name,
      position:       { lat, lng },
      operator,
      connectors:     [{ type: 'Unknown', powerKw: 0, available: true, total: 1 }],
      totalPorts:     1,
      availablePorts: 1,
      isTesla:        false,
      amenities:      [],
    }
  }).filter(Boolean)
  console.log(`[Overpass] RAW: ${(elements ?? []).length}, PARSED: ${parsed.length}`)
  return parsed
}

async function fetchOverpass(north, south, east, west) {
  // timeout:5 matches AbortSignal 6s — Overpass respects its own timeout first
  const query = `[out:json][timeout:25];(node["amenity"="charging_station"](${south},${west},${north},${east});way["amenity"="charging_station"](${south},${west},${north},${east}););out center tags;`
  const body  = `data=${encodeURIComponent(query)}`
  const hdrs  = { 'Content-Type': 'application/x-www-form-urlencoded' }

  // All mirrors in parallel — first success wins
  const tryMirror = (mirror) =>
    fetch(mirror, { method: 'POST', headers: hdrs, body, signal: AbortSignal.timeout(15000) })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(data => ({ stations: parseOverpassElements(data.elements), rawCount: (data.elements ?? []).length }))

  try {
    return await Promise.any(OVERPASS_MIRRORS.map(tryMirror))
  } catch {
    return { stations: [], rawCount: -1 }
  }
}

// ─── Tesla Supercharger ───────────────────────────────────────────────────────
let teslaCache = null
let teslaCacheAt = 0
const TESLA_CACHE_TTL = 10 * 60 * 1000 // 10 min (data changes rarely)

async function fetchTesla(north, south, east, west) {
  // Reuse in-memory cache across requests within the same Edge instance
  const now = Date.now()
  if (!teslaCache || now - teslaCacheAt > TESLA_CACHE_TTL) {
    const res = await fetch('https://supercharge.info/service/supercharge/allSites', {
      signal: AbortSignal.timeout(12000),
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error(`Tesla ${res.status}`)
    teslaCache = await res.json()
    teslaCacheAt = now
  }

  // Bulgaria bounding box — always include all Bulgarian Superchargers
  const BG = { north: 44.2, south: 41.2, east: 28.6, west: 22.4 }

  return teslaCache
    .filter(s => {
      if (s.status !== 'OPEN') return false
      const { latitude: lat, longitude: lng } = s.gps ?? {}
      if (!lat || !lng) return false
      const inViewport  = lat >= south  && lat <= north  && lng >= west  && lng <= east
      // Exclude Turkish panhandle (Edirne ~41.68°N, 26.56°E) that overlaps Bulgaria's rectangular bbox
      const inBulgaria  = lat >= BG.south && lat <= BG.north && lng >= BG.west && lng <= BG.east
                        && !(lat < 41.9 && lng > 26.3)
      return inViewport || inBulgaria
    })
    .map(s => {
      const { latitude: lat, longitude: lng } = s.gps
      const plugs = s.plugs ?? {}
      // Build connector list from plug counts
      const conns = []
      if ((plugs.nacs ?? 0) > 0) conns.push({ type: 'Tesla', powerKw: s.powerKilowatt ?? 0, available: true, total: plugs.nacs })
      if ((plugs.tpc  ?? 0) > 0) conns.push({ type: 'Tesla', powerKw: s.powerKilowatt ?? 0, available: true, total: plugs.tpc })
      if (conns.length === 0)    conns.push({ type: 'Tesla', powerKw: s.powerKilowatt ?? 0, available: true, total: 1 })

      return {
        id:             `tesla-${s.id}`,
        name:           s.name,
        position:       { lat, lng },
        operator:       'Tesla',
        connectors:     conns,
        totalPorts:     s.stallCount ?? conns.reduce((a, c) => a + c.total, 0),
        availablePorts: s.stallCount ?? conns.reduce((a, c) => a + c.total, 0),
        isTesla:        true,
        amenities:      [],
        pricePerKwh:    undefined,
      }
    })
}

// ─── Deduplicate by position (~50m threshold) ─────────────────────────────────
function dedup(stations) {
  const result = []
  for (const s of stations) {
    const duplicate = result.some(r =>
      r.isTesla === s.isTesla &&
      Math.abs(r.position.lat - s.position.lat) < 0.0005 &&
      Math.abs(r.position.lng - s.position.lng) < 0.0005
    )
    if (!duplicate) result.push(s)
  }
  return result
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS })

  const url   = new URL(req.url)
  const north = parseFloat(url.searchParams.get('north') ?? '')
  const south = parseFloat(url.searchParams.get('south') ?? '')
  const east  = parseFloat(url.searchParams.get('east')  ?? '')
  const west  = parseFloat(url.searchParams.get('west')  ?? '')

  if ([north, south, east, west].some(isNaN)) {
    return new Response(JSON.stringify({ stations: [] }), { headers: HEADERS })
  }

  const lat    = (north + south) / 2
  const lng    = (east + west) / 2
  const apiKey = process.env.OPENCHARGEMAP_API_KEY ?? ''

  const [ocmResult, osmResult, teslaResult] = await Promise.allSettled([
    fetchOCM(lat, lng, apiKey),
    fetchOverpass(north, south, east, west),
    fetchTesla(north, south, east, west),
  ])

  const ocm      = ocmResult.status   === 'fulfilled' ? ocmResult.value         : []
  const osmData  = osmResult.status   === 'fulfilled' ? osmResult.value         : { stations: [], rawCount: -1 }
  const osm      = osmData.stations
  const osmRaw   = osmData.rawCount
  const tesla    = teslaResult.status === 'fulfilled' ? teslaResult.value       : []

  // Tesla first (authoritative for Superchargers), then OCM (has availability), then OSM
  const stations = dedup([...tesla, ...ocm, ...osm])

  return new Response(JSON.stringify({
    stations,
    _sources: { tesla: tesla.length, ocm: ocm.length, osm: osm.length, total: stations.length },
    _debug: {
      ocmStatus:   ocmResult.status,
      osmStatus:   osmResult.status,
      teslaStatus: teslaResult.status,
      ocmError:    ocmResult.status   === 'rejected' ? String(ocmResult.reason)   : null,
      osmError:    osmResult.status   === 'rejected' ? String(osmResult.reason)   : null,
      teslaError:  teslaResult.status === 'rejected' ? String(teslaResult.reason) : null,
      counts:      { ocm: ocm.length, osm: osm.length, osmRaw, tesla: tesla.length },
      bbox:        { north, south, east, west },
      center:      { lat, lng },
    },
  }), {
    headers: { ...HEADERS, 'Cache-Control': 'no-store' }
  })
}
