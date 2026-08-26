/**
 * Backups that land in a real folder on the computer, without anyone pressing
 * anything.
 *
 * The manual button next to this writes through `saveTextFile`, which fires a
 * download and depends entirely on somebody remembering. A standalone till
 * holds the shop's only copy of its trading history, so "remembering" is the
 * single point of failure the whole backup feature exists to remove.
 *
 * The File System Access API is Chromium-only. That is acceptable here and
 * nowhere else in this package: the register is installed as a PWA from Chrome
 * or Edge, which is the same requirement the install button already carries.
 * Firefox and Safari keep the manual download and are told so plainly -- a dead
 * button that silently does nothing is what this codebase keeps learning not to
 * ship.
 */

import { STORE_LOCAL_SETTINGS, idbDelete, idbGet, idbPut, posTx } from '../offline/pos-queue-db';

/**
 * The parts of the File System Access API this uses that TypeScript's DOM lib
 * still does not declare.
 *
 * Declared locally and NOT in a `declare global` block: this package is
 * published, and augmenting the global `Window` from library code collides with
 * a consumer who has `@types/wicg-file-system-access` installed.
 */
type FolderPermissionDescriptor = { mode: 'read' | 'readwrite' };

export interface BackupDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?(descriptor: FolderPermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor: FolderPermissionDescriptor): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<BackupDirectoryHandle>;
}

function picker(): DirectoryPickerWindow['showDirectoryPicker'] | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as DirectoryPickerWindow).showDirectoryPicker;
}

const FOLDER_KEY = 'backupFolder';

/** The rolling copy. Always the newest, always the same name, easy to point a sync client at. */
export const LATEST_BACKUP_FILENAME = 'caspian-till-latest.json';

/**
 * How many of the most recent dated files to keep, whatever day they fall on.
 *
 * This is the "undo the last few hours" window. It has to be counted rather
 * than dated, because a busy afternoon is where a shop actually wants to step
 * backwards through versions.
 */
export const RECENT_BACKUPS_KEPT = 12;

/**
 * How many days to keep one file from, on top of that.
 *
 * The two numbers exist because one number could not do the job. A single
 * keep-count of 30 sounded like a month of history and was not: the writer
 * makes a file after every sale, so a till taking forty sales a day burned
 * through the whole allowance before lunch and the oldest "backup" on disk was
 * two hours old. Bucketing by day is what makes the folder a history instead of
 * a rolling window.
 */
export const DAILY_BACKUPS_KEPT = 30;

export type BackupFolderPermission = 'granted' | 'prompt' | 'denied' | 'unsupported';

export function backupFolderSupported(): boolean {
  return typeof picker() === 'function';
}

/**
 * Ask for a folder. Must be called from a click -- the picker refuses otherwise.
 *
 * Returns `null` when the person cancels, which is not an error and must not be
 * reported as one.
 */
export async function pickBackupFolder(): Promise<BackupDirectoryHandle | null> {
  const show = picker();
  if (!show) return null;
  let handle: BackupDirectoryHandle;
  try {
    handle = await show({ mode: 'readwrite', startIn: 'documents' });
  } catch {
    // The person pressed Escape. Not an error, and must never be reported as one.
    return null;
  }
  // Outside the catch above on purpose: a failure to remember the folder is a
  // real fault and has to reach the caller. Swallowing it here reported a
  // broken database as "they changed their mind", and the shop would have been
  // left believing backups were set up.
  await saveBackupFolder(handle);
  return handle;
}

/**
 * Kept in `localSettings` -- directory handles are structured-cloneable, so
 * IndexedDB stores them directly and the grant survives a restart.
 *
 * That store rather than `meta` because `meta` is in the cloud group that
 * `clearPosDb` wipes, and a support engineer clearing a stuck queue should not
 * silently turn a shop's backups off.
 */
