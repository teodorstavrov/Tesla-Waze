// Service Worker for Tesla Intelligence PWA
const CACHE_NAME = 'tesla-intelligence-v1'
const MAP_TILE_CACHE = 'map-tiles-v1'
const API_CACHE = 'api-cache-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== MAP_TILE_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Map tiles — cache first, long expiry
  if (url.hostname.includes('cartocdn.com') || url.hostname.includes('openstreetmap.org')) {
    event.respondWith(cacheFirst(request, MAP_TILE_CACHE, 7 * 24 * 3600))
    return
  }

  // API — network first with fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 60))
    return
  }

  // Static assets — cache first
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/)) {
    event.respondWith(cacheFirst(request, CACHE_NAME))
    return
  }

  // App shell — network first
  event.respondWith(networkFirst(request, CACHE_NAME))
})

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    // Check age if maxAge specified
    if (maxAgeSeconds) {
      const date = new Date(cached.headers.get('date') || 0)
      const age = (Date.now() - date.getTime()) / 1000
      if (age < maxAgeSeconds) return cached
    } else {
      return cached
    }
  }

  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return cached || new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
