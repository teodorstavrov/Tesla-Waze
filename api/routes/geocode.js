export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const q   = url.searchParams.get('q') ?? ''
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')

  if (q.length < 2) {
    return new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json' } })
  }

  const params = new URLSearchParams({ q, format: 'json', limit: '5', addressdetails: '0' })
  if (lat && lng) {
    params.set('viewbox', `${parseFloat(lng) - 1},${parseFloat(lat) - 1},${parseFloat(lng) + 1},${parseFloat(lat) + 1}`)
    params.set('bounded', '0')
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'TeslaIntelligence/1.0 (https://github.com/teodorstavrov/Tesla-Waze)' },
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    const results = (data ?? []).map(r => ({
      label: r.display_name,
      position: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }
    }))
    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=300' }
    })
  } catch {
    return new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json' } })
  }
}
