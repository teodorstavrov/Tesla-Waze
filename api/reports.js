// Vercel Edge Function — User reports
// Storage: Upstash Redis (persistent across all instances)
// Fallback: in-memory (single instance only — dev/demo)

export const config = { runtime: 'edge' }

const REPORTS_KEY = 'teslawaze_reports_v2'
const TTL_SECONDS = 7 * 24 * 3600  // 7 days — removed manually by nearby users

// ─── Upstash Redis REST helpers ───────────────────────────────────────────────
async function redisGet(url, token, key) {
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  })
  const data = await res.json()
  return data.result ?? null
}

async function redisSet(url, token, key, value, exSeconds) {
  // Upstash REST: EX goes in the URL path, value is the raw body string
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/EX/${exSeconds}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: value,
    signal: AbortSignal.timeout(8000),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Upstash SET error: ${data.error}`)
}

// ─── In-memory fallback (single instance, dev only) ───────────────────────────
const memStore = new Map()

// ─── Report storage abstraction ───────────────────────────────────────────────
async function loadReports(redisUrl, redisToken) {
  if (redisUrl && redisToken) {
    try {
      const raw = await redisGet(redisUrl, redisToken, REPORTS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch (err) {
      console.error('Redis GET error:', err.message)
    }
  }
  return Array.from(memStore.values())
}

async function saveReports(redisUrl, redisToken, reports) {
  if (redisUrl && redisToken) {
    try {
      await redisSet(redisUrl, redisToken, REPORTS_KEY, JSON.stringify(reports), TTL_SECONDS)
      return { redis: true, error: null }
    } catch (err) {
      console.error('Redis SET error:', err.message)
      return { redis: false, error: err.message }
    }
  }
  memStore.clear()
  reports.forEach(r => memStore.set(r.id, r))
  return { redis: false, error: 'no_credentials' }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  // ── GET reports in bbox ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const north = parseFloat(url.searchParams.get('north') ?? '90')
    const south = parseFloat(url.searchParams.get('south') ?? '-90')
    const east  = parseFloat(url.searchParams.get('east')  ?? '180')
    const west  = parseFloat(url.searchParams.get('west')  ?? '-180')

    const all    = await loadReports(redisUrl, redisToken)
    const now    = new Date()
    // Return all non-expired reports (no bbox filter — reports are sparse, client renders only visible ones)
    const active = all.filter(r => new Date(r.expiresAt) > now)

    return new Response(JSON.stringify({
      reports: active,
      total: active.length,
      _debug: { using_redis: !!(redisUrl && redisToken), all_count: all.length }
    }), { headers: corsHeaders })
  }

  // ── POST new report ────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body     = await req.json()
    const { type, position } = body
    const allowed  = ['police', 'accident', 'speed_camera', 'hazard']

    if (!allowed.includes(type) || !position?.lat || !position?.lng) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: corsHeaders })
    }

    const id     = crypto.randomUUID()
    const now    = new Date()
    const report = {
      id, type,
      lat: position.lat,
      lng: position.lng,
      upvotes: 1, downvotes: 0, confirmed: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TTL_SECONDS * 1000).toISOString(),
    }

    // Load existing, purge expired, append new, save
    const all    = await loadReports(redisUrl, redisToken)
    const active = all.filter(r => new Date(r.expiresAt) > now)
    active.push(report)
    const saveResult = await saveReports(redisUrl, redisToken, active)

    return new Response(JSON.stringify({
      report,
      _debug: { ...saveResult, total_after: active.length }
    }), { status: 201, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
}
