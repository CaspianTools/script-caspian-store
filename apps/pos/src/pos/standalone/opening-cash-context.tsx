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
import { getPosDeviceId, getPosDeviceLabel } from '../pos-device';
import { latestLocalOpeningCash, readLocalShopSettings, recordLocalOpeningCash } from './local-db';
import { usePosLocalSession } from './local-session-context';
import { evaluateOpeningCashGate, type OpeningCashGate } from './opening-cash';
import { DEFAULT_LOCAL_SHOP_SETTINGS, type LocalOpeningCash } from './types';

export interface PosOpeningCashValue {
  /** True only on a standalone till whose shop has the switch on. */
  required: boolean;
  /** True until settings and the last declaration have been read. Never true on a cloud till. */
  loading: boolean;
  gate: OpeningCashGate;
  /**
   * The most recent declaration on record for this cashier on this device.
   *
   * Not narrowed to the satisfied case: the "you have signed in again" screen
   * needs to quote the amount it is superseding, and that row is by definition
   * one the gate has just rejected.
   */
  confirmation: LocalOpeningCash | null;
  /** `LocalShopSettings.currency`, for rendering the amount back to the cashier. */
  currency: string;
  /** Records the declaration. Resolves to `null` when the write failed — the register stays shut. */
  confirm: (amount: number) => Promise<LocalOpeningCash | null>;
  /** Re-reads storage. The only path that touches IndexedDB after mount. */
  refresh: () => Promise<void>;
}

const PosOpeningCashContext = createContext<PosOpeningCashValue | null>(null);

const INERT: PosOpeningCashValue = Object.freeze({
  required: false,
  loading: false,
  gate: { required: false } as OpeningCashGate,
  confirmation: null,
  currency: DEFAULT_LOCAL_SHOP_SETTINGS.currency,
  confirm: async () => null,
  refresh: async () => undefined,
});

interface GateState {
  deviceId: string;
  required: boolean;
  currency: string;
  latest: LocalOpeningCash | null;
}

/**
 * Everything the gate is decided from, in one read.
 *
 * Skips the declaration lookup when the switch is off, so a shop that never
 * turned this on pays nothing for it beyond the settings read the register
 * already does.
 */
async function readGateState(cashierId: string | null): Promise<GateState> {
  const deviceId = getPosDeviceId();
  const settings = await readLocalShopSettings();
  const latest =
    settings.requireOpeningCash && cashierId
      ? await latestLocalOpeningCash(cashierId, deviceId)
      : null;
  return {
    deviceId,
    required: settings.requireOpeningCash,
    currency: settings.currency,
    latest,
  };
}

/**
 * Whether this cashier has declared the drawer, and the way to declare it.
 *
 * Mounted unconditionally around the register, like `PosLocalSessionProvider`,
 * so the screen below can be written once — but it does no work at all outside
 * standalone mode. A cloud till must not pay an IndexedDB round-trip, or a
 * frame of skeleton, for a feature it does not have; `loading` starts at
 * `standalone` for exactly that reason, so a cloud till is inert synchronously
 * on the first render and never flashes.
 */
