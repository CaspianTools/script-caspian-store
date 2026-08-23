'use client';

import { useEffect } from 'react';

/**
 * Registers a service worker (production only) so a consumer site is installable
 * and has an offline fallback. Renders nothing — same pattern as
 * `DynamicFavicon`. The consumer ships the worker file (default `/sw.js`); a
 * minimal reference implementation lives in `examples/nextjs/public/sw.js`.
 */
export interface ServiceWorkerRegisterProps {
  /** Path to the service worker file. Default `/sw.js`. */
  src?: string;
  /** Scope for the worker. Default `/`. */
  scope?: string;
  /**
   * Register outside production builds too. Off by default — but offline
   * behaviour is untestable under `npm run dev` without it.
   */
  enableInDev?: boolean;
}

export function ServiceWorkerRegister({
  src = '/sw.js',
  scope = '/',
  enableInDev = false,
}: ServiceWorkerRegisterProps = {}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && !enableInDev) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register(src, { scope }).catch(() => {
        /* best-effort — the site works without it */
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, [src, scope, enableInDev]);

  return null;
}
