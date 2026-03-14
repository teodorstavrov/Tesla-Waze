// Minimal Service Worker — caches only map tiles
// API calls (/api/*) are NOT intercepted — go directly to network

const TILE_CACHE = 'map-tiles-v2'
const TILE_HOSTS = ['cartocdn.com', 'openstreetmap.org', 'tile.openstreetmap.org']

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Only intercept map tile requests — everything else goes straight to network
  if (TILE_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone())
            return res
          })
        })
      )
    )
  }
  // For /api/* and everything else: do NOT call event.respondWith()
  // → browser handles the request natively, no SW interference
})
