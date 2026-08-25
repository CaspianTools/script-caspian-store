'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLocalBackup, localBackupFilename } from './local-backup';
import {
  LATEST_BACKUP_FILENAME,
  backupFolderPermission,
  backupFolderSupported,
  pruneDatedBackups,
  readBackupFolder,
  writeBackupFile,
  type BackupDirectoryHandle,
  type BackupFolderPermission,
} from './local-backup-folder';

/**
 * How long after the last write before an idle till backs itself up again.
 *
 * Long, on purpose. The backup that matters is the one taken right after a sale
 * -- this interval only exists so a till left running for a day still produces
 * a file, and making it short would rewrite megabytes of JSON at a counter
 * nobody is standing at.
 */
const IDLE_INTERVAL_MS = 30 * 60 * 1000;

/** Coalesces a burst -- a cashier ringing four customers gets one backup, not four. */
const AFTER_SALE_DEBOUNCE_MS = 20 * 1000;

/** Past this without a successful backup, the panel stops being informational and goes red. */
export const BACKUP_STALE_MS = 24 * 60 * 60 * 1000;

const LAST_OK_KEY = 'caspian:pos:lastAutoBackup';

function readLastOk(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return Number.parseInt(window.localStorage.getItem(LAST_OK_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeLastOk(at: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_OK_KEY, String(at));
  } catch {
    /* storage blocked; the in-memory value still drives this session's UI */
  }
}

export interface PosAutoBackupState {
  supported: boolean;
  /** Null until the stored handle has been read, then null only if none is set. */
  folder: BackupDirectoryHandle | null;
  folderName: string | null;
  permission: BackupFolderPermission;
  lastOkMillis: number;
  lastError: string | null;
  running: boolean;
  stale: boolean;
  /** Force one now, from a button. May prompt for permission. */
  backupNow: () => Promise<void>;
  /** Re-read the stored handle and its permission, after the folder was changed. */
  refresh: () => Promise<void>;
}

/**
 * Writes the whole till to a folder on the computer, unprompted.
 *
 * Two files per run. The dated one is the history a shop keeps; the rolling
 * `caspian-till-latest.json` is the one to point a cloud-sync client at. The
 * rolling copy is written LAST because `createWritable` truncates on open -- a
 * crash mid-write leaves a zero-length file, and it must never be the only
 * up-to-date copy when that happens.
 */
export function usePosAutoBackup(enabled: boolean): PosAutoBackupState {
  const [folder, setFolder] = useState<BackupDirectoryHandle | null>(null);
  const [permission, setPermission] = useState<BackupFolderPermission>(
    backupFolderSupported() ? 'prompt' : 'unsupported',
  );
  const [lastOkMillis, setLastOkMillis] = useState(0);
  /**
   * A clock the staleness check can actually see move.
   *
   * `stale` was derived from `Date.now()` inside a memo keyed on the last
   * success, so on a till that is never restarted -- which is most of them --
   * the "no backup for a day" warning could never appear. It is the only thing
   * standing between a shop and a silent year of no backups.
   */
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [lastError, setLastError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    setLastOkMillis(readLastOk());
  }, []);

  const refresh = useCallback(async () => {
    if (!backupFolderSupported()) {
      setPermission('unsupported');
      return;
    }
    const handle = await readBackupFolder();
    setFolder(handle);
    setPermission(handle ? await backupFolderPermission(handle) : 'prompt');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const run = useCallback(
    async (mayPrompt: boolean) => {
      // Claimed before the first await, and released in a finally that covers
      // everything after it. The guard used to be set two awaits later, so a
      // sale and the idle timer landing together both got past the check, wrote
      // the same two files at once, and then each cleared the other's flag.
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const handle = folder ?? (await readBackupFolder());
        if (!handle) return;

        // The automatic path never prompts: a permission dialog appearing over
        // a customer's sale is worse than a backup arriving a few minutes late.
        const granted = await backupFolderPermission(handle, mayPrompt);
        setPermission(granted);
        if (granted !== 'granted') {
          if (mayPrompt) setLastError('permission');
          return;
        }

        setRunning(true);
        try {
          const text = JSON.stringify(await buildLocalBackup(), null, 2);
          // Dated first, rolling second. `createWritable` truncates on open, so
          // a crash mid-write leaves a zero-length file -- and the rolling copy
          // must never be the one truncated while it is the newest data there is.
          await writeBackupFile(handle, localBackupFilename(), text);
          await writeBackupFile(handle, LATEST_BACKUP_FILENAME, text);
          await pruneDatedBackups(handle).catch(() => undefined);
          const now = Date.now();
          writeLastOk(now);
          setLastOkMillis(now);
          setLastError(null);
        } catch (error) {
          setLastError(error instanceof Error ? error.message : String(error));
        } finally {
          setRunning(false);
        }
      } finally {
        inFlight.current = false;
      }
    },
    [folder],
  );

  const schedule = useCallback(
    (delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void run(false), delay);
    },
    [run],
  );

  // A sale is the event worth backing up after; the idle timer is only a floor.
  useEffect(() => {
    if (!enabled || !folder) return;
    const onSale = () => schedule(AFTER_SALE_DEBOUNCE_MS);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void run(false);
    };
    window.addEventListener('caspian-pos-sale-committed', onSale);
    document.addEventListener('visibilitychange', onHidden);
    const idle = setInterval(() => {
      setNowTick(Date.now());
      void run(false);
    }, IDLE_INTERVAL_MS);
    return () => {
      window.removeEventListener('caspian-pos-sale-committed', onSale);
      document.removeEventListener('visibilitychange', onHidden);
      clearInterval(idle);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, folder, run, schedule]);

  const backupNow = useCallback(() => run(true), [run]);

  const folderName = folder?.name ?? null;
  const stale = useMemo(() => {
    if (!folder) return false;
    return nowTick - lastOkMillis > BACKUP_STALE_MS;
  }, [folder, lastOkMillis, nowTick]);

  return {
    supported: backupFolderSupported(),
    folder,
    folderName,
    permission,
    lastOkMillis,
    lastError,
    running,
    stale,
    backupNow,
    refresh,
  };
}

/** Fired by the register after a sale lands, so a backup follows it. */
export function announcePosSaleCommitted(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('caspian-pos-sale-committed'));
}
