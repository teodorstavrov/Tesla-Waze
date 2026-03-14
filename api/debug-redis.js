// Temporary debug endpoint — tests Redis read/write
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'Redis env vars missing' }), { headers })
  }

  const testKey = 'teslawaze_debug_test'
  const testVal = `ok-${Date.now()}`
  const result  = { set: null, get: null, match: false, error: null }

  try {
    // SET
    const setRes  = await fetch(`${url}/set/${testKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([testVal, 'EX', 60]),
      signal: AbortSignal.timeout(8000),
    })
    const setData = await setRes.json()
    result.set = setData

    // GET
    const getRes  = await fetch(`${url}/get/${testKey}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    const getData = await getRes.json()
    result.get   = getData
    result.match = getData.result === testVal
  } catch (err) {
    result.error = err.message
  }

  return new Response(JSON.stringify(result, null, 2), { headers })
}
