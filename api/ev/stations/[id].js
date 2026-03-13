// Vercel Edge Function — GET /api/ev/stations/:id
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/')
  // path: /api/ev/stations/:id → parts = ['','api','ev','stations',':id']
  const rawId = parts[4] ?? ''

  // IDs from our edge function are prefixed with "ocm-"
  const ocmId = rawId.startsWith('ocm-') ? rawId.slice(4) : rawId

  if (!ocmId) {
    return new Response(JSON.stringify({ error: 'Missing station id' }), { status: 400 })
  }

  const apiKey = process.env.OPENCHARGEMAP_API_KEY ?? ''

  try {
    const res = await fetch(
      `https://api.openchargemap.io/v3/poi?output=json&chargepointid=${ocmId}&maxresults=1&compact=false&verbose=false${apiKey ? `&key=${apiKey}` : ''}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`OCM ${res.status}`)
    const data = await res.json()
    const s = data?.[0]

    if (!s) {
      return new Response(JSON.stringify({ error: 'Station not found' }), { status: 404 })
    }

    const addr  = s.AddressInfo ?? {}
    const conns = (s.Connections ?? []).map(c => ({
      type:      c.ConnectionType?.Title ?? 'Unknown',
      powerKw:   c.PowerKW ?? 0,
      available: c.StatusType?.IsOperational === true,
      total:     1,
    }))

    const station = {
      id:             `ocm-${s.ID}`,
      name:           addr.Title ?? 'EV Station',
      position:       { lat: addr.Latitude, lng: addr.Longitude },
      operator:       s.OperatorInfo?.Title ?? 'Unknown',
      connectors:     conns,
      totalPorts:     s.NumberOfPoints ?? conns.length ?? 1,
      availablePorts: conns.filter(c => c.available).length,
      isTesla:        (s.OperatorInfo?.Title ?? '').toLowerCase().includes('tesla'),
      amenities:      (s.UserComments ?? []).slice(0, 3).map(c => c.Comment).filter(Boolean),
      pricePerKwh:    undefined,
      address:        addr.AddressLine1,
      city:           addr.Town,
      country:        addr.Country?.Title,
      phone:          addr.ContactTelephone1,
      website:        addr.RelatedURL,
    }

    return new Response(JSON.stringify({ station }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    console.error('OCM station error:', err.message)
    return new Response(JSON.stringify({ error: 'Failed to fetch station' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
