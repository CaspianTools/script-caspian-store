'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { useAuth } from '../context/auth-context';
import { usePosAdapter } from './pos-adapter-context';
import { getPosDeviceId } from './pos-device';
import { usePosLocalSession } from './standalone/local-session-context';
import { clearOpenSale, peekOpenSale, writeOpenSale, OPEN_SALE_KEY } from './open-sale-store';
import type { PersistedOpenSale } from './open-sale-store';
import { usePosTicket, type PosTicket } from './use-pos-ticket';
import { ensurePosStoragePersisted } from './pos-storage-durability';

/**
 * A sale found on disk that has not been resumed or discarded yet.
 *
 * Offered, never applied silently. A ticket that reappears on its own after a
 * crash is indistinguishable from a scanning bug to the person holding the
 * scanner, and a cashier who does not know the register restored something will
 * ring the customer's goods on top of it.
 */
export interface RecoveredOpenSale {
  record: PersistedOpenSale;
  /** False when the ticket was left by somebody else — still offered, but labelled. */
  sameCashier: boolean;
}

export interface PosOpenSale {
  ticket: PosTicket;
  /**
   * The idempotency token for the sale in progress. A ref, not state, because
   * `commit` reads and writes it synchronously inside one attempt.
   */
  saleIdRef: MutableRefObject<string | null>;
  /** Mirror the current ticket to disk, coalescing a burst of scans. */
  persist: () => void;
  /**
   * Mirror it immediately, skipping the debounce, and resolve once it is
   * actually on disk. For the one caller that has a crash window to close
   * rather than a keystroke to coalesce: `commit`, which must get `saleId` down
   * BEFORE it asks the adapter to take the money. Being awaitable is the
   * difference between that ordering being real and being a comment.
   */
  flush: () => Promise<void>;
  /**
   * The sale is over: forget it in memory and on disk, and write nothing more
   * until the next item is scanned.
   *
   * The caller still has to clear the ticket lines. This deliberately does not
   * touch them, because the receipt is built out of them a few lines earlier.
   */
  settle: () => void;
  recovered: RecoveredOpenSale | null;
  resume: () => void;
  discard: () => void;
  /**
   * The receipt number of a sale that had already been recorded when the
   * register came back up, so the cashier is told why their ticket is gone
   * rather than left to guess. Cleared by `acknowledgeSettled`.
   */
  settledReceipt: string | null;
  acknowledgeSettled: () => void;
  /**
   * True when a commit's outcome could not be determined and `saleIdRef` is
   * being held deliberately. Anything scanned now would be swallowed by the
   * idempotency gate if that sale did in fact land.
   *
   * Lives here rather than in `PosRegister` because the burnt id lives here:
   * the id survives a walk to another screen, and a warning that did not would
   * leave a cashier adding items to a sale that cannot accept them.
   */
  outcomeUnknown: boolean;
  setOutcomeUnknown: (value: boolean) => void;
}

const PosOpenSaleContext = createContext<PosOpenSale | null>(null);

/** Long enough to coalesce a burst of scans, short enough that a crash costs one item. */
const WRITE_DEBOUNCE_MS = 150;

/**
 * What this tab's ticket is doing, which is not the same question as whether it
 * has any lines in it.
 *
 * Three states, because an empty ticket means two opposite things and a full one
 * means two more:
 *
 * - `idle`    — nothing has been scanned here since start-up. Writes NOTHING,
 *               and in particular does not clear: a second tab of the register
 *               sitting on the sale screen would otherwise delete the ticket the
 *               first tab is ringing up, every time the operator switched away.
 * - `live`    — this tab owns the open sale. Lines are written through, and
 *               emptying them deletes the row, because that is a cashier
 *               clearing a sale.
 * - `settled` — the lines on screen have been PAID FOR and are only still there
 *               so the receipt can be read. Writes nothing at all. Without this
 *               state a `pagehide` after a commit wrote the paid basket back as
 *               an open ticket with no sale id, and the next start-up offered it
 *               for resume — a second charge under a fresh id that no
 *               idempotency gate would catch.
 */
type TicketPhase = 'idle' | 'live' | 'settled';

