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
/**
 * At the DEPLOY root, not under /pos/.
 *
 * Vite copies `public/*` to the root of `dist/`, and `scripts/build.mjs` moves
 * only `index.html` down into `dist/pos/`. So this file ships to
 * `/offline.html` alongside `/pos.webmanifest` and `/icons/`, and the worker
 * asked for `/pos/offline.html` -- a path that has never existed.
 *
 * The 404 was invisible: `cache.addAll` rejected, the `.catch` below swallowed
 * it, and the worker installed anyway with an empty cache. Every navigation
 * fallback since has had nothing to serve. Caching is not scope-limited (only
 * fetch INTERCEPTION is), so a /pos-scoped worker holding a root-level file is
 * fine.
 */
const OFFLINE_URL = '/offline.html';

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
    const fallback = () =>
      caches
        .match(request)
        .then((cached) => cached || caches.match(OFFLINE_URL))
        .then((hit) => hit || new Response('Offline', { status: 503 }));

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response) return fallback();

          // A navigation Request carries redirect mode "manual", so a 3xx from
          // the host arrives as an opaque-redirect response: type
          // 'opaqueredirect', status 0, no body. Handing it back is what lets
          // the browser follow the redirect. A naive `status === 200` gate
          // treats it as a failure instead -- and this is the FRONT DOOR: the
          // manifest's start_url is `/pos` while the document is at `/pos/`,
          // so any host that normalises a directory URL redirects on launch.
          // The cashier would tap the icon and land on the offline page while
          // fully online, with a reload doing the same thing again.
          if (response.type === 'opaqueredirect' || response.status === 0) return response;

          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
            return response;
          }

          // A 404 is a RESPONSE, not a network failure, so it never reached the
          // catch below -- the cashier got the host's error page while a
          // perfectly good shell sat in the cache. Only an actual error status
          // takes the offline route; anything else is passed through.
          if (response.status >= 400) return fallback();
          return response;
        })
        .catch(fallback),
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
