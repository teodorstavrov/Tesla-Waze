// Vercel Edge Function — POST /api/reports/:id/vote
// Note: Edge Functions are stateless — votes are acknowledged but not persisted
// (reports live in reports.js in-memory Map which is a separate isolate)
export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const url = new URL(req.url)
  const parts = url.pathname.split('/')
  // path: /api/reports/:id/vote  → parts = ['','api','reports',':id','vote']
  const id = parts[3]

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing report id' }), { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const vote = body.vote // 'up' | 'down'

  if (vote !== 'up' && vote !== 'down') {
    return new Response(JSON.stringify({ error: 'vote must be "up" or "down"' }), { status: 400 })
  }

  // Acknowledge the vote — in a production setup connect to a DB here
  return new Response(JSON.stringify({ success: true, id, vote }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
