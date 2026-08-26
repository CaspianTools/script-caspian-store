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
import { useCaspianStandalone } from '@caspian-explorer/script-caspian-store';
import { getPosDeviceId } from '../pos-device';
import {
  claimLocalTerminal,
  listLocalTerminals,
  releaseLocalTerminal,
  type ClaimTerminalResult,
} from './local-terminals';
import type { LocalTerminal } from './types';

export interface PosTerminalValue {
  /** True until the roster has been read. Never true on a cloud till. */
  loading: boolean;
  /** The counter this device answers to, or null when it has claimed none. */
  terminal: LocalTerminal | null;
  /**
   * How many counters the shop has named.
   *
   * The gate turns on this rather than on a setting: a shop that has named no
   * counter is a shop that has not asked for this, and giving it a switch to
   * leave off as well would be two things to understand instead of one.
   */
  rosterSize: number;
  /** True when the roster is non-empty and this device has claimed nothing. */
  mustClaim: boolean;
  claim: (typedCode: string) => Promise<ClaimTerminalResult>;
  release: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PosTerminalContext = createContext<PosTerminalValue | null>(null);

const INERT: PosTerminalValue = Object.freeze({
  loading: false,
  terminal: null,
  rosterSize: 0,
  mustClaim: false,
  claim: async () => ({ ok: false, reason: 'no-match' }) as ClaimTerminalResult,
  release: async () => undefined,
  refresh: async () => undefined,
});

/**
 * Which counter this machine is.
 *
 * Mounted unconditionally around the register like `PosOpeningCashProvider`, so
 * the screens below can be written once -- and doing no work at all outside
 * standalone mode, for the same reason: a cloud till must not pay an IndexedDB
 * round-trip, or a frame of skeleton, for a feature it does not have. `loading`
 * starts at `standalone` so a cloud till is inert on the first render and never
 * flashes.
 */
export function PosTerminalProvider({ children }: { children: ReactNode }) {
  const standalone = useCaspianStandalone();
  const [loading, setLoading] = useState(standalone);
  const [terminal, setTerminal] = useState<LocalTerminal | null>(null);
  const [rosterSize, setRosterSize] = useState(0);

  const read = useCallback(async () => {
    const deviceId = getPosDeviceId();
    const roster = await listLocalTerminals();
    setRosterSize(roster.length);
    setTerminal(roster.find((row) => row.claimedByDeviceId === deviceId) ?? null);
  }, []);

  useEffect(() => {
    if (!standalone) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        if (alive) await read();
      } catch {
        // Storage blocked or unavailable. Fail towards trading, as the
        // opening-cash gate does: an empty roster asks nobody for a code, so a
        // till whose IndexedDB is unreachable sells rather than showing a
        // cashier a screen they cannot get past.
        if (alive) {
          setRosterSize(0);
          setTerminal(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [standalone, read]);

  const refresh = useCallback(async () => {
    if (!standalone) return;
    try {
      await read();
    } catch {
      setRosterSize(0);
      setTerminal(null);
    }
  }, [standalone, read]);

  const claim = useCallback(
    async (typedCode: string): Promise<ClaimTerminalResult> => {
      if (!standalone) return { ok: false, reason: 'no-match' };
      const result = await claimLocalTerminal(typedCode, getPosDeviceId());
      if (result.ok) {
        setTerminal(result.terminal);
        // The roster may have grown on another screen since it was read.
        await refresh();
      }
      return result;
    },
    [standalone, refresh],
  );

  const release = useCallback(async () => {
    if (!standalone || !terminal) return;
    await releaseLocalTerminal(terminal.id);
    await refresh();
  }, [standalone, terminal, refresh]);

  const value = useMemo<PosTerminalValue>(
    () =>
      standalone
        ? {
            loading,
            terminal,
            rosterSize,
            mustClaim: !loading && rosterSize > 0 && !terminal,
            claim,
            release,
            refresh,
          }
        : INERT,
    [standalone, loading, terminal, rosterSize, claim, release, refresh],
  );

  return <PosTerminalContext.Provider value={value}>{children}</PosTerminalContext.Provider>;
}

/**
 * Returns the inert value rather than throwing when no provider is above.
 *
 * `PosShell` and `PosRegister` are public exports a consumer may mount on their
 * own page without the rest of the tree, and making this throw would turn a
 * standalone-only concern into a crash on every existing till.
 */
export function usePosTerminal(): PosTerminalValue {
  return useContext(PosTerminalContext) ?? INERT;
}
