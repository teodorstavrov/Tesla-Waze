// DELETE /api/reports/:id — remove a report (manual dismissal by nearby user)
export const config = { runtime: 'edge' }

const REPORTS_KEY = 'tesla-waze:reports'

async function redisGet(url, token, key) {
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  })
  const data = await res.json()
  return data.result ?? null
}

async function redisSet(url, token, key, value) {
  await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([value, 'EX', 604800]), // 7 days max TTL
    signal: AbortSignal.timeout(5000),
  })
}

export default async function handler(req) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  // Extract id from URL path: /api/reports/:id
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders })

  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    try {
      const raw      = await redisGet(redisUrl, redisToken, REPORTS_KEY)
      const all      = raw ? JSON.parse(raw) : []
      const filtered = all.filter(r => r.id !== id)
      await redisSet(redisUrl, redisToken, REPORTS_KEY, JSON.stringify(filtered))
    } catch (err) {
      console.error('Redis error on delete:', err.message)
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
}
