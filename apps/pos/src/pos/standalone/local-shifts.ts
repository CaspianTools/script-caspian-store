/**
 * A cashier's turn at a counter, on disk.
 *
 * A sibling of `local-db.ts` rather than a section inside it, matching
 * `local-terminals.ts` and `local-recovery.ts`: this reads sales through
 * `local-db.ts`, so living inside it would close a loop.
 *
 * The arithmetic is not here. `shift-totals.ts` holds every figure a cashier is
 * counted against, pure and asserted in CI, for the reason `priceLocalSale` is
 * split out of `commitLocalSale`: the transaction is mechanical, the sums are
 * not, and a drawer that will not balance is somebody answering for money.
 *
 * A closed shift is never edited. A miscount is put right by a cash movement on
 * the next shift, not by rewriting this row, so what an owner reads is what the
 * cashier actually gave -- the same append-only posture as `LocalSale` and
 * `LocalOpeningCash`.
 */

import {
  STORE_LOCAL_SHIFTS,
  idbGet,
  idbGetAll,
  idbGetAllByIndex,
  idbPut,
  posTx,
} from '../offline/pos-queue-db';
import { listLocalSales, localStoreAvailable, newLocalId } from './local-db';
import { localDayKey } from './opening-cash';
import { fromMinor, toMinor } from '../money';
import { openShiftForDevice } from './shift-gate';
import { salesForShift, shiftVariance, summariseShift, type ShiftTotals } from './shift-totals';
import type { LocalCashMovement, LocalShift, LocalTerminal } from './types';

/** The open shift on this device, or null. */
export async function openLocalShift(deviceId: string): Promise<LocalShift | null> {
  if (!localStoreAvailable()) return null;
  const rows = await posTx(STORE_LOCAL_SHIFTS, 'readonly', (tx) =>
    idbGetAllByIndex<LocalShift>(tx, STORE_LOCAL_SHIFTS, 'by-device', deviceId),
  );
  return openShiftForDevice(rows, deviceId);
}

export async function getLocalShift(id: string): Promise<LocalShift | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_SHIFTS, 'readonly', (tx) =>
    idbGet<LocalShift>(tx, STORE_LOCAL_SHIFTS, id),
  );
  return row ?? null;
}

/** Every shift in a window, newest first. For the back office, never for the gate. */
export async function listLocalShifts(
  fromMillis = 0,
  toMillis = Number.MAX_SAFE_INTEGER,
): Promise<LocalShift[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_SHIFTS, 'readonly', (tx) =>
    idbGetAll<LocalShift>(tx, STORE_LOCAL_SHIFTS),
  );
  return all
    .filter((r) => r.openedAtMillis >= fromMillis && r.openedAtMillis <= toMillis)
    .sort((a, b) => b.openedAtMillis - a.openedAtMillis);
}

export type StartShiftResult =
  | { ok: true; shift: LocalShift }
  | { ok: false; reason: 'already-open' };

/**
 * Open a shift on this counter.
 *
 * Refuses if one is already open on this device, whoever it belongs to. Two
 * open shifts on one drawer means two expected figures for one pile of cash,
 * and neither of them is answerable -- a handover closes one and opens the
 * next, which is what the gate offers when it meets somebody else's.
 *
 * The float is clamped rather than refused, and rounded through minor units,
 * for the reason `recordLocalOpeningCash` gives: a negative is a slipped minus
 * key and never a drawer, and the gate exists to get the counter open.
 * `roundCashTo` is deliberately not applied -- that setting rounds change handed
 * to a customer, and a count is a count.
 */
export async function startLocalShift(input: {
  terminal: Pick<LocalTerminal, 'id' | 'name'>;
  cashierId: string;
  cashierName: string;
  deviceId: string;
  signInId: string;
  openingFloat: number;
}): Promise<StartShiftResult> {
  const existing = await openLocalShift(input.deviceId);
  if (existing) return { ok: false, reason: 'already-open' };

  const now = Date.now();
  const utcOffsetMinutes = new Date(now).getTimezoneOffset();
  const shift: LocalShift = {
    id: newLocalId(),
    terminalId: input.terminal.id,
    terminalName: input.terminal.name,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    deviceId: input.deviceId,
    signInId: input.signInId,
    status: 'open',
    openedAtMillis: now,
    openingFloat: fromMinor(Math.max(0, toMinor(input.openingFloat))),
    businessDay: localDayKey(now, utcOffsetMinutes),
    utcOffsetMinutes,
    movements: [],
  };
  await posTx(STORE_LOCAL_SHIFTS, 'readwrite', (tx) => idbPut(tx, STORE_LOCAL_SHIFTS, shift));
  return { ok: true, shift };
}