async function saveBackupFolder(handle: BackupDirectoryHandle): Promise<void> {
  await posTx(STORE_LOCAL_SETTINGS, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_SETTINGS, { key: FOLDER_KEY, value: handle }),
  );
}

export async function readBackupFolder(): Promise<BackupDirectoryHandle | null> {
  if (!backupFolderSupported()) return null;
  try {
    const row = await posTx(STORE_LOCAL_SETTINGS, 'readonly', (tx) =>
      idbGet<{ key: string; value: BackupDirectoryHandle }>(tx, STORE_LOCAL_SETTINGS, FOLDER_KEY),
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function forgetBackupFolder(): Promise<void> {
  await posTx(STORE_LOCAL_SETTINGS, 'readwrite', (tx) =>
    idbDelete(tx, STORE_LOCAL_SETTINGS, FOLDER_KEY),
  );
}

/**
 * Chromium keeps the handle across restarts but drops the WRITE grant, so the
 * first backup after a cold start needs one click to re-authorise. `request`
 * is false for the automatic path, which must never pop a permission dialog
 * over a customer's sale; the panel passes true from a button.
 */
export async function backupFolderPermission(
  handle: BackupDirectoryHandle,
  request = false,
): Promise<BackupFolderPermission> {
  if (!backupFolderSupported()) return 'unsupported';
  const descriptor = { mode: 'readwrite' } as const;
  try {
    const current = await handle.queryPermission?.(descriptor);
    if (current === 'granted') return 'granted';
    if (!request) return current === 'denied' ? 'denied' : 'prompt';
    const asked = await handle.requestPermission?.(descriptor);
    return asked === 'granted' ? 'granted' : asked === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

export async function writeBackupFile(
  handle: BackupDirectoryHandle,
  filename: string,
  text: string,
): Promise<void> {
  const file = await handle.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(text);
  } catch (error) {
    // Abort, then rethrow the ORIGINAL fault. Closing a stream whose write
    // failed throws its own error, and a `finally { close() }` would replace
    // "the disk is full" with a stream complaint -- the wrong sentence entirely
    // for the one message a shop gets about its backups.
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
  // Closing is what commits the file, so it is the last thing and its failure
  // is the caller's to hear about.
  await writable.close();
}

/**
 * Thin the folder down to the last few files plus one a day.
 *
 * Only files matching the exact `caspian-till-<date>-<time>.json` shape are
 * ever considered, so nothing else a shop keeps in that folder can be deleted,
 * and the rolling `caspian-till-latest.json` is excluded by that pattern too.
 * This routine deletes things off somebody's disk, so the pattern is the whole
 * safety argument and must stay strict.
 */
export async function pruneDatedBackups(
  handle: BackupDirectoryHandle,
  keep: { recent?: number; days?: number } = {},
): Promise<void> {
  const recentToKeep = keep.recent ?? RECENT_BACKUPS_KEPT;
  const daysToKeep = keep.days ?? DAILY_BACKUPS_KEPT;
  const dated = /^caspian-till-(\d{4}-\d{2}-\d{2})-\d{4}\.json$/;

  const found: Array<{ name: string; day: string }> = [];
  for await (const [name, entry] of handle.entries()) {
    const match = entry.kind === 'file' ? dated.exec(name) : null;
    if (match) found.push({ name, day: match[1] });
  }
  // The stamp sorts lexicographically in date order, so this is chronological.
  found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const keepSet = new Set<string>();
  for (const file of found.slice(-recentToKeep)) keepSet.add(file.name);

  // Ascending order means the last write for a day wins its bucket.
  const newestPerDay = new Map<string, string>();
  for (const file of found) newestPerDay.set(file.day, file.name);
  const days = [...newestPerDay.keys()].sort().slice(-daysToKeep);
  for (const day of days) {
    const newest = newestPerDay.get(day);
    if (newest) keepSet.add(newest);
  }

  for (const file of found) {
    if (keepSet.has(file.name)) continue;
    await handle.removeEntry(file.name).catch(() => undefined);
  }
}
