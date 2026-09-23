'use client';

import { useCallback, useEffect, useState } from 'react';
import { THEME_CATALOG } from './catalog';

const STORAGE_KEY = 'caspian:seen-theme-versions';

type SeenMap = Record<string, string>;

function readSeen(): SeenMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: SeenMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* localStorage full or disabled — silently skip */
  }
}

const BASELINE_VERSION = '1.0.0';

/**
 * Per-user "Updated" indicator state for theme cards.
 *
 * Each catalog theme exports a `version: string`. We store the last version an
 * admin has acknowledged per theme in `localStorage[STORAGE_KEY]`. When a
 * theme's current version differs from the seen version, its card shows the
 * "Updated" pill until the admin clicks Activate or Preview.
 *
 * On first-ever load (no localStorage entry), we silently seed every theme at
 * `BASELINE_VERSION = '1.0.0'`. This means: themes still at their baseline
 * (1.0.0) show no badge to a returning admin, while themes that have been
 * bumped above baseline (like cleanWhite@1.1.0 in v8.1) correctly flag as
 * Updated. New themes added in later releases — which won't have a seed entry
 * — also flag as Updated until the admin engages with them.
 */
export function useThemeUpdateTracker() {
  const [seen, setSeen] = useState<SeenMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let existing: string | null = null;
    try {
      existing = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage disabled — seed in memory only */
    }
    if (existing === null) {
      const seedSeed: SeenMap = {};
      for (const theme of THEME_CATALOG) seedSeed[theme.id] = BASELINE_VERSION;
      writeSeen(seedSeed);
      setSeen(seedSeed);
    } else {
      setSeen(readSeen());
    }
    setHydrated(true);
  }, []);

  const isUpdated = useCallback(
    (id: string, version: string): boolean => {
      if (!hydrated) return false;
      const lastSeen = seen[id];
      return lastSeen !== version;
    },
    [seen, hydrated],
  );

  const markSeen = useCallback((id: string, version: string) => {
    setSeen((prev) => {
      if (prev[id] === version) return prev;
      const next = { ...prev, [id]: version };
      writeSeen(next);
      return next;
    });
  }, []);

  return { isUpdated, markSeen };
}
