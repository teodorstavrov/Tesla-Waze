// Vercel Edge Function — route calculation via OSRM (free, no key)
export const config = { runtime: 'edge' }

async function osrmRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=false`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`OSRM ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found')
  const r = data.routes[0]
  return {
    distance: Math.round(r.distance),
    duration: Math.round(r.duration),
    polyline: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { origin, destination, modes } = await req.json()
  if (!origin?.lat || !destination?.lat) {
    return new Response(JSON.stringify({ error: 'Invalid origin/destination' }), { status: 400 })
  }

  try {
    const base = await osrmRoute(origin, destination)

    const modeList = modes ?? ['fastest', 'least_traffic', 'least_cameras', 'lowest_risk']
    const routes = modeList.map((mode, i) => ({
      id: `route-${i}`,
      mode,
      waypoints:       [origin, destination],
      distanceMeters:  base.distance,
      durationSeconds: base.duration,
      polyline:        base.polyline,
      summary: {
        policeCount: 0, cameraCount: 0, accidentCount: 0,
        hazardCount: 0, constructionCount: 0, trafficLevel: 'none', riskScore: 0,
      },
      color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i] ?? '#6b7280',
    }))

    return new Response(JSON.stringify({ routes }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=30', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    console.error('Route error:', err.message)
    return new Response(JSON.stringify({ routes: [], error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
