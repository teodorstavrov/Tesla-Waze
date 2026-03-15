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
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

async function fetchOverpass(north, south, east, west) {
  const query = `[out:json][timeout:20];(node["amenity"="charging_station"](${south},${west},${north},${east});way["amenity"="charging_station"](${south},${west},${north},${east}););out center tags;`

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) continue
      const data = await res.json()

      return (data.elements ?? []).map(el => {
        const lat = el.lat ?? el.center?.lat
        const lng = el.lon ?? el.center?.lon
        if (!lat || !lng) return null

        const tags     = el.tags ?? {}
        const sockets  = parseInt(tags['capacity'] ?? tags['charging_station:output'] ?? '1', 10)
        const operator = tags['operator'] ?? tags['brand'] ?? 'Unknown'
        const name     = tags['name'] ?? tags['brand'] ?? operator ?? 'Charging Station'
        const network  = (operator + name).toLowerCase()

        // Build connector list from OSM tags
        const conns = []
        const connTypes = ['chademo','type2','ccs','tesla','schuko','type1']
        connTypes.forEach(t => {
          if (tags[`socket:${t}`] || tags[`socket:${t}:output`]) {
            conns.push({
              type:      t.toUpperCase().replace('TYPE2','Type 2').replace('SCHUKO','Schuko'),
              powerKw:   parseFloat(tags[`socket:${t}:output`] ?? '0') || 0,
              available: true,
              total:     parseInt(tags[`socket:${t}`] ?? '1', 10),
            })
          }
        })
        if (conns.length === 0) conns.push({ type: 'Unknown', powerKw: 0, available: true, total: 1 })

        return {
          id:            `osm-${el.id}`,
          name,
          position:      { lat, lng },
          operator,
          connectors:    conns,
          totalPorts:    isNaN(sockets) ? conns.length : sockets,
          availablePorts: conns.length,
          isTesla:       network.includes('tesla'),
          amenities:     [],
          pricePerKwh:   undefined,
        }
      }).filter(Boolean)
    } catch {
      continue
    }
  }
  return []
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
      const inBulgaria  = lat >= BG.south && lat <= BG.north && lng >= BG.west && lng <= BG.east
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

  const ocm   = ocmResult.status   === 'fulfilled' ? ocmResult.value   : []
  const osm   = osmResult.status   === 'fulfilled' ? osmResult.value   : []
  const tesla = teslaResult.status === 'fulfilled' ? teslaResult.value : []

  // Tesla first (authoritative for Superchargers), then OCM (has availability), then OSM
  const stations = dedup([...tesla, ...ocm, ...osm])

  return new Response(JSON.stringify({
    stations,
    _sources: { tesla: tesla.length, ocm: ocm.length, osm: osm.length, total: stations.length }
  }), {
    headers: { ...HEADERS, 'Cache-Control': 's-maxage=300' }
  })
}
