'use client';

import { DEFAULT_SCAN_GAP_MS } from './hardware/use-barcode-scanner';
import type { PosStorageMode } from './storage/types';

/**
 * Register preferences that belong to the computer, not the store.
 *
 * Scanner timing, printer transport and storage mode are all properties of the
 * hardware sitting on one counter — a slow Bluetooth scanner at the back till
 * has nothing to say about the USB one at the front. Keeping them out of
 * Firestore also means they still work in standalone local mode, where there
 * is no Firestore at all.
 */

const SCAN_GAP_KEY = 'caspian:pos:scanGapMs';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked; the caller falls back to defaults for this session.
  }
}

/** Clamped hard: a gap of 0 makes every scan fail, and 1000 turns typing into scans. */
export function readScannerGapMs(): number {
  const raw = Number.parseInt(read(SCAN_GAP_KEY) ?? '', 10);
  if (!Number.isFinite(raw)) return DEFAULT_SCAN_GAP_MS;
  return Math.min(300, Math.max(10, raw));
}

export function writeScannerGapMs(value: number): void {
  write(SCAN_GAP_KEY, String(Math.min(300, Math.max(10, Math.round(value)))));
}

/*
 * `readPrinterTransport` / `writePrinterTransport` and `readStorageMode` /
 * `writeStorageMode` used to live here and were removed in v12.0.0. Nothing
 * called any of them: the printer control at `/pos/settings` is hard-coded to
 * the browser transport until the ESC/POS paths ship, and the storage mode is
 * derived below rather than stored. A stored preference that nothing reads is
 * worse than no preference at all — it looks settable.
 */

/**
 * What mode the register actually runs in.
 *
 * Decided by the deployment, and nowhere else — which is why the stored
 * preference this used to consult was deleted rather than merely ignored. A
 * till wired to a Firebase project is a cloud till; one mounted with
 * `standalone` is a local till, and there is nothing to choose between at the
 * counter.
 *
 * The per-device switch this replaced was a trap. A cloud shop that picked
 * "this computer only" got a register backed by an empty local catalogue and no
 * way to fill it: the local back office is part of a standalone deployment, so
 * it was not there. The result looked exactly like a till that had lost its
 * products. Reflecting the mode is honest; offering it as a choice was not.
 */
export function resolvePosStorageMode(firebaseAvailable: boolean): PosStorageMode {
  return firebaseAvailable ? 'cloud' : 'local';
}

/* ------------------------------------------------------------ appearance */

const THEME_KEY = 'caspian:pos:theme';
const RAIL_KEY = 'caspian:pos:navRail';

/**
 * Light, dark, or whatever the operating system says.
 *
 * Belongs with the scanner gap rather than in Firestore for the same reason:
 * one counter faces a window and another is in a stockroom, and the shop has
 * no opinion about either. `system` is the default so a till inherits whatever
 * the tablet already does at dusk.
 */
export type PosThemeMode = 'light' | 'dark' | 'system';

export function readThemeMode(): PosThemeMode {
  const raw = read(THEME_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function writeThemeMode(value: PosThemeMode): void {
  write(THEME_KEY, value);
}

/** Whether the side menu is parked as an icon rail. Defaults to open. */
export function readNavRail(): boolean {
  return read(RAIL_KEY) === '1';
}

export function writeNavRail(value: boolean): void {
  write(RAIL_KEY, value ? '1' : '0');
}

/* ------------------------------------------------------------- idle lock */

const IDLE_LOCK_KEY = 'caspian:pos:idleLockMinutes';

/**
 * Fired on `window` after the idle-lock time changes in *this* tab.
 *
 * The browser's own `storage` event covers every tab except the one that wrote
 * the value, which leaves out the only case an owner ever sees: picking a time
 * at /pos/settings and pressing Save. `PosLockGate` listens for both.
 *
 * Not exported through the barrels -- it is a detail shared by two files inside
 * the till, not part of the library's surface.
 */
export const IDLE_LOCK_CHANGED_EVENT = 'caspian:pos:idle-lock-changed';

/** Off. A change of software must never be the reason a queue stops. */
export const DEFAULT_IDLE_LOCK_MINUTES = 0;

/** What the settings screen offers. `0` is never, and it is where every till starts. */
export const IDLE_LOCK_CHOICES: readonly number[] = [0, 1, 5, 15, 30, 60];

/**
 * How long the till may sit untouched before it covers the screen.
 *
 * A device preference, beside the scanner gap and the theme, because it is a
 * fact about where the machine stands: a till behind a counter in sight of the
 * owner all day wants this off, and one in a stockroom nobody watches wants it
 * on. The shop has no single answer.
 *
 * Zero -- never -- is the default and the value every existing till reads back,
 * so nothing changes for anybody who does not go and switch it on. The lock
 * covers the screen without ending the session: the account, the sign-in id and
 * the open ticket all survive it, because a lock that signed the cashier out
 * would send them back through the drawer-count gate every time they turned
 * round to serve somebody.
 */
export function readIdleLockMinutes(): number {
  const raw = Number(read(IDLE_LOCK_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_IDLE_LOCK_MINUTES;
  // Clamped the way the scanner gap is: a stored value nothing can produce
  // through the UI still has to behave, and an eight-hour lock is the same as
  // no lock while being much harder to diagnose.
  return Math.min(60, Math.max(1, Math.round(raw)));
}

export function writeIdleLockMinutes(value: number): void {
  write(IDLE_LOCK_KEY, String(value > 0 ? Math.min(60, Math.max(1, Math.round(value))) : 0));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(IDLE_LOCK_CHANGED_EVENT));
}
