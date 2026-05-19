'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { FirebaseOptions } from 'firebase/app';
import { initCaspianFirebase, type CaspianFirebase } from '../firebase/client';
import { caspianCollections, type CaspianCollections } from '../firebase/collections';
import { readFirebaseConfigFromEnv } from '../firebase/env-config';
import {
  DefaultCaspianLink,
  DefaultCaspianImage,
  useDefaultCaspianNavigation,
  type FrameworkAdapters,
} from '../primitives';
import { AuthProvider } from '../context/auth-context';
import { CartProvider } from '../context/cart-context';
import { WishlistProvider } from '../context/wishlist-context';
import { ScriptSettingsProvider } from '../context/script-settings-context';
import { ThemeInjector } from '../context/theme-context';
import { FontLoader } from '../context/font-loader';
import { TemplateProvider } from './template-provider';
import { ToastProvider } from '../ui/toast';
import { LocaleProvider } from '../i18n/locale-context';
import type { MessageDict } from '../i18n/messages';
import { ErrorBoundary } from '../components/error-boundary';
import { logError } from '../services/error-log-service';

export interface CaspianStoreProviderProps {
  /** Firebase project config (apiKey, authDomain, projectId, etc.). */
  firebaseConfig: FirebaseOptions;
  /** Optional Cloud Functions region (default: us-central1). */
  functionsRegion?: string;
  /**
   * Framework-specific routing primitives. Strongly recommended — the defaults
   * cause full-page reloads. Pass `next/link` + `next/navigation`'s useRouter
   * for Next.js, or `react-router-dom`'s Link + a useNavigate wrapper.
   */
  adapters?: Partial<FrameworkAdapters>;
  /** Optional Firebase app name when mounting more than one store per page. */
  appName?: string;
  /** Locale code (BCP-47). Default: `en`. Does not change the messages dict on its own — pair with `messages` or `messagesByLocale`. */
  locale?: string;
  /** Partial or full message dictionary overriding the built-in English defaults. Missing keys fall through. */
  messages?: MessageDict;
  /**
   * Alternative to `messages` for multi-locale sites. Pass a map of `{ en: {...}, ar: {...} }`;
   * the active `locale` selects which one applies. Supports `fr-CA` → `fr` fallback.
   */
  messagesByLocale?: Record<string, MessageDict>;
  children: ReactNode;
}

export interface CaspianStoreContextValue {
  firebase: CaspianFirebase;
  collections: CaspianCollections;
  adapters: FrameworkAdapters;
}

const CaspianStoreContext = createContext<CaspianStoreContextValue | null>(null);

// SSR-injected window global key. The provider serializes the resolved
// Firebase config into a <script> tag during server prerender; the browser
// runs that script before React hydration so the same config is available
// client-side without requiring the consumer's next.config.mjs to forward
// FIREBASE_WEBAPP_CONFIG via an env: block. Firebase web client API keys are
// public by design (security relies on Firestore/Auth/Storage rules), so
// embedding them in the HTML is no different from the standard
// NEXT_PUBLIC_FIREBASE_* pattern.
const SSR_CONFIG_GLOBAL = '__CASPIAN_FIREBASE_CONFIG__';

function readSsrConfigFromWindow(): FirebaseOptions {
  if (typeof window === 'undefined') return {};
  const w = window as unknown as Record<string, FirebaseOptions | undefined>;
  return w[SSR_CONFIG_GLOBAL] ?? {};
}

function resolveFirebaseConfig(passed: FirebaseOptions): FirebaseOptions {
  // Precedence: passed values > SSR-injected window global > process.env env-config.
  // On server prerender, window is undefined → env wins. On client hydration,
  // window has the SSR-resolved config → it wins. Either way, passed always
  // takes precedence so explicit overrides keep working.
  const fromWindow = readSsrConfigFromWindow();
  const fromEnv = readFirebaseConfigFromEnv();
  return {
    apiKey: passed.apiKey || fromWindow.apiKey || fromEnv.apiKey,
    authDomain: passed.authDomain || fromWindow.authDomain || fromEnv.authDomain,
    projectId: passed.projectId || fromWindow.projectId || fromEnv.projectId,
    storageBucket: passed.storageBucket || fromWindow.storageBucket || fromEnv.storageBucket,
    messagingSenderId:
      passed.messagingSenderId || fromWindow.messagingSenderId || fromEnv.messagingSenderId,
    appId: passed.appId || fromWindow.appId || fromEnv.appId,
  };
}

