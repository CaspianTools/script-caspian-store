'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useCaspianStandalone } from '../../provider/caspian-store-provider';
import { usePosAutoBackup, type PosAutoBackupState } from './use-pos-auto-backup';

/**
 * One backup writer for the whole till.
 *
 * A context rather than a hook the panel calls directly, because the writer has
 * to run whether or not anybody is looking at the backup screen -- that is the
 * entire point of it -- and two copies would race each other writing the same
 * two files.
 */
const PosAutoBackupContext = createContext<PosAutoBackupState | null>(null);

const INERT: PosAutoBackupState = {
  supported: false,
  folder: null,
  folderName: null,
  permission: 'unsupported',
  lastOkMillis: 0,
  lastError: null,
  running: false,
  stale: false,
  backupNow: async () => undefined,
  refresh: async () => undefined,
};

export function PosAutoBackupProvider({ children }: { children: ReactNode }) {
  // Cloud tills have Firestore behind them and a whole admin panel to report
  // from; this exists for the till whose IndexedDB is the only copy.
  const standalone = useCaspianStandalone();
  const state = usePosAutoBackup(standalone);
  return <PosAutoBackupContext.Provider value={state}>{children}</PosAutoBackupContext.Provider>;
}

export function usePosAutoBackupState(): PosAutoBackupState {
  return useContext(PosAutoBackupContext) ?? INERT;
}
