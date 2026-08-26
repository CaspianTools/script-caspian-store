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
import {
  readNavRail,
  readThemeMode,
  writeNavRail,
  writeThemeMode,
  type PosThemeMode,
} from '../pos-preferences';

/**
 * State the register's chrome owns: how dark it is and how much room the side
 * menu takes.
 *
 * Both are device preferences (see `pos-preferences.ts`) rather than store
 * settings, and both are read once on mount rather than during render — a till
 * rendered on a server has no localStorage, and reading it during the first
 * render would make the server and client markup disagree.
 */

export interface PosChromeValue {
  /** What the operator asked for. */
  themeMode: PosThemeMode;
  /** What that resolves to right now, once `system` is followed. */
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: PosThemeMode) => void;
  /** Cycles light -> dark -> system, which is what a single header button needs. */
  cycleTheme: () => void;

  /** The side menu is parked as an icon rail. Only meaningful on a wide screen. */
  rail: boolean;
  toggleRail: () => void;

  /**
   * The viewport is too narrow to give the menu a permanent column, so it
   * becomes an overlay drawer instead.
   */
  compact: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const PosChromeContext = createContext<PosChromeValue | null>(null);

/**
 * Below this the side menu stops being free. A 1024px tablet in landscape keeps
 * it; the same tablet turned portrait gets the drawer, because 248px out of 768
 * is a third of the ticket.
 */
const COMPACT_QUERY = '(max-width: 1024px)';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToQuery(query: string, onChange: (matches: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(query);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  mql.addEventListener('change', handler);
  onChange(mql.matches);
  return () => mql.removeEventListener('change', handler);
}

export function PosChromeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<PosThemeMode>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [rail, setRail] = useState(false);
  const [compact, setCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setThemeModeState(readThemeMode());
    setRail(readNavRail());
  }, []);

  useEffect(() => subscribeToQuery(DARK_QUERY, setSystemDark), []);
  useEffect(() => subscribeToQuery(COMPACT_QUERY, setCompact), []);

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  /**
   * Written to `<html>` rather than to the shell element because `DropdownMenu`,
   * `Dialog` and the toast stack all portal into `document.body`. A menu opened
   * from a dark till would otherwise come back white.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-cpos-theme', resolvedTheme);
    return () => root.removeAttribute('data-cpos-theme');
  }, [resolvedTheme]);

  // A drawer left open across a rotation to landscape would sit over a layout
  // that already has room for the menu.
  useEffect(() => {
    if (!compact) setDrawerOpen(false);
  }, [compact]);

  const setThemeMode = useCallback((mode: PosThemeMode) => {
    setThemeModeState(mode);
    writeThemeMode(mode);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeModeState((current) => {
      const next: PosThemeMode =
        current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
      writeThemeMode(next);
      return next;
    });
  }, []);

  const toggleRail = useCallback(() => {
    setRail((current) => {
      writeNavRail(!current);
      return !current;
    });
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<PosChromeValue>(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      cycleTheme,
      rail,
      toggleRail,
      compact,
      drawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [themeMode, resolvedTheme, setThemeMode, cycleTheme, rail, toggleRail, compact, drawerOpen, openDrawer, closeDrawer],
  );

  return <PosChromeContext.Provider value={value}>{children}</PosChromeContext.Provider>;
}

export function usePosChrome(): PosChromeValue {
  const value = useContext(PosChromeContext);
  if (!value) throw new Error('usePosChrome must be used inside <PosChromeProvider>');
  return value;
}
