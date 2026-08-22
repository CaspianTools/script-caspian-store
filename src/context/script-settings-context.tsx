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
  children,
}: {
  collections: CaspianCollections;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<ScriptSettings>(() => defaultsWithTimestamp());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
  }, [collections]);

  const save = useCallback(
    async (updates: Partial<Omit<ScriptSettings, 'id' | 'updatedAt'>>) => {
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