export function PosOpenSaleProvider({ children }: { children: ReactNode }) {
  const ticket = usePosTicket();
  const { adapter } = usePosAdapter();
  const local = usePosLocalSession();
  const { user, userProfile } = useAuth();

  const saleIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<TicketPhase>('idle');

  const [hydrated, setHydrated] = useState(false);
  const [recovered, setRecovered] = useState<RecoveredOpenSale | null>(null);
  const [settledReceipt, setSettledReceipt] = useState<string | null>(null);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);

  const cashierId = local.standalone ? (local.user?.id ?? '') : (user?.uid ?? '');
  const cashierName = local.standalone
    ? (local.user?.displayName ?? '')
    : (userProfile?.displayName || user?.email || '');

  // Read through refs so the debounced writer is not rebuilt on every scan.
  const identity = useRef({ cashierId, cashierName, signInId: local.signInId });
  identity.current = { cashierId, cashierName, signInId: local.signInId };

  const linesRef = useRef(ticket.lines);
  linesRef.current = ticket.lines;

  const writeNow = useCallback((): Promise<void> => {
    if (phaseRef.current !== 'live') return Promise.resolve();
    const lines = linesRef.current;
    if (lines.length === 0 && !saleIdRef.current) {
      // Only a tab that owns the sale may delete it — see `TicketPhase`.
      phaseRef.current = 'idle';
      return clearOpenSale().catch(() => undefined);
    }
    revisionRef.current += 1;
    const { cashierId: id, cashierName: name, signInId } = identity.current;
    return writeOpenSale({
      key: OPEN_SALE_KEY,
      revision: revisionRef.current,
      lines,
      saleId: saleIdRef.current,
      cashierId: id,
      cashierName: name,
      deviceId: getPosDeviceId(),
      signInId,
      updatedAtMillis: Date.now(),
      // A write that fails is not worth interrupting a sale for — the ticket is
      // still correct in memory, and the storage health card on /pos/settings is
      // where a persistently broken database gets reported.
    }).catch(() => undefined);
  }, []);

  const persist = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(writeNow, WRITE_DEBOUNCE_MS);
  }, [writeNow]);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return writeNow();
  }, [writeNow]);

  // --- Start-up: is there a sale to come back to? ---
  useEffect(() => {
    let alive = true;
    void (async () => {
      // Asked here rather than in the service-worker effect because that one is
      // skipped outside production builds, and an evictable origin on a till
      // whose IndexedDB is the shop's only copy is the worst default there is.
      void ensurePosStoragePersisted();
      let row: PersistedOpenSale | null = null;
      try {
        row = await peekOpenSale();
      } catch {
        // A database that will not open is reported by the storage health card,
        // not by refusing to open the register.
        row = null;
      }
      if (!alive) return;
      // Seeded from any row at all, including one with nothing on it: the guard
      // in `writeOpenSale` drops writes that are behind disk, so starting at 0
      // against a disk sitting at 40 would silently stop saving.
      if (row) revisionRef.current = row.revision;
      const found = row && Array.isArray(row.lines) && row.lines.length > 0 ? row : null;
      if (!found) {
        setHydrated(true);
        return;
      }

      // The dangerous case: the till died between committing the sale and
      // clearing the ticket. Resuming would put a paid-for basket back on the
      // screen and invite a second charge, so ask the one question that
      // separates the two — did it land?
      if (found.saleId) {
        try {
          const landed = await adapter.findCommittedSale(found.saleId);
          if (!alive) return;
          if (landed) {
            await clearOpenSale().catch(() => undefined);
            if (!alive) return;
            setSettledReceipt(landed.receiptNumber);
            setHydrated(true);
            return;
          }
        } catch {
          // Could not find out. Keep the ticket and keep its sale id: a resumed
          // attempt then collides with the committed sale and is reported as a
          // duplicate, instead of charging the customer a second time. Say so,
          // because anything scanned onto it now would be swallowed.
          if (!alive) return;
          setOutcomeUnknown(true);
        }
      }

      setRecovered({
        record: found,
        sameCashier: !identity.current.cashierId || found.cashierId === identity.current.cashierId,
      });
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [adapter]);

  // --- Write-through ---
  useEffect(() => {
    if (!hydrated) return;
    if (recovered) {
      // An offer is outstanding and the live ticket is empty, so there is
      // nothing to write and writing it would erase the sale being offered.
      if (ticket.lines.length === 0) return;
      // ...unless the cashier answered by scanning. Serving the next customer
      // IS an answer, and both alternatives are worse: leaving the offer up
      // blocks every write for the rest of the session, and letting `resume()`
      // fire afterwards replaces the customer's basket with the abandoned one.
      setRecovered(null);
    }
    // Scanning the first item is what makes this tab the owner of the sale, and
    // it is also what ends the settled state left behind by the last one.
    if (phaseRef.current !== 'live' && ticket.lines.length > 0) phaseRef.current = 'live';
    persist();
  }, [ticket.lines, hydrated, recovered, persist]);

  // A crash costs at most the debounce window; a deliberate close should cost
  // nothing. `pagehide` fires where `beforeunload` does not on mobile Safari and
  // in an installed PWA.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flushOnLeave = () => {
      if (!hydrated || recovered) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      writeNow();
    };
    // Only on the way out. Firing on 'visible' as well would write on every
    // return to the tab, which after a commit is precisely the moment there is
    // nothing worth writing.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnLeave();
    };
    window.addEventListener('pagehide', flushOnLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushOnLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [hydrated, recovered, writeNow]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resume = useCallback(() => {
    // Guarded rather than merged. Two baskets cannot be added together without
    // guessing which repeats are a second item and which are the same item
    // counted twice, and a wrong guess is a wrong bill.
    if (!recovered || ticket.lines.length > 0) return;
    ticket.replaceLines(recovered.record.lines);
    saleIdRef.current = recovered.record.saleId;
    phaseRef.current = 'live';
    setRecovered(null);
  }, [recovered, ticket]);

  const discard = useCallback(() => {
    setRecovered(null);
    saleIdRef.current = null;
    setOutcomeUnknown(false);
    phaseRef.current = 'idle';
    void clearOpenSale().catch(() => undefined);
  }, []);

  const settle = useCallback(() => {
    saleIdRef.current = null;
    setOutcomeUnknown(false);
    phaseRef.current = 'settled';
    if (timerRef.current) clearTimeout(timerRef.current);
    void clearOpenSale().catch(() => undefined);
  }, []);

  const acknowledgeSettled = useCallback(() => setSettledReceipt(null), []);

  const value = useMemo<PosOpenSale>(
    () => ({
      ticket,
      saleIdRef,
      persist,
      flush,
      settle,
      recovered,
      resume,
      discard,
      settledReceipt,
      acknowledgeSettled,
      outcomeUnknown,
      setOutcomeUnknown,
    }),
    [
      ticket,
      persist,
      flush,
      settle,
      recovered,
      resume,
      discard,
      settledReceipt,
      acknowledgeSettled,
      outcomeUnknown,
    ],
  );

  return <PosOpenSaleContext.Provider value={value}>{children}</PosOpenSaleContext.Provider>;
}

/**
 * The open sale, persisted when the provider is above us and ordinary React
 * state when it is not.
 *
 * The fallback is not defensive padding: `PosRegister` is a public export and a
 * consumer may mount it on its own, so the hook has to work without the shell.
 * Both hooks are called unconditionally — the unused one costs an empty array.
 */
export function usePosOpenSale(): PosOpenSale {
  const context = useContext(PosOpenSaleContext);
  const standalone = usePosTicket();
  const saleIdRef = useRef<string | null>(null);
  const noop = useCallback(() => undefined, []);
  const noopAsync = useCallback(() => Promise.resolve(), []);
  const noopBool = useCallback((_value: boolean) => undefined, []);
  const fallback = useMemo<PosOpenSale>(
    () => ({
      ticket: standalone,
      saleIdRef,
      persist: noop,
      flush: noopAsync,
      settle: noop,
      recovered: null,
      resume: noop,
      discard: noop,
      settledReceipt: null,
      acknowledgeSettled: noop,
      outcomeUnknown: false,
      setOutcomeUnknown: noopBool,
    }),
    [standalone, noop, noopAsync, noopBool],
  );
  return context ?? fallback;
}
