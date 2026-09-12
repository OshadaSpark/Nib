/**
 * The service worker, which keeps the app working offline: it caches the whole build when it
 * installs, then answers requests for the app's files from that cache. A new build installs a new
 * worker, which waits until every tab of the old one has closed, then replaces its cache.
 */

declare const self: ServiceWorkerGlobalScope

// Replaced when building (see `vite.config.ts`): the build's files, relative to the worker, and a
// version that changes with them.
declare const __PRECACHE__: string[]
declare const __VERSION__: string

const prefix = 'typer-'
const cacheName = prefix + __VERSION__

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(__PRECACHE__)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(prefix) && name !== cacheName)
            .map((name) => caches.delete(name)),
        ),
      ),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName)
      // Every page is the app, whose HTML is cached as `./`. A build's files are the same for every
      // request, whatever headers such as `Origin` a server says they vary by.
      const cached = await cache.match(request.mode === 'navigate' ? './' : request, {
        ignoreVary: true,
      })
      return cached ?? fetch(request)
    })(),
  )
})
