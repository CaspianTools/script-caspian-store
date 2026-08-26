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
import { useCaspianStandalone } from '../../provider/caspian-store-provider';
import { getPosDeviceId } from '../pos-device';
import { readLocalShopSettings } from './local-db';
import {
  closeLocalShift,
  openLocalShift,
  recordLocalCashMovement,
  startLocalShift,
  summariseLocalShift,
  type CloseShiftResult,
  type StartShiftResult,
} from './local-shifts';
import { usePosLocalSession } from './local-session-context';
import { evaluateShiftGate, type ShiftGate } from './shift-gate';
import { summariseShift, type ShiftTotals } from './shift-totals';
import { usePosTerminal } from './terminal-context';
import { DEFAULT_LOCAL_SHOP_SETTINGS, type LocalShift } from './types';

export interface PosShiftValue {
  /** True only on a standalone till whose shop has the switch on. */
  required: boolean;
  /** True until settings and any open shift have been read. Never true on a cloud till. */
  loading: boolean;
  gate: ShiftGate;
  /** The open shift on this device, whoever it belongs to. */
  shift: LocalShift | null;
  /** What the open shift has taken so far. Zeroed when none is open. */
  totals: ShiftTotals;
  /** `LocalShopSettings.currency`, for rendering amounts back to the cashier. */
  currency: string;
  start: (openingFloat: number) => Promise<StartShiftResult>;
  cashMovement: (kind: 'in' | 'out', amount: number, reason: string) => Promise<boolean>;
  close: (countedCash: number) => Promise<CloseShiftResult>;
  refresh: () => Promise<void>;
}

const EMPTY_TOTALS: ShiftTotals = Object.freeze({
  expectedCash: 0,
  totalsByTender: {},
  salesTotal: 0,
  saleCount: 0,
  cashTaken: 0,
  movementsIn: 0,
  movementsOut: 0,
});

const PosShiftContext = createContext<PosShiftValue | null>(null);

const INERT: PosShiftValue = Object.freeze({
  required: false,
  loading: false,
  gate: { required: false } as ShiftGate,
  shift: null,
  totals: EMPTY_TOTALS,
  currency: DEFAULT_LOCAL_SHOP_SETTINGS.currency,
  start: async () => ({ ok: false, reason: 'already-open' }) as StartShiftResult,
  cashMovement: async () => false,
  close: async () => ({ ok: false, reason: 'not-open' }) as CloseShiftResult,
  refresh: async () => undefined,
});

/**
 * Whose turn is open at this counter, and the running figures for it.
 *
 * Mounted inside `PosTerminalProvider`, because a shift belongs to a counter and
 * the gate has to know which one this machine is. Inert outside standalone mode
 * for the reason the opening-cash provider is: a cloud till must not pay an
 * IndexedDB round-trip, or a frame of skeleton, for a feature it does not have.
 */