export function PosOpeningCashProvider({ children }: { children: ReactNode }) {
  const standalone = useCaspianStandalone();
  const { user, signInId, loading: sessionLoading } = usePosLocalSession();
  const cashierId = user?.id ?? null;

  const [deviceId, setDeviceId] = useState('');
  const [required, setRequired] = useState(false);
  const [currency, setCurrency] = useState(DEFAULT_LOCAL_SHOP_SETTINGS.currency);
  const [latest, setLatest] = useState<LocalOpeningCash | null>(null);
  const [loading, setLoading] = useState(standalone);
  /**
   * The instant the gate is answered for. Held in state rather than read inside
   * the memo so the answer is a pure function of state and React is free to
   * skip the work — and so re-evaluating is a matter of moving this forward.
   */
  const [evaluatedAt, setEvaluatedAt] = useState(() => Date.now());

  const apply = useCallback((next: GateState) => {
    setDeviceId(next.deviceId);
    setRequired(next.required);
    setCurrency(next.currency);
    setLatest(next.latest);
    setEvaluatedAt(Date.now());
  }, []);

  useEffect(() => {
    if (!standalone) {
      setLoading(false);
      return;
    }
    // Hold at loading until the session has resolved: asking storage for "this
    // cashier's last declaration" before the stored session has been matched to
    // an account answers for nobody, and the answer would be `never` — a gate
    // shown to a cashier who had already declared.
    if (sessionLoading) return;

    let alive = true;
    (async () => {
      try {
        const next = await readGateState(cashierId);
        if (alive) apply(next);
      } catch {
        // Storage blocked or unavailable. Fail towards trading: this is a
        // shrinkage control, not a security boundary, and a till that cannot
        // sell because IndexedDB is unavailable is a worse outcome than a
        // morning with no drawer count on record.
        if (alive) {
          setRequired(false);
          setLatest(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [standalone, sessionLoading, cashierId, signInId, apply]);

  /**
   * Re-evaluate when the till comes back to the front — and deliberately NOT on
   * a midnight timer.
   *
   * The omission is the design. `usePosTicket` is plain `useState` local to
   * `PosRegister`, so swapping the gate in at 00:00:00 would unmount
   * `PosRegister` and silently destroy a half-rung sale with a customer
   * standing at the counter. The honest trade is that a till left focused and
   * untouched through midnight is re-asked at the next navigation or window
   * event rather than at the stroke — and a till nobody has touched is not
   * selling, so nothing has gone through an undeclared drawer.
   *
   * Moving `evaluatedAt` re-runs the pure evaluation against state already in
   * memory. It costs nothing and touches no storage; `refresh()` is the only
   * path that re-reads IndexedDB.
   */
  useEffect(() => {
    if (!standalone) return;
    const revalidate = () => setEvaluatedAt(Date.now());
    const onVisibility = () => {
      if (document.visibilityState === 'visible') revalidate();
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [standalone]);

  const refresh = useCallback(async () => {
    if (!standalone) return;
    try {
      apply(await readGateState(cashierId));
    } catch {
      setRequired(false);
      setLatest(null);
    }
  }, [standalone, cashierId, apply]);

  const confirm = useCallback(
    async (amount: number): Promise<LocalOpeningCash | null> => {
      if (!standalone || !user || !signInId) return null;
      // Falls back to minting the id rather than writing an empty `deviceId`:
      // a row whose device does not match this one reads back as
      // `other-device` forever, which is a gate the cashier cannot pass.
      const device = deviceId || getPosDeviceId();
      try {
        const row = await recordLocalOpeningCash({
          amount,
          cashierId: user.id,
          cashierName: user.displayName || user.username,
          deviceId: device,
          deviceLabel: getPosDeviceLabel(),
          signInId,
        });
        setDeviceId(device);
        setLatest(row);
        setEvaluatedAt(Date.now());
        return row;
      } catch {
        return null;
      }
    },
    [standalone, user, signInId, deviceId],
  );

  const gate = useMemo<OpeningCashGate>(() => {
    if (!standalone) return { required: false };
    return evaluateOpeningCashGate({
      required,
      latest,
      cashierId,
      signInId,
      deviceId,
      nowMillis: evaluatedAt,
      timezoneOffsetMinutes: new Date(evaluatedAt).getTimezoneOffset(),
    });
  }, [standalone, required, latest, cashierId, signInId, deviceId, evaluatedAt]);

  const value = useMemo<PosOpeningCashValue>(
    () =>
      standalone
        ? { required, loading, gate, confirmation: latest, currency, confirm, refresh }
        : INERT,
    [standalone, required, loading, gate, latest, currency, confirm, refresh],
  );

  return <PosOpeningCashContext.Provider value={value}>{children}</PosOpeningCashContext.Provider>;
}

/**
 * Returns the inert value rather than throwing when no provider is above.
 *
 * `PosShell` and `PosRegister` are public exports a consumer may mount on their
 * own page without the rest of the tree, and making this throw would turn a
 * standalone-only concern into a crash on every existing till.
 */
export function usePosOpeningCash(): PosOpeningCashValue {
  return useContext(PosOpeningCashContext) ?? INERT;
}
