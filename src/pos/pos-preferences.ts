'use client';

import { DEFAULT_SCAN_GAP_MS } from './hardware/use-barcode-scanner';
import type { PosPrinterTransport } from '../types';
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
const PRINTER_KEY = 'caspian:pos:printer';
const STORAGE_MODE_KEY = 'caspian:pos:storageMode';

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

export function readPrinterTransport(): PosPrinterTransport {
  const raw = read(PRINTER_KEY);
  return raw === 'webserial' || raw === 'webusb' ? raw : 'browser';
}

export function writePrinterTransport(value: PosPrinterTransport): void {
  write(PRINTER_KEY, value);
}

export function readStorageMode(): PosStorageMode {
  return read(STORAGE_MODE_KEY) === 'local' ? 'local' : 'cloud';
}

export function writeStorageMode(value: PosStorageMode): void {
  write(STORAGE_MODE_KEY, value);
}
