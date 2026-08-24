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
