// Vercel Edge Function — EV charging stations via OpenChargeMap
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url   = new URL(req.url)
  const north = parseFloat(url.searchParams.get('north') ?? '')
  const south = parseFloat(url.searchParams.get('south') ?? '')
  const east  = parseFloat(url.searchParams.get('east')  ?? '')
  const west  = parseFloat(url.searchParams.get('west')  ?? '')

  if ([north, south, east, west].some(isNaN)) {
    return new Response(JSON.stringify({ stations: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  const lat = (north + south) / 2
  const lng = (east + west) / 2
  const apiKey = process.env.OPENCHARGEMAP_API_KEY ?? ''

  try {
    const res = await fetch(
      `https://api.openchargemap.io/v3/poi?output=json&latitude=${lat}&longitude=${lng}&distance=15&distanceunit=km&maxresults=50&compact=true&verbose=false${apiKey ? `&key=${apiKey}` : ''}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`OCM ${res.status}`)
    const data = await res.json()

    const stations = (data ?? []).map(s => {
      const addr = s.AddressInfo ?? {}
      const conns = (s.Connections ?? []).map(c => ({
        id: String(c.ID ?? ''),
        type: c.ConnectionType?.Title ?? 'Unknown',
        powerKW: c.PowerKW ?? null,
        status: c.StatusType?.IsOperational ? 'available' : 'unknown',
      }))
      return {
        id: `ocm-${s.ID}`,
        name: addr.Title ?? 'EV Station',
        position: { lat: addr.Latitude, lng: addr.Longitude },
        operator: s.OperatorInfo?.Title ?? null,
        connectors: conns,
        totalPoints: s.NumberOfPoints ?? conns.length,
        availablePoints: conns.filter(c => c.status === 'available').length,
        status: 'operational',
        isFree: s.UsageCost === 'Free' || s.UsageCost?.toLowerCase().includes('free'),
        source: 'ocm',
      }
    })

    return new Response(JSON.stringify({ stations }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    console.error('OCM error:', err.message)
    return new Response(JSON.stringify({ stations: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
