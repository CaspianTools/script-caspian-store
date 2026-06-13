/* Caspian Store example service worker — installability + offline fallback.
 *
 * Conservative on purpose: caches static build assets and serves an offline
 * page for failed navigations, but NEVER caches Firestore / auth / API traffic
 * (that would serve stale cart, prices, or auth state). Bump CACHE to ship an
 * updated worker; serve /sw.js with a no-cache header so clients re-check.
 */
const CACHE = 'caspian-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isBypassed(url) {
  if (url.origin !== self.location.origin) return true; // Firestore, Google APIs, CDNs
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.startsWith('/manifest.webmanifest')) return true;
  if (url.pathname.startsWith('/icon/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isBypassed(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || request.destination === 'font' || request.destination === 'style') {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res && res.status === 200) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
  }
});