export function CaspianStoreProvider({
  firebaseConfig,
  functionsRegion,
  adapters,
  appName,
  locale,
  messages,
  messagesByLocale,
  children,
}: CaspianStoreProviderProps) {
  const value = useMemo<CaspianStoreContextValue>(() => {
    const resolvedConfig = resolveFirebaseConfig(firebaseConfig);
    const firebase = initCaspianFirebase({
      config: resolvedConfig,
      functionsRegion,
      name: appName,
    });
    const collections = caspianCollections(firebase.db);
    const resolvedAdapters: FrameworkAdapters = {
      Link: adapters?.Link ?? DefaultCaspianLink,
      Image: adapters?.Image ?? DefaultCaspianImage,
      useNavigation: adapters?.useNavigation ?? useDefaultCaspianNavigation,
    };
    return { firebase, collections, adapters: resolvedAdapters };
    // Intentionally stable per mount; consumers should not swap these at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialize the resolved config so the browser sees the same values without
  // requiring next.config.mjs env: forwarding. Reads `app.options` (what
  // Firebase actually used) so the global mirrors reality even if a consumer
  // passes a partial config. The script runs at HTML parse time, before
  // React hydration, so the client useMemo above can read it via
  // readSsrConfigFromWindow().
  const ssrConfigJson = JSON.stringify(value.firebase.app.options);

  return (
    <CaspianStoreContext.Provider value={value}>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `window.${SSR_CONFIG_GLOBAL}=${ssrConfigJson};`,
        }}
      />
      <ErrorBoundary db={value.firebase.db} origin="CaspianStoreProvider">
        <GlobalErrorCapture db={value.firebase.db} projectId={firebaseConfig.projectId} />
        <LocationChangeBridge />
        <LocaleProvider locale={locale} messages={messages} messagesByLocale={messagesByLocale}>
          <ToastProvider>
            <AuthProvider firebase={value.firebase}>
              <CartProvider db={value.firebase.db}>
                <WishlistProvider db={value.firebase.db}>
                  <ScriptSettingsProvider collections={value.collections}>
                    <TemplateProvider>
                      <ThemeInjector />
                      <FontLoader />
                      {children}
                    </TemplateProvider>
                  </ScriptSettingsProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </LocaleProvider>
      </ErrorBoundary>
    </CaspianStoreContext.Provider>
  );
}

/**
 * Subscribes to `window.onerror` and `window.onunhandledrejection` for the
 * lifetime of the provider. Render-path errors are already covered by the
 * `ErrorBoundary` wrapper; this picks up the things React can't catch —
 * async throws from event handlers, timers, and unhandled promise
 * rejections. Added for mod1182.
 */
function GlobalErrorCapture({ db, projectId }: { db: CaspianFirebase['db']; projectId?: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onError = (ev: ErrorEvent) => {
      void logError(db, {
        source: 'client',
        origin: 'window.onerror',
        error: ev.error ?? ev.message,
        firebaseProjectId: projectId,
      });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      void logError(db, {
        source: 'client',
        origin: 'window.onunhandledrejection',
        error: ev.reason,
        firebaseProjectId: projectId,
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [db, projectId]);
  return null;
}

/**
 * Patches `history.pushState` and `history.replaceState` once per page so they
 * dispatch a `caspian:locationchange` event after updating history. URL-driven
 * library components (e.g. <SearchResultsPage>) listen for that event and
 * re-render on client-side navigation, even when the consumer's
 * `useNavigation` adapter doesn't expose a reactive `searchParams`.
 *
 * Why this and not a microtask after our own `useCaspianNavigation` push: the
 * Next.js App Router schedules `router.push` inside a React transition, so
 * `window.location.search` is not necessarily updated by the time the
 * microtask runs. Patching the History API guarantees the event fires
 * synchronously *after* the URL is updated, regardless of router internals or
 * whether the navigation went through our hook at all. Self-heals issue #43
 * without requiring consumer adapter edits.
 *
 * Idempotent: a window-level flag prevents double-patching across HMR
 * reloads or multiple `<CaspianStoreProvider>` mounts on the same page.
 */
function LocationChangeBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    type PatchedWindow = Window & { __caspianHistoryPatched?: boolean };
    const w = window as PatchedWindow;
    if (w.__caspianHistoryPatched) return;
    w.__caspianHistoryPatched = true;

    // Defer the event delivery to a microtask. Next.js's app-router calls
    // `history.pushState` from inside a `useInsertionEffect` during commit;
    // dispatching synchronously would trigger listeners whose state updates
    // (via `useReducer`) violate React's "useInsertionEffect must not
    // schedule updates" invariant. The microtask runs after commit completes
    // but before paint, so the listener's re-render is timely and the URL
    // is already updated (we dispatch *after* the original pushState
    // returns, so deferring does not reintroduce the v8.1.4 race).
    const dispatch = () => {
      queueMicrotask(() => window.dispatchEvent(new Event('caspian:locationchange')));
    };

    const origPushState = window.history.pushState.bind(window.history);
    const origReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = function (...args: Parameters<typeof origPushState>) {
      const result = origPushState(...args);
      dispatch();
      return result;
    };
    window.history.replaceState = function (...args: Parameters<typeof origReplaceState>) {
      const result = origReplaceState(...args);
      dispatch();
      return result;
    };
    // popstate fires natively on back/forward — components listen to it
    // directly, no patch needed.
  }, []);
  return null;
}

export function useCaspianStore(): CaspianStoreContextValue {
  const ctx = useContext(CaspianStoreContext);
  if (!ctx) {
    throw new Error(
      'useCaspianStore must be called inside <CaspianStoreProvider>. ' +
        'Wrap your app root with CaspianStoreProvider and pass your Firebase config.',
    );
  }
  return ctx;
}

/** Convenience hooks for framework adapters. */
export function useCaspianLink() {
  return useCaspianStore().adapters.Link;
}

export function useCaspianImage() {
  return useCaspianStore().adapters.Image ?? DefaultCaspianImage;
}

export function useCaspianNavigation() {
  const hook = useCaspianStore().adapters.useNavigation;
  return hook();
}

export function useCaspianCollections() {
  return useCaspianStore().collections;
}

export function useCaspianFirebase() {
  return useCaspianStore().firebase;
}
