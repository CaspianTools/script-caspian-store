'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { DEFAULT_MESSAGES, interpolate, isRtl, type MessageDict } from './messages';
import { BUILTIN_LOCALES } from './locales';
import {
  getDeviceLocale,
  getDeviceLocaleServerSnapshot,
  getStoreDefaultLocale,
  getStoreDefaultLocaleServerSnapshot,
  setDeviceLocale,
  subscribeDeviceLocale,
} from './locale-preference';

export type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

interface LocaleContextValue {
  locale: string;
  messages: MessageDict;
  t: TranslateFn;
  dir: 'ltr' | 'rtl';
  /** True when the active locale came from a `locale` prop rather than the device preference. */
  pinned: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export interface LocaleProviderProps {
  /**
   * Pin the locale (e.g. `en`, `az`, `fr-CA`). When set it wins outright and
   * the device preference is ignored — that is the contract consumers who
   * drive locale from the URL already rely on. Leave it unset to let the
   * device preference and the store default resolve it.
   */
  locale?: string;
  /**
   * Store-wide default, normally `ScriptSettings.defaultLocale`. Used when the
   * device has not chosen a language of its own. `CaspianStoreProvider` passes
   * this down; `LocaleProvider` stays free of Firestore so it can still be
   * mounted standalone.
   */
  storeDefaultLocale?: string;
  /** Flat message dict for the active locale. Missing keys fall back to DEFAULT_MESSAGES. */
  messages?: MessageDict;
  /**
   * Alternative to `messages` — pass dictionaries for several locales at once.
   * The active locale selects which one is applied (with `en-US` → `en`
   * fallback). Merged *above* the built-in dictionaries, so a consumer can
   * correct or extend a shipped translation without waiting on a release.
   */
  messagesByLocale?: Record<string, MessageDict>;
  children: ReactNode;
}

/**
 * Resolution order, most specific first:
 *
 *   1. the `locale` prop            — an explicit pin from the consumer
 *   2. the device preference        — what the operator picked on this computer
 *   3. `storeDefaultLocale`         — the store's configured default
 *   4. `'en'`
 *
 * Before v10.0.0 only step 1 and step 4 existed, so "let the store admin pick
 * a language" could not be expressed without the consumer building their own
 * persistence. Steps 2 and 3 are the addition; step 1 keeps its old precedence
 * precisely so no existing consumer changes behaviour on upgrade.
 */
export function LocaleProvider({
  locale,
  storeDefaultLocale,
  messages,
  messagesByLocale,
  children,
}: LocaleProviderProps) {
  const deviceLocale = useSyncExternalStore(
    subscribeDeviceLocale,
    getDeviceLocale,
    getDeviceLocaleServerSnapshot,
  );
  // Published by ScriptSettingsProvider, which mounts below this one. The
  // explicit prop still wins so a standalone LocaleProvider keeps working.
  const publishedStoreDefault = useSyncExternalStore(
    subscribeDeviceLocale,
    getStoreDefaultLocale,
    getStoreDefaultLocaleServerSnapshot,
  );

  const pinned = Boolean(locale);
  const active = locale || deviceLocale || storeDefaultLocale || publishedStoreDefault || 'en';

  const merged = useMemo<MessageDict>(() => {
    // `fr-CA` → `fr` when the exact tag has no dictionary.
    const primary = active.split('-')[0];
    const pick = (source?: Record<string, MessageDict>) =>
      source ? (source[active] ?? source[primary]) : undefined;

    return {
      ...DEFAULT_MESSAGES,
      ...(pick(BUILTIN_LOCALES) ?? {}),
      ...(pick(messagesByLocale) ?? {}),
      ...(messages ?? {}),
    };
  }, [active, messages, messagesByLocale]);

  const t = useCallback<TranslateFn>(
    (key, values) => interpolate(merged[key] ?? key, values),
    [merged],
  );

  const dir: 'ltr' | 'rtl' = isRtl(active) ? 'rtl' : 'ltr';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    // The custom property is kept for stylesheets that already read it. The
    // `dir` and `lang` attributes are what actually matter and were missing
    // before v10.0.0: without `dir`, an RTL locale rendered left-to-right no
    // matter what the CSS variable said, and without `lang` the browser picked
    // the wrong hyphenation, font fallbacks, and screen-reader voice.
    root.style.setProperty('--caspian-direction', dir);
    root.setAttribute('dir', dir);
    root.setAttribute('lang', active);
  }, [dir, active]);

  const value = useMemo(
    () => ({ locale: active, messages: merged, t, dir, pinned }),
    [active, merged, t, dir, pinned],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Access the translator. Falls back to the English defaults outside a provider. */
export function useT(): TranslateFn {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return (key, values) => interpolate(DEFAULT_MESSAGES[key] ?? key, values);
  }
  return ctx.t;
}

export function useLocale(): string {
  const ctx = useContext(LocaleContext);
  return ctx?.locale ?? 'en';
}

/** Returns the active layout direction (`ltr` or `rtl`). */
export function useDirection(): 'ltr' | 'rtl' {
  const ctx = useContext(LocaleContext);
  return ctx?.dir ?? 'ltr';
}

export interface LocaleControls {
  /** The locale in effect right now. */
  locale: string;
  /**
   * Change the language for this device. Pass `null` to clear the override and
   * fall back to the store default. Persisted in localStorage, so it survives
   * reloads and applies to every Caspian surface in this browser.
   */
  setLocale: (next: string | null) => void;
  /**
   * True when a `locale` prop is pinning the value, in which case `setLocale`
   * still records the preference but the visible language will not change
   * until the pin is removed. Surfaces that offer a picker should say so
   * rather than appear broken.
   */
  pinned: boolean;
}

/**
 * Read and change the device's language. This is what a language picker binds
 * to — the admin header switcher and the POS settings page both use it.
 */
export function useLocaleControls(): LocaleControls {
  const ctx = useContext(LocaleContext);
  const setLocale = useCallback((next: string | null) => setDeviceLocale(next), []);
  return { locale: ctx?.locale ?? 'en', setLocale, pinned: ctx?.pinned ?? false };
}

// --- Intl formatters (thin wrappers over native Intl, locale-aware) ---

export function useFormatNumber(options?: Intl.NumberFormatOptions) {
  const locale = useLocale();
  return useMemo(() => {
    try {
      return new Intl.NumberFormat(locale, options);
    } catch {
      return new Intl.NumberFormat('en', options);
    }
  }, [locale, options]);
}

export function useFormatCurrency(currency = 'USD', options?: Intl.NumberFormatOptions) {
  const locale = useLocale();
  return useMemo(() => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, ...options });
    } catch {
      return new Intl.NumberFormat('en', { style: 'currency', currency, ...options });
    }
  }, [locale, currency, options]);
}

export function useFormatDate(options?: Intl.DateTimeFormatOptions) {
  const locale = useLocale();
  return useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, options);
    } catch {
      return new Intl.DateTimeFormat('en', options);
    }
  }, [locale, options]);
}
