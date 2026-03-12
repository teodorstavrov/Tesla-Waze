// Vercel Edge Function — events along a polyline
export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { polyline, bufferMeters = 200 } = await req.json()
  if (!Array.isArray(polyline) || polyline.length < 2) {
    return new Response(JSON.stringify({ error: 'Invalid polyline' }), { status: 400 })
  }

  const lats = polyline.map(p => p.lat)
  const lngs = polyline.map(p => p.lng)
  const buf  = bufferMeters / 111000

  const bbox = {
    north: Math.max(...lats) + buf,
    south: Math.min(...lats) - buf,
    east:  Math.max(...lngs) + buf,
    west:  Math.min(...lngs) - buf,
  }

  // Delegate to the events handler
  const baseUrl = new URL(req.url)
  const eventsUrl = `${baseUrl.origin}/api/events?north=${bbox.north}&south=${bbox.south}&east=${bbox.east}&west=${bbox.west}`

  try {
    const res = await fetch(eventsUrl, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    return new Response(
      JSON.stringify({ events: data.events ?? [], total: data.total ?? 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(JSON.stringify({ events: [], total: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
