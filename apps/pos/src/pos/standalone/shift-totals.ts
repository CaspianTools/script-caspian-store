/**
 * What a shift took, and what should therefore be in the drawer.
 *
 * Pure, with no storage and no browser in it, for the reason `priceLocalSale`
 * is: the transaction around it is mechanical, this part is not, and
 * `scripts/check-standalone.mjs` can assert it without a browser. Everything
 * that decides the figure a cashier is counted against lives here.
 *
 * Accumulates in integer minor units and converts once at the end, the same way
 * `priceLocalSale` and `usePosTicket` do. Summing floats across a day of sales
 * drifts by a cent or two, and at a till that is not a rounding curiosity -- it
 * is a drawer that will not balance, and somebody answering for it.
 */

import { isRefundSale, type LocalSale, type LocalShift } from './types';
import { fromMinor, toMinor } from '../money';

export interface ShiftTotals {
  /** Opening float + cash taken + movements in − movements out. */
  expectedCash: number;
  /** Applied amount per tender kind, over the whole shift. */
  totalsByTender: Record<string, number>;
  /** Sales only. Refunds are counted separately rather than netted in here. */
  salesTotal: number;
  saleCount: number;
  /** What went back to customers, as a positive magnitude. */
  refundsTotal: number;
  refundCount: number;
  /** `salesTotal - refundsTotal`. What the shift actually took. */
  netTotal: number;
  /**
   * Cash that went into the drawer through the register.
   *
   * Already NET of refunds without any code saying so: a refund's cash tender
   * is negative, so the same accumulation that adds a sale subtracts a return.
   */
  cashTaken: number;
  movementsIn: number;
  movementsOut: number;
}

/**
 * The sales belonging to one shift.
 *
 * Storage does the fetching; this does the choosing, so the filter is checkable
 * without an IndexedDB index behaving itself -- the same split
 * `latestOpeningCash` makes. Matched on `shiftId` alone: a sale carries the id
 * of the shift that rang it, and a sale from before shifts existed carries
 * none and belongs to no shift.
 */
export function salesForShift(rows: readonly LocalSale[], shiftId: string): LocalSale[] {
  return rows.filter((row) => row.shiftId === shiftId);
}

/**
 * Add up a shift.
 *
 * `movements` comes off the shift and the sales are passed in, because the two
 * live in different stores and the caller has already had to read both.
 *
 * Cash from a sale is the tender's `amount`, never its `tendered`. A cashier
 * handed a twenty for a fourteen-pound basket puts twenty in and takes six out,
 * and the drawer nets fourteen -- counting `tendered` would say the shift took
 * six pounds more than it did, every time anybody paid with a note.
 */
export function summariseShift(
  shift: Pick<LocalShift, 'openingFloat' | 'movements'>,
  sales: readonly LocalSale[],
): ShiftTotals {
  const byTenderMinor = new Map<string, number>();
  let salesMinor = 0;
  let refundsMinor = 0;
  let saleCount = 0;
  let refundCount = 0;
  let cashMinor = 0;

  for (const sale of sales) {
    // Sales and refunds are counted apart so the report can say what happened,
    // but the DRAWER arithmetic below is untouched: a refund's tenders are
    // negative, so `cashMinor += applied` already takes the money out.
    if (isRefundSale(sale)) {
      refundsMinor += Math.abs(toMinor(sale.total));
      refundCount += 1;
    } else {
      salesMinor += toMinor(sale.total);
      saleCount += 1;
    }
    for (const tender of sale.tenders) {
      const applied = toMinor(tender.amount);
      // Kept NET per kind, because net is what is in the drawer.
      byTenderMinor.set(tender.kind, (byTenderMinor.get(tender.kind) ?? 0) + applied);
      if (tender.kind === 'cash') cashMinor += applied;
    }
  }

  let inMinor = 0;
  let outMinor = 0;
  for (const movement of shift.movements) {
    // `amount` is always positive and `kind` carries the direction, so a row
    // that somehow arrived negative is taken at its magnitude rather than
    // quietly reversing the movement it claims to be.
    const amount = Math.abs(toMinor(movement.amount));
    if (movement.kind === 'in') inMinor += amount;
    else outMinor += amount;
  }

  const totalsByTender: Record<string, number> = {};
  for (const [kind, minor] of byTenderMinor) totalsByTender[kind] = fromMinor(minor);

  return {
    expectedCash: fromMinor(toMinor(shift.openingFloat) + cashMinor + inMinor - outMinor),
    totalsByTender,
    salesTotal: fromMinor(salesMinor),
    saleCount,
    refundsTotal: fromMinor(refundsMinor),
    refundCount,
    netTotal: fromMinor(salesMinor - refundsMinor),
    cashTaken: fromMinor(cashMinor),
    movementsIn: fromMinor(inMinor),
    movementsOut: fromMinor(outMinor),
  };
}

/**
 * What the count came to against what was expected.
 *
 * Negative means the drawer is short. Computed through minor units so a
 * hundred-and-one-pound count against a hundred-and-one-pound expectation is
 * exactly zero rather than a float crumb that renders as a variance.
 */
export function shiftVariance(countedCash: number, expectedCash: number): number {
  return fromMinor(toMinor(countedCash) - toMinor(expectedCash));
}
