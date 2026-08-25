/**
 * How safe the register's data actually is on this machine, and asking the
 * browser to make it safer.
 *
 * A standalone till holds the shop's only copy of its catalogue, its staff and
 * its entire trading history in IndexedDB. Browsers treat ordinary origin
 * storage as disposable: under disk pressure, or after a stretch without a
 * visit, the whole origin can be evicted with no warning and no recovery. The
 * one defence is `navigator.storage.persist()`, and until this module existed
 * it was requested in exactly one place -- inside the service-worker effect,
 * behind a `NODE_ENV === 'production'` early return -- so a till running
 * anything but a production build never asked at all.
 *
 * Deliberately free of React and of the standalone module, so the settings
 * screen, the register and a future check script can all use it.
 */

import { DB_NAME, DB_VERSION, openPosDb, posIdbAvailable } from './offline/pos-queue-db';

export interface PosStorageHealth {
  /** Whether the browser has promised not to evict this origin. */
  persisted: boolean;
  /** True when the browser has no opinion to offer -- old browser, or SSR. */
  unknown: boolean;
  /** Bytes this origin is using, when the browser will say. */
  usage: number | null;
  /** Bytes it is allowed, when the browser will say. */
  quota: number | null;
  /** The database itself, which is the thing that actually matters. */
  db: PosDbProbe;
}

export type PosDbProbe =
  | { state: 'ok'; version: number }
  /** Another tab is holding an older version open and blocking the upgrade. */
  | { state: 'blocked' }
  /** This build is older than the database on disk -- an upgrade was rolled back. */
  | { state: 'version-mismatch'; message: string }
  /** Site data is blocked, or IndexedDB is missing (private mode on some browsers). */
  | { state: 'unavailable'; message: string };

/**
 * Ask the browser to keep this origin. Idempotent, cheap, and safe to call on
 * every mount.
 *
 * An installed PWA is usually granted this silently; an ordinary tab is often
 * refused until the site has been used a few times. Refusal is not an error --
 * it is reported so the shop can be told to install the register, which is the
 * action that actually fixes it.
 */
export async function ensurePosStoragePersisted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Open the database for real and report what happened.
 *
 * `posIdbAvailable()` only asks whether the `indexedDB` global exists, which is
 * true in a browser with site data blocked and true in a tab whose open is
 * about to fail with a `VersionError`. Every screen that treated that as "the
 * store is fine" rendered a dead database as an empty one.
 */
export async function probePosDb(): Promise<PosDbProbe> {
  if (!posIdbAvailable()) {
    return { state: 'unavailable', message: 'IndexedDB is not available in this browser.' };
  }
  try {
    const db = await openPosDb();
    return { state: 'ok', version: db.version };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/blocked/i.test(message)) return { state: 'blocked' };
    // Thrown when the database on disk is NEWER than DB_VERSION -- i.e. this
    // build is behind one that already ran here. Naming both numbers is the
    // difference between a fixable report and "the sales are gone".
    if (error instanceof Error && (error.name === 'VersionError' || /version/i.test(message))) {
      return {
        state: 'version-mismatch',
        message: `${DB_NAME} on this computer is newer than this version of the register expects (wants ${DB_VERSION}).`,
      };
    }
    return { state: 'unavailable', message };
  }
}

export async function readPosStorageHealth(): Promise<PosStorageHealth> {
  const db = await probePosDb();

  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { persisted: false, unknown: true, usage: null, quota: null, db };
  }

  let persisted = false;
  let unknown = false;
  try {
    if (navigator.storage.persisted) persisted = await navigator.storage.persisted();
    else unknown = true;
  } catch {
    unknown = true;
  }

  let usage: number | null = null;
  let quota: number | null = null;
  try {
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage ?? null;
      quota = estimate.quota ?? null;
    }
  } catch {
    /* the estimate is a nicety; the persisted flag is the part that matters */
  }

  return { persisted, unknown, usage, quota, db };
}

/** Bytes as a shop would read them. Not localised -- these are units, not prose. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** True when the origin is close enough to its quota that a sale could fail to write. */
export function storageIsTight(health: PosStorageHealth): boolean {
  if (health.usage === null || health.quota === null || health.quota === 0) return false;
  return health.usage / health.quota > 0.9;
}
