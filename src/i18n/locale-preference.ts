'use client';

/**
 * Per-device UI language preference.
 *
 * Before v10.0.0 the library had no locale persistence at all: `locale` was a
 * bare prop on the provider, so "let the store admin pick a language" was not
 * expressible without the consumer building their own storage. This module is
 * that storage — deliberately tiny, deliberately synchronous, and deliberately
 * per-device rather than per-account, because the thing being configured is a
 * till or a back-office browser, not a person.
 *
 * It is an external store (not React state) so that every `LocaleProvider` in
 * the tree — including the nested one the POS mounts — re-renders together the
 * moment the preference changes, with no prop drilling and no reload.
 */

const STORAGE_KEY = 'caspian:locale';

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Mirrors localStorage so reads are cheap and, more importantly, so the value
 * stays correct when storage is unavailable (private mode, embedded webviews,
 * a browser configured to block site data). In those environments the choice
 * still applies for the session — it just doesn't survive a reload.
 */
let cached: string | null | undefined;

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/** The device's chosen locale, or `null` when it has never picked one. */
export function getDeviceLocale(): string | null {
  if (cached === undefined) cached = readStorage();
  return cached;
}

/**
 * Set (or, with `null`, clear) the device's locale and notify every provider.
 * Clearing falls the resolution chain back to the store default.
 */
export function setDeviceLocale(locale: string | null): void {
  const next = locale && locale.trim() ? locale.trim() : null;
  if (getDeviceLocale() === next) return;
  cached = next;
  if (typeof window !== 'undefined') {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked — the in-memory cache above still drives this session.
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeDeviceLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Server snapshot for `useSyncExternalStore`. Always `null` so the server
 * renders the store default and the client reconciles on hydration — reading
 * a device preference during SSR is impossible, and guessing produces a
 * hydration mismatch on every page.
 */
export function getDeviceLocaleServerSnapshot(): string | null {
  return null;
}

// --- Store default ---
//
// `LocaleProvider` sits ABOVE `ScriptSettingsProvider` in the provider tree,
// and that order is fixed. So the store's configured default locale cannot
// reach it through React context, and re-fetching `scriptSettings/site` inside
// LocaleProvider would both duplicate a network read and drag a Firestore
// dependency into a component that is deliberately mountable on its own.
//
// Instead `ScriptSettingsProvider` publishes the value here once it loads, and
// LocaleProvider subscribes. Same external-store machinery as the device
// preference above, one extra slot.

let storeDefault: string | null = null;

export function getStoreDefaultLocale(): string | null {
  return storeDefault;
}

export function setStoreDefaultLocale(locale: string | null): void {
  const next = locale && locale.trim() ? locale.trim() : null;
  if (storeDefault === next) return;
  storeDefault = next;
  for (const listener of listeners) listener();
}

export function getStoreDefaultLocaleServerSnapshot(): string | null {
  return null;
}
