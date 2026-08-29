'use client';

import { useEffect, useState } from 'react';
import { usePosT as useT } from '../i18n/use-pos-t';

/**
 * Registers the register's own service worker at scope `/pos`.
 *
 * Separate from the storefront worker on purpose. Two workers share one
 * `CacheStorage` per origin, so each must own a cache-key prefix and clean up
 * only its own — the reference `sw.js` deletes every key that is not its own on
 * activate, which would wipe the register's shell out from under a till.
 *
 * Two deliberate refusals:
 *
 * - **No `skipWaiting()`.** A new worker never takes over a page that is mid-sale.
 *   The update is offered, and applies on the next launch or when the cashier
 *   accepts it between customers.
 * - **No build-time asset manifest.** The library cannot know a consumer's
 *   bundle filenames, so instead of guessing, the page tells the worker what it
 *   is actually made of: after registration it reads its own same-origin
 *   `<script src>` and `<link rel=stylesheet href>` and posts them across to be
 *   cached. Whatever the framework emitted is what gets precached.
 */
export interface PosServiceWorkerProps {
  /** Path to the register's worker file. Default `/sw-pos.js`. */
  src?: string;
  /** Scope. Default `/pos`. Must match the manifest's scope. */
  scope?: string;
  /**
   * Register outside production builds too. Off by default, matching
   * `<ServiceWorkerRegister>` — but a feature whose whole subject is the network
   * being down is untestable without it, so it is reachable.
   */
  enableInDev?: boolean;
}

function sameOriginShellAssets(): string[] {
  if (typeof document === 'undefined') return [];
  const urls = new Set<string>();
  // The document itself, not only what it pulls in. A first visit has no
  // controlling worker, so `/pos/` was cached only as a by-product of the
  // SECOND visit's navigation -- leaving a whole-day window on a fresh install
  // where going offline meant the fallback page rather than the register.
  if (typeof location !== 'undefined') urls.add(location.pathname);
  const push = (raw: string | null) => {
    if (!raw) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin === location.origin) urls.add(url.pathname + url.search);
    } catch {
      /* a malformed src is not worth failing a cache warm-up over */
    }
  };
  document.querySelectorAll('script[src]').forEach((el) => push(el.getAttribute('src')));
  document
    .querySelectorAll('link[rel="stylesheet"][href]')
    .forEach((el) => push(el.getAttribute('href')));
  return [...urls];
}

export function PosServiceWorker({
  src = '/sw-pos.js',
  scope = '/pos',
  enableInDev = false,
}: PosServiceWorkerProps = {}) {
  const t = useT();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && !enableInDev) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const run = async () => {
      try {
        const reg = await navigator.serviceWorker.register(src, { scope, updateViaCache: 'none' });
        if (cancelled) return;

        // Ask the browser to keep this origin's storage. Installed apps get it
        // silently; an ordinary tab is usually refused, which is fine — this is
        // an upgrade, not a requirement.
        try {
          await navigator.storage?.persist?.();
        } catch {
          /* not supported, or refused */
        }

        const assets = sameOriginShellAssets();
        const target = reg.active ?? reg.installing ?? reg.waiting;
        if (target && assets.length) target.postMessage({ type: 'caspian-pos-precache', assets });

        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            // `controller` is null on the very first install — that is not an
            // update, it is the worker arriving, and must not show a prompt.
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(next);
            }
          });
        });
      } catch {
        /* best-effort — the register works without it, just not offline */
      }
    };

    if (document.readyState === 'complete') void run();
    else {
      const onLoad = () => void run();
      window.addEventListener('load', onLoad, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener('load', onLoad);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [src, scope, enableInDev]);

  if (!waiting || dismissed) return null;

  return (
    <div role="status" className="cpos-strip cpos-strip--brand">
      <span className="cpos-strip__spacer">{t('pos.update.available')}</span>
      <button
        type="button"
        onClick={() => {
          // Safe here and only here: the cashier chose this moment, so no sale
          // is mid-flight. The reload happens on controllerchange.
          waiting.postMessage({ type: 'caspian-pos-skip-waiting' });
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
            once: true,
          });
        }}
        className="cpos-btn cpos-btn--primary cpos-btn--sm"
      >
        {t('pos.update.apply')}
      </button>
      <button
        type="button"
        className="cpos-btn cpos-btn--ghost cpos-btn--sm"
        onClick={() => setDismissed(true)}
      >
        {t('pos.update.later')}
      </button>
    </div>
  );
}
