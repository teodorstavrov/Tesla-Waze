import { createClient } from 'redis'

const client = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 5000)
  }
})

client.on('error', (err) => console.error('[Redis] Error:', err))
client.on('connect', () => console.log('[Redis] Connected'))
client.on('reconnecting', () => console.log('[Redis] Reconnecting…'))

export async function initRedis(): Promise<void> {
  await client.connect()
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const val = await client.get(key)
    if (!val) return null
    return JSON.parse(val) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value))
  } catch (err) {
    console.error('[Redis] Set error:', err)
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await client.del(key)
  } catch {}
}

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached
  const fresh = await fetcher()
  await cacheSet(key, fresh, ttlSeconds)
  return fresh
}

export { client as redisClient }
