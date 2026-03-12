// Vercel serverless function — in-memory user reports (resets on cold start)
// For persistence, connect a DB via POSTGRES_URL env var
export const config = { runtime: 'edge' }

// In-memory store (lost on cold start — acceptable for demo)
const reports = new Map()

export default async function handler(req) {
  const method = req.method

  if (method === 'GET') {
    const url = new URL(req.url)
    const north = parseFloat(url.searchParams.get('north') ?? '90')
    const south = parseFloat(url.searchParams.get('south') ?? '-90')
    const east  = parseFloat(url.searchParams.get('east')  ?? '180')
    const west  = parseFloat(url.searchParams.get('west')  ?? '-180')

    const visible = Array.from(reports.values()).filter(r =>
      r.lat >= south && r.lat <= north && r.lng >= west && r.lng <= east &&
      new Date(r.expiresAt) > new Date()
    )
    return new Response(JSON.stringify({ reports: visible }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (method === 'POST') {
    const body = await req.json()
    const { type, position } = body
    const allowed = ['police', 'accident', 'speed_camera', 'hazard']
    if (!allowed.includes(type) || !position?.lat || !position?.lng) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 })
    }
    const id = crypto.randomUUID()
    const report = {
      id, type,
      lat: position.lat, lng: position.lng,
      upvotes: 0, downvotes: 0, confirmed: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    }
    reports.set(id, report)
    return new Response(JSON.stringify({ report }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
}
