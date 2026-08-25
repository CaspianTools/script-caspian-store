'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useCaspianStandalone } from '../../provider/caspian-store-provider';
import { readLocalShopSettings, writeLocalShopSettings } from './local-db';
import { DEFAULT_LOCAL_SHOP_SETTINGS, type LocalShopSettings } from './types';

export interface PosShopSettingsValue {
  settings: LocalShopSettings;
  /** True until storage has answered. Never true on a cloud till. */
  loading: boolean;
  /** Re-read storage. The only path that touches IndexedDB after mount. */
  refresh: () => Promise<void>;
  /** Merge a change in and hold the result, so callers need no second read. */
  save: (patch: Partial<LocalShopSettings>) => Promise<LocalShopSettings>;
}

const PosShopSettingsContext = createContext<PosShopSettingsValue | null>(null);

const INERT: PosShopSettingsValue = Object.freeze({
  settings: DEFAULT_LOCAL_SHOP_SETTINGS,
  loading: false,
  refresh: async () => undefined,
  save: async () => DEFAULT_LOCAL_SHOP_SETTINGS,
});

/**
 * The shop record, read once for the whole till.
 *
 * It existed before this as three ad-hoc reads — the opening-cash gate, the
 * shop panel and App Admin each asked storage on their own — and that was
 * survivable while the only thing on it was a drawer switch nobody read twice.
 * The optional-screen flags are not survivable that way: the sidebar has to
 * know whether Categories is on before it renders a link to it, and the route
 * has to know before it decides whether the address resolves. An async read per
 * consumer would mean the menu grew an item a frame late on every navigation.
 *
 * Inert outside standalone mode, like `PosOpeningCashProvider`: a cloud till
 * has no local shop record, and `loading` starts at `standalone` so it never
 * flashes a skeleton for a feature it does not have.
 */
export function PosShopSettingsProvider({ children }: { children: ReactNode }) {
  const standalone = useCaspianStandalone();
  const [settings, setSettings] = useState<LocalShopSettings>(DEFAULT_LOCAL_SHOP_SETTINGS);
  const [loading, setLoading] = useState(standalone);

  const refresh = useCallback(async () => {
    if (!standalone) return;
    try {
      setSettings(await readLocalShopSettings());
    } catch {
      // Storage blocked. Fail towards the defaults, which is a till with the
      // optional screens off — the shape every shop had before this release,
      // and one where nothing a cashier needs is missing.
      setSettings(DEFAULT_LOCAL_SHOP_SETTINGS);
    }
  }, [standalone]);

  useEffect(() => {
    if (!standalone) {
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const next = await readLocalShopSettings();
        if (alive) setSettings(next);
      } catch {
        if (alive) setSettings(DEFAULT_LOCAL_SHOP_SETTINGS);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [standalone]);

  const save = useCallback(
    async (patch: Partial<LocalShopSettings>) => {
      // The write is awaited and its result held rather than re-read, because
      // IndexedDB fires no storage event: nothing above would otherwise notice
      // its own write until the next page load, which reads as a switch that
      // saves and then does nothing.
      const merged = await writeLocalShopSettings(patch);
      setSettings(merged);
      return merged;
    },
    [],
  );

  const value = useMemo<PosShopSettingsValue>(
    () => (standalone ? { settings, loading, refresh, save } : INERT),
    [standalone, settings, loading, refresh, save],
  );

  return (
    <PosShopSettingsContext.Provider value={value}>{children}</PosShopSettingsContext.Provider>
  );
}

/**
 * Never throws.
 *
 * `PosGuard` and `PosShell` are both public exports and either can be mounted
 * alone, so a screen asking about the shop's optional features must get an
 * answer whether or not the provider is above it. The answer with none above is
 * the defaults, which is every feature off.
 */
export function usePosShopSettings(): PosShopSettingsValue {
  return useContext(PosShopSettingsContext) ?? INERT;
}
