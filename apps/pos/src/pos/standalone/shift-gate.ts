/**
 * Whether a cashier must open a shift before selling, and whose shift is in the
 * way if they cannot.
 *
 * Pure, with no storage and no browser in it, for the reason `opening-cash.ts`
 * is: `scripts/check-standalone.mjs` can assert every rule below without a
 * browser, and every answer is a function of its arguments rather than of the
 * host's clock or disk.
 *
 * **One deliberate difference from the opening-cash gate: this one does not
 * compare `signInId`.** A drawer declaration is per sign-in on purpose -- a new
 * person at the keyboard is a new count. A shift is not: a cashier who locks the
 * screen over lunch, or signs out and back in to let a colleague check a price,
 * is still working the same turn at the same counter, and ending their shift
 * underneath them would close a drawer nobody counted. The shift records which
 * sign-in opened it for the audit trail, and the gate never reads it.
 */

import type { LocalShift, LocalTerminal } from './types';

export interface ShiftGateInput {
  /** `LocalShopSettings.shiftsEnabled`. False short-circuits everything. */
  required: boolean;
  /** The open shift on this device, or null. See `openShiftForDevice`. */
  open: LocalShift | null;
  /** The terminal this device has claimed, or null when it has claimed none. */
  terminal: LocalTerminal | null;
  cashierId: string | null;
}

/**
 * Why the register is shut.
 *
 * `reason` is not decoration: it picks which sentence the gate leads with, and
 * which control it offers. `other-cashier` is the one that matters at a
 * handover -- the answer there is a Close button for the shift already open,
 * not an Open button that would put two shifts on one drawer.
 */
export type ShiftGate =
  | { required: false }
  | { required: true; satisfied: true; shift: LocalShift }
  | {
      required: true;
      satisfied: false;
      reason: 'no-cashier' | 'no-terminal' | 'none-open';
    }
  | { required: true; satisfied: false; reason: 'other-cashier'; shift: LocalShift };

/**
 * The open shift on this device, or null.
 *
 * Storage does the fetching; this does the choosing, so the filter is checkable
 * without an IndexedDB index behaving itself -- the same split
 * `latestOpeningCash` makes.
 *
 * Most recent wins if two are somehow open at once. That should not happen --
 * opening one closes nothing and the gate refuses to open a second -- but a
 * restored backup can legitimately carry a shift left open on the machine it
 * came from, and picking the newest is the only choice that lets the cashier
 * standing here close something and get on with the queue.
 */
export function openShiftForDevice(
  rows: readonly LocalShift[],
  deviceId: string,
): LocalShift | null {
  let best: LocalShift | null = null;
  for (const row of rows) {
    if (row.status !== 'open' || row.deviceId !== deviceId) continue;
    if (!best || row.openedAtMillis > best.openedAtMillis) best = row;
  }
  return best;
}

/** Decide whether the register opens. */
export function evaluateShiftGate(input: ShiftGateInput): ShiftGate {
  const { required, open, terminal, cashierId } = input;

  if (!required) return { required: false };

  // Nobody is signed in, so the sign-in screen is the gate and this one has
  // nothing to attribute a shift to.
  if (!cashierId) return { required: true, satisfied: false, reason: 'no-cashier' };

  // A shift belongs to a counter. Shifts cannot be switched on until the shop
  // has named one, so reaching here means this device has claimed none -- the
  // claim screen is the answer, and it runs ahead of this gate.
  if (!terminal) return { required: true, satisfied: false, reason: 'no-terminal' };

  if (!open) return { required: true, satisfied: false, reason: 'none-open' };
  if (open.cashierId !== cashierId) {
    return { required: true, satisfied: false, reason: 'other-cashier', shift: open };
  }

  return { required: true, satisfied: true, shift: open };
}
