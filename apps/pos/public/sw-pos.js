/**
 * Service worker for the Caspian POS register.
 *
 * Scope: /pos
 *
 * Responsibilities:
 * - Precache the app shell assets reported by the running page.
 * - Serve cached shell assets when offline (stale-while-revalidate).
 * - Never cache external APIs (Firebase, Google, payment providers).
 * - Do NOT skipWaiting on install; wait for the cashier to accept updates.
 */

const CACHE = 'caspian-pos-shell-v1';
const OFFLINE_URL = '/pos/offline.html';

self.addEventListener('install', (event) => {
  // The page will post the real asset list after registration. Until then,
  // cache the offline fallback only.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .catch(() => {}),
  );
  // Deliberately no skipWaiting(). A mid-sale register must not be taken over.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only clean our own cache family; leave storefront/service workers alone.
            .filter((k) => k.startsWith('caspian-pos-shell-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'caspian-pos-precache' && Array.isArray(event.data.assets)) {
    event.waitUntil(precacheAssets(event.data.assets));
    return;
  }

  if (event.data.type === 'caspian-pos-skip-waiting') {
    self.skipWaiting();
  }
});

async function precacheAssets(assets) {
  const requests = assets
    .map((url) => {
      try {
        return new URL(url, self.location.href).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!requests.length) return;

  const cache = await caches.open(CACHE);
  const toCache = [];
  for (const url of requests) {
    if (await cache.match(url)) continue;
    toCache.push(url);
  }
  if (!toCache.length) return;

  // Fetch each asset individually so one failure does not abort the batch.
  await Promise.all(
    toCache.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response && response.status === 200) {
          await cache.put(url, response);
        }
      } catch {
        // Best-effort precache; missing assets will be handled by fetch handler.
      }
    }),
  );
}

function isBypassed(url) {
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith('/api/')) return true;
  // Manifest can be served by the host with dynamic headers; do not cache it.
  if (url.pathname.endsWith('.webmanifest')) return true;
  return false;
}

function isStaticAsset(request, url) {
  const dest = request.destination;
  if (dest === 'script' || dest === 'style' || dest === 'font' || dest === 'image') return true;
  if (url.pathname.startsWith('/assets/')) return true;
  if (url.pathname.startsWith('/icons/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isBypassed(url)) return;

  // Navigation requests: try network, fall back to cached shell or offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((fallback) => fallback || new Response('Offline', { status: 503 })),
        ),
    );
    return;
  }

  // Static assets: stale-while-revalidate from cache.
  if (isStaticAsset(request, url)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone()).catch(() => {});
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
  }
});
