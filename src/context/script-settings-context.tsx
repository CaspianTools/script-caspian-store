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
import { getDoc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import type { CaspianCollections } from '../firebase/collections';
import {
  DEFAULT_SCRIPT_SETTINGS,
  type ScriptSettings,
} from '../types';
import { setStoreDefaultLocale } from '../i18n/locale-preference';

interface ScriptSettingsContextValue {
  settings: ScriptSettings;
  loading: boolean;
  saving: boolean;
  save: (updates: Partial<Omit<ScriptSettings, 'id' | 'updatedAt'>>) => Promise<void>;
  reset: () => Promise<void>;
}

const ScriptSettingsContext = createContext<ScriptSettingsContextValue | null>(null);

function defaultsWithTimestamp(): ScriptSettings {
  return { ...DEFAULT_SCRIPT_SETTINGS, updatedAt: Timestamp.now() };
}

export function ScriptSettingsProvider({
  collections,
  seed,
  children,
}: {
  /** `null` on a standalone till, where there is no Firestore to subscribe to. */
  collections: CaspianCollections | null;
  /**
   * Settings to use instead of the Firestore document. Only consulted when
   * `collections` is null — a store with a project always reads the real thing,
   * because a seed that silently overrode live settings would be undebuggable.
   */
  seed?: Partial<ScriptSettings>;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<ScriptSettings>(() => defaultsWithTimestamp());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // No project: the seed is the whole of the truth. Resolving `loading`
    // immediately matters — this provider gates `PosGuard`, and a standalone
    // till left waiting on a subscription that will never fire would render a
    // skeleton forever instead of a register.
    if (!collections) {
      const next = { ...defaultsWithTimestamp(), ...seed };
      setSettings(next);
      setStoreDefaultLocale(next.defaultLocale ?? null);
      setLoading(false);
      return;
    }
    const ref = collections.scriptSettingsDoc;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.exists()
          ? { ...defaultsWithTimestamp(), ...(snap.data() as ScriptSettings) }
          : defaultsWithTimestamp();
        setSettings(next);
        // LocaleProvider mounts ABOVE this provider and the order is fixed, so
        // the store's default language cannot reach it through context.
        // Publishing it to the locale external store is how it gets there
        // without a second read of this same document.
        setStoreDefaultLocale(next.defaultLocale ?? null);
        setLoading(false);
      },
      (error) => {
        console.error('[caspian-store] Failed to subscribe to script settings:', error);
        setLoading(false);
      },
    );
    return unsub;
  }, [collections, seed]);

  const save = useCallback(
    async (updates: Partial<Omit<ScriptSettings, 'id' | 'updatedAt'>>) => {
      if (!collections) {
        throw new Error(
          'Script settings cannot be saved on a standalone till — there is no Firestore project. Shop settings live in the local admin panel instead.',
        );
      }
      setSaving(true);
      try {
        const ref = collections.scriptSettingsDoc;
        const existing = await getDoc(ref);
        const merged: ScriptSettings = {
          ...(existing.exists() ? (existing.data() as ScriptSettings) : defaultsWithTimestamp()),
          ...updates,
          id: 'site',
          updatedAt: Timestamp.now(),
        };
        await setDoc(ref, merged, { merge: true });
      } finally {
        setSaving(false);
      }
    },
    [collections],
  );

  const reset = useCallback(async () => {
    await save({ ...DEFAULT_SCRIPT_SETTINGS });
  }, [save]);

  const value = useMemo(
    () => ({ settings, loading, saving, save, reset }),
    [settings, loading, saving, save, reset],
  );

  return (
    <ScriptSettingsContext.Provider value={value}>{children}</ScriptSettingsContext.Provider>
  );
}

export function useScriptSettings() {
  const ctx = useContext(ScriptSettingsContext);
  if (!ctx) {
    throw new Error('useScriptSettings must be called inside <CaspianStoreProvider>.');
  }
  return ctx;
}