/**
 * Record money in or out of the drawer that was not a sale.
 *
 * This is what makes the closing variance defensible, and it is the reason
 * `LocalOpeningCash` declined to compute one. Read and write in ONE
 * transaction, because two cash-outs recorded quickly would otherwise both
 * merge onto a copy of `movements` read before the first landed, and the first
 * would vanish -- the lost update `writeLocalShopSettings` documents.
 */
export async function recordLocalCashMovement(
  shiftId: string,
  movement: Omit<LocalCashMovement, 'id' | 'atMillis'>,
): Promise<LocalShift | null> {
  return posTx(STORE_LOCAL_SHIFTS, 'readwrite', async (tx) => {
    const row = await idbGet<LocalShift>(tx, STORE_LOCAL_SHIFTS, shiftId);
    if (!row || row.status !== 'open') return null;
    const entry: LocalCashMovement = {
      ...movement,
      // Magnitude only: the direction is `kind`, so a minus key slipped into
      // the amount box must not quietly reverse the movement it claims to be.
      amount: fromMinor(Math.abs(toMinor(movement.amount))),
      reason: movement.reason.trim(),
      id: newLocalId(),
      atMillis: Date.now(),
    };
    const next: LocalShift = { ...row, movements: [...row.movements, entry] };
    await idbPut(tx, STORE_LOCAL_SHIFTS, next);
    return next;
  });
}

/**
 * What this shift has taken so far, and what should be in the drawer.
 *
 * The X-report while it is open, and the figures the close screen shows before
 * anybody commits to a count.
 */
export async function summariseLocalShift(shift: LocalShift): Promise<ShiftTotals> {
  // Deliberately not narrowed to the shift's own window first. The stamped
  // `shiftId` is the authority on what belongs to a shift, and a hand-set clock
  // or an NTP correction can leave a sale sitting outside the times its own
  // shift records -- the same reason the opening-cash gate compares `signInId`
  // by equality and never by time. A till holds thousands of sales, not
  // millions, and no X-report is on the hot path of a sale.
  const sales = await listLocalSales();
  return summariseShift(shift, salesForShift(sales, shift.id));
}

export type CloseShiftResult =
  | { ok: true; shift: LocalShift }
  | { ok: false; reason: 'not-open' };

/**
 * Close a shift against what the cashier counted.
 *
 * The variance is recorded whatever it is, and the close is never refused for
 * one. A till that would not let a cashier finish on a short drawer is a till
 * that teaches cashiers to make the number fit.
 *
 * Totals are frozen onto the row here rather than recomputed when the back
 * office opens it. A sale later deleted, or a clock corrected, must not change
 * what a shift was closed at -- the figure somebody signed off on is the figure
 * that stays on file.
 */
export async function closeLocalShift(
  shiftId: string,
  countedCash: number,
): Promise<CloseShiftResult> {
  const shift = await getLocalShift(shiftId);
  if (!shift || shift.status !== 'open') return { ok: false, reason: 'not-open' };

  const totals = await summariseLocalShift(shift);
  const counted = fromMinor(Math.max(0, toMinor(countedCash)));
  const closed: LocalShift = {
    ...shift,
    status: 'closed',
    closedAtMillis: Date.now(),
    countedCash: counted,
    expectedCash: totals.expectedCash,
    variance: shiftVariance(counted, totals.expectedCash),
    totalsByTender: totals.totalsByTender,
    salesTotal: totals.salesTotal,
    saleCount: totals.saleCount,
    refundsTotal: totals.refundsTotal,
    refundCount: totals.refundCount,
    netTotal: totals.netTotal,
  };
  await posTx(STORE_LOCAL_SHIFTS, 'readwrite', (tx) => idbPut(tx, STORE_LOCAL_SHIFTS, closed));
  return { ok: true, shift: closed };
}