export function PosShiftProvider({ children }: { children: ReactNode }) {
  const standalone = useCaspianStandalone();
  const { user, signInId, loading: sessionLoading } = usePosLocalSession();
  const { terminal, loading: terminalLoading } = usePosTerminal();
  const cashierId = user?.id ?? null;

  const [required, setRequired] = useState(false);
  const [currency, setCurrency] = useState(DEFAULT_LOCAL_SHOP_SETTINGS.currency);
  const [shift, setShift] = useState<LocalShift | null>(null);
  const [totals, setTotals] = useState<ShiftTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(standalone);

  /**
   * Recompute the running figures.
   *
   * Separate from the read below so a cash movement can refresh the strip
   * without re-reading settings, and so the close screen shows exactly the
   * numbers it is about to freeze onto the row.
   */
  const recount = useCallback(async (row: LocalShift | null) => {
    if (!row) {
      setTotals(EMPTY_TOTALS);
      return;
    }
    try {
      setTotals(await summariseLocalShift(row));
    } catch {
      // Better a strip showing the float and the movements than a screen that
      // will not render; the sales come back on the next refresh.
      setTotals(summariseShift(row, []));
    }
  }, []);

  const read = useCallback(async () => {
    const settings = await readLocalShopSettings();
    setRequired(settings.shiftsEnabled);
    setCurrency(settings.currency);
    const row = settings.shiftsEnabled ? await openLocalShift(getPosDeviceId()) : null;
    setShift(row);
    await recount(row);
  }, [recount]);

  const refresh = useCallback(async () => {
    if (!standalone) return;
    try {
      await read();
    } catch {
      setRequired(false);
      setShift(null);
      setTotals(EMPTY_TOTALS);
    }
  }, [standalone, read]);

  useEffect(() => {
    if (!standalone) {
      setLoading(false);
      return;
    }
    // Hold at loading until the session and the roster have resolved, for the
    // reason the opening-cash provider does: asking "is a shift open for this
    // cashier?" before the stored session has been matched to an account
    // answers for nobody, and the answer would shut a gate on somebody already
    // halfway through their turn.
    if (sessionLoading || terminalLoading) return;

    let alive = true;
    (async () => {
      try {
        if (alive) await read();
      } catch {
        // Storage blocked or unavailable. Fail towards trading, as every other
        // gate on this till does: a cashier who cannot open a shift because
        // IndexedDB is unreachable is a queue that stops.
        if (alive) {
          setRequired(false);
          setShift(null);
          setTotals(EMPTY_TOTALS);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [standalone, sessionLoading, terminalLoading, cashierId, read]);

  /**
   * Re-read when the till comes back to the front -- and deliberately NOT on a
   * midnight timer.
   *
   * The omission is the design, for the reason `PosOpeningCashProvider` gives:
   * `usePosTicket` is plain state local to `PosRegister`, so swapping a gate in
   * at 00:00:00 would unmount it and silently destroy a half-rung sale with a
   * customer standing at the counter. A shift that runs past midnight keeps the
   * business day it opened on, which is what a night shift should do anyway.
   */
  useEffect(() => {
    if (!standalone) return;
    const revalidate = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') revalidate();
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [standalone, refresh]);

  const start = useCallback(
    async (openingFloat: number): Promise<StartShiftResult> => {
      if (!standalone || !user || !terminal) return { ok: false, reason: 'already-open' };
      const result = await startLocalShift({
        terminal,
        cashierId: user.id,
        cashierName: user.displayName || user.username,
        deviceId: getPosDeviceId(),
        signInId: signInId ?? '',
        openingFloat,
      });
      if (result.ok) {
        setShift(result.shift);
        await recount(result.shift);
      }
      return result;
    },
    [standalone, user, terminal, signInId, recount],
  );

  const cashMovement = useCallback(
    async (kind: 'in' | 'out', amount: number, reason: string): Promise<boolean> => {
      if (!standalone || !shift || !user) return false;
      const next = await recordLocalCashMovement(shift.id, {
        kind,
        amount,
        reason,
        byUserId: user.id,
        byUserName: user.displayName || user.username,
      });
      if (!next) return false;
      setShift(next);
      await recount(next);
      return true;
    },
    [standalone, shift, user, recount],
  );

  const close = useCallback(
    async (countedCash: number): Promise<CloseShiftResult> => {
      if (!standalone || !shift) return { ok: false, reason: 'not-open' };
      const result = await closeLocalShift(shift.id, countedCash);
      if (result.ok) {
        setShift(null);
        setTotals(EMPTY_TOTALS);
      }
      return result;
    },
    [standalone, shift],
  );

  const gate = useMemo<ShiftGate>(() => {
    if (!standalone) return { required: false };
    return evaluateShiftGate({ required, open: shift, terminal, cashierId });
  }, [standalone, required, shift, terminal, cashierId]);

  const value = useMemo<PosShiftValue>(
    () =>
      standalone
        ? { required, loading, gate, shift, totals, currency, start, cashMovement, close, refresh }
        : INERT,
    [
      standalone,
      required,
      loading,
      gate,
      shift,
      totals,
      currency,
      start,
      cashMovement,
      close,
      refresh,
    ],
  );

  return <PosShiftContext.Provider value={value}>{children}</PosShiftContext.Provider>;
}

/**
 * Returns the inert value rather than throwing when no provider is above.
 *
 * `PosShell` and `PosRegister` are public exports a consumer may mount on their
 * own page without the rest of the tree, and making this throw would turn a
 * standalone-only concern into a crash on every existing till.
 */
export function usePosShift(): PosShiftValue {
  return useContext(PosShiftContext) ?? INERT;
}
