'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpsCallable, type Functions } from 'firebase/functions';
import { getPosDeviceId } from '../pos-device';
import { verifyLicenseKey, type PosLicenseCheck, type PosLicenseStatus } from './verify';
import { isLicensingConfigured } from './public-key';

const LICENSE_KEY_STORAGE = 'caspian:pos:license';
/** Last activation outcome, so an offline register can still say "seat taken". */
const SEAT_STORAGE = 'caspian:pos:licenseSeat';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked. The register still works; the licence just will not be
    // remembered past this tab, which is a nag at worst and never a block.
  }
}

export type PosSeatState = 'unknown' | 'bound' | 'taken' | 'offline';

export interface PosLicenseState extends PosLicenseCheck {
  /** True when this build has a vendor public key at all. */
  configured: boolean;
  /** Whether the server agreed this computer may hold the licence. */
  seat: PosSeatState;
  /** The key currently stored on this computer, if any. */
  storedKey: string;
  busy: boolean;
  /** Paste a key: verified locally, then bound to this device server-side. */
  activate: (key: string) => Promise<PosLicenseCheck & { seat: PosSeatState }>;
  /** Forget the key on this computer. Does not release the seat server-side. */
  clear: () => void;
  /**
   * True when the operator should see the warning strip. Never true for a
   * healthy licence, and never true when licensing is switched off — which is
   * the default for every build that does not sell licences.
   */
  shouldWarn: boolean;
}

interface ActivateResponse {
  ok: boolean;
  seat: 'bound' | 'taken';
  boundDeviceId?: string;
}

/**
 * Licence state for this register.
 *
 * Deliberately incapable of blocking anything. It reports, it warns, and that
 * is the whole contract — a shop must never be unable to sell because of a
 * clock, a network or a certificate. See the note in `verify.ts` for why the
 * server-side half is the part that actually matters.
 */
export function usePosLicense(functions: Functions | null): PosLicenseState {
  const configured = isLicensingConfigured();
  const [storedKey, setStoredKey] = useState('');
  const [check, setCheck] = useState<PosLicenseCheck>({ status: configured ? 'missing' : 'disabled' });
  const [seat, setSeat] = useState<PosSeatState>('unknown');
  const [busy, setBusy] = useState(false);

  // localStorage does not exist during server render — read after mount so SSR
  // and hydration agree.
  useEffect(() => {
    if (!configured) return;
    const key = read(LICENSE_KEY_STORAGE) ?? '';
    setStoredKey(key);
    setSeat((read(SEAT_STORAGE) as PosSeatState) || 'unknown');
    let alive = true;
    verifyLicenseKey(key).then((result) => {
      if (alive) setCheck(result);
    });
    return () => {
      alive = false;
    };
  }, [configured]);

  const bindSeat = useCallback(
    async (key: string): Promise<PosSeatState> => {
      if (!functions) return 'offline';
      try {
        const call = httpsCallable<Record<string, unknown>, ActivateResponse>(
          functions,
          'activatePosLicense',
        );
        const { data } = await call({ licenseKey: key, deviceId: getPosDeviceId() });
        const next: PosSeatState = data.seat === 'taken' ? 'taken' : 'bound';
        write(SEAT_STORAGE, next);
        return next;
      } catch {
        // No network, or the POS functions are not deployed. Neither is the
        // shop's fault and neither should surface as a licence problem.
        return 'offline';
      }
    },
    [functions],
  );

  const activate = useCallback(
    async (key: string) => {
      setBusy(true);
      try {
        const result = await verifyLicenseKey(key);
        setCheck(result);

        // Only remember a key that is at least structurally ours. Storing a
        // typo would make the register nag about a licence nobody entered.
        if (result.status === 'invalid') {
          return { ...result, seat: 'unknown' as PosSeatState };
        }

        write(LICENSE_KEY_STORAGE, key.trim());
        setStoredKey(key.trim());
        const nextSeat = await bindSeat(key.trim());
        setSeat(nextSeat);
        return { ...result, seat: nextSeat };
      } finally {
        setBusy(false);
      }
    },
    [bindSeat],
  );

  const clear = useCallback(() => {
    write(LICENSE_KEY_STORAGE, null);
    write(SEAT_STORAGE, null);
    setStoredKey('');
    setSeat('unknown');
    setCheck({ status: configured ? 'missing' : 'disabled' });
  }, [configured]);

  const shouldWarn = useMemo(() => {
    if (!configured) return false;
    const warnable: PosLicenseStatus[] = ['missing', 'expired', 'invalid'];
    return warnable.includes(check.status) || seat === 'taken';
  }, [configured, check.status, seat]);

  return { ...check, configured, seat, storedKey, busy, activate, clear, shouldWarn };
}
