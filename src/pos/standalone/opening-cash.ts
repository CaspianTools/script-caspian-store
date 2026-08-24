/**
 * Whether a cashier must declare the drawer before selling, with no storage and
 * no browser in it.
 *
 * Split out of the provider for the same reason `priceLocalSale` is split out
 * of `commitLocalSale`: the transaction around it is mechanical, this part is
 * not, and `scripts/check-standalone.mjs` can assert on it without a browser.
 *
 * The timezone offset is a parameter rather than read from `Date` in here,
 * because reading it in here would make every answer depend on the host's clock
 * settings -- untestable in CI and unfalsifiable in review. Passed in, the same
 * function can be checked against Baku, Honolulu, Chatham and Kolkata in one run.
 */

import type { LocalOpeningCash } from './types';

const DAY_MS = 86_400_000;

export interface OpeningCashGateInput {
  /** `LocalShopSettings.requireOpeningCash`. False short-circuits everything. */
  required: boolean;
  /** This cashier's most recent confirmation on this device, or null. */
  latest: LocalOpeningCash | null;
  cashierId: string | null;
  /** Identifies the current sign-in. Null when nobody is signed in, or storage is blocked. */
  signInId: string | null;
  deviceId: string;
  nowMillis: number;
  /** `new Date(nowMillis).getTimezoneOffset()` -- minutes local is BEHIND UTC. */
  timezoneOffsetMinutes: number;
}

/**
 * Why the register is shut.
 *
 * `reason` is not decoration: it picks which sentence the gate screen leads
 * with, and a cashier who is asked twice in one morning needs to be told which
 * of the two rules did it.
 */
export type OpeningCashGate =
  | { required: false }
  | { required: true; satisfied: true; confirmation: LocalOpeningCash }
  | {
      required: true;
      satisfied: false;
      reason: 'no-cashier' | 'never' | 'other-device' | 'new-sign-in' | 'new-day';
    };

/**
 * The calendar day at the counter, `YYYY-MM-DD`.
 *
 * Shifts the instant by the offset and reads the UTC accessors, so the result
 * is local wall-clock date with no timezone database and no dependency on the
 * host's own zone. Half-hour and quarter-hour zones fall out for free, because
 * the offset is arithmetic rather than a special case.
 */
export function localDayKey(epochMillis: number, timezoneOffsetMinutes: number): string {
  const shifted = epochMillis - timezoneOffsetMinutes * 60_000;
  const d = new Date(shifted);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Milliseconds from now to the next local midnight.
 *
 * Never returns zero -- at exactly midnight it returns a whole day, so a caller
 * arming a timer on it cannot spin.
 */
export function msUntilNextLocalDay(epochMillis: number, timezoneOffsetMinutes: number): number {
  const shifted = epochMillis - timezoneOffsetMinutes * 60_000;
  return DAY_MS - (((shifted % DAY_MS) + DAY_MS) % DAY_MS);
}

/**
 * The most recent confirmation for this cashier on this device, or null.
 *
 * Storage does the fetching; this does the choosing, so the filter is checkable
 * without an IndexedDB index behaving itself.
 */
export function latestOpeningCash(
  rows: readonly LocalOpeningCash[],
  cashierId: string,
  deviceId: string,
): LocalOpeningCash | null {
  let best: LocalOpeningCash | null = null;
  for (const row of rows) {
    if (row.cashierId !== cashierId || row.deviceId !== deviceId) continue;
    if (!best || row.confirmedAtMillis > best.confirmedAtMillis) best = row;
  }
  return best;
}

/**
 * Decide whether the register opens.
 *
 * A row belonging to another cashier or another device is treated as no row at
 * all rather than trusted: the caller is meant to pass this cashier's row, and
 * a restored backup legitimately carries a dead machine's confirmations, whose
 * money was never in this drawer.
 */
export function evaluateOpeningCashGate(input: OpeningCashGateInput): OpeningCashGate {
  const { required, latest, cashierId, signInId, deviceId, nowMillis, timezoneOffsetMinutes } =
    input;

  if (!required) return { required: false };
  const shut = (reason: 'no-cashier' | 'never' | 'other-device' | 'new-sign-in' | 'new-day') =>
    ({ required: true, satisfied: false, reason }) as const;

  // Nobody is signed in, so the sign-in screen is the gate and this one has
  // nothing to attribute a declaration to.
  if (!cashierId) return shut('no-cashier');
  if (!latest) return shut('never');
  if (latest.cashierId !== cashierId) return shut('never');
  if (latest.deviceId !== deviceId) return shut('other-device');
  // No sign-in id at all means storage is blocked; shut rather than admit.
  if (!signInId || latest.signInId !== signInId) return shut('new-sign-in');
  if (latest.businessDay !== localDayKey(nowMillis, timezoneOffsetMinutes)) return shut('new-day');

  return { required: true, satisfied: true, confirmation: latest };
}
