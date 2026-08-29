/**
 * What a customer is owed when they bring something back.
 *
 * A sibling of `price-local-sale.ts` rather than an extension of it, and that
 * is deliberate. `priceLocalSale` ends with `Math.max(0, gross - discount)`,
 * and that clamp is load-bearing -- its own comment says a negative line "would
 * turn a sale into a partial refund with no audit trail". Threading a sign
 * through it would put the two behaviours one boolean apart, which is how a
 * clamp gets lost. `shift-totals.ts` is the standing precedent for pure money
 * arithmetic living in its own file.
 *
 * **The single most important difference: a refund is priced from the SALE,
 * never from the catalogue.** `priceLocalSale` deliberately re-reads today's
 * prices because the open ticket is advisory. A refund must do the exact
 * opposite -- the customer is owed what they actually paid, which may be
 * nothing like the shelf price now. This function takes no products map at all,
 * and that omission is the feature.
 */

import { fromMinor, toMinor } from '../money';
import type { LocalSale, LocalSaleLine } from './types';

export interface RefundLineRequest {
  /** Index into the original sale's `lines`. */
  originalLineIndex: number;
  quantity: number;
}

/** How much of one original line earlier refunds have already taken back. */
export interface ReturnedSoFar {
  quantity: number;
  amount: number;
}

export interface PricedRefund {
  lines: LocalSaleLine[];
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * Per original line, what prior refunds against this sale already covered.
 *
 * Derived, never stored. The original row is never rewritten, so the only
 * truth about how much is left to return is the set of refunds pointing at it.
 */
export function summariseReturnedLines(
  original: Pick<LocalSale, 'lines'>,
  priorRefunds: readonly Pick<LocalSale, 'lines'>[],
): ReturnedSoFar[] {
  const out: ReturnedSoFar[] = original.lines.map(() => ({ quantity: 0, amount: 0 }));
  for (const refund of priorRefunds) {
    for (const line of refund.lines) {
      const index = line.originalLineIndex;
      if (index === undefined || index < 0 || index >= out.length) continue;
      // Refund lines carry negative quantities and totals; what was taken back
      // is their magnitude.
      out[index].quantity += Math.abs(line.quantity);
      out[index].amount += Math.abs(line.lineTotal);
    }
  }
  return out;
}

/**
 * Price a return.
 *
 * Returns `null` when there is nothing returnable, so the caller can abort
 * BEFORE spending a receipt ordinal -- an empty refund must not burn a number
 * out of the shop's sequence.
 *
 * Apportionment, which is the whole correctness argument:
 *
 *     returnable = original.quantity - alreadyReturned.quantity
 *     q          = clamp(0, requested, returnable)
 *     refund     = q === returnable
 *                    ? lineTotal - alreadyReturned.amount   // the last unit carries the remainder
 *                    : round(lineTotal * q / original.quantity)
 *
 * That first branch is what makes three partial returns of one 10.00 x 3 line
 * add back to exactly 10.00 -- 3.33, 3.33, 3.34. Without it you get 9.99 and
 * the shop quietly keeps a penny on every third return.
 */
export function priceLocalRefund(
  original: LocalSale,
  requests: readonly RefundLineRequest[],
  returned: readonly ReturnedSoFar[],
): PricedRefund | null {
  const lines: LocalSaleLine[] = [];
  let grossMinor = 0;
  let discountMinor = 0;

  for (const request of requests) {
    const index = request.originalLineIndex;
    const source = original.lines[index];
    if (!source) continue;

    const already = returned[index] ?? { quantity: 0, amount: 0 };
    const returnable = source.quantity - already.quantity;
    if (returnable <= 0) continue;

    const quantity = Math.min(Math.max(0, Math.floor(request.quantity)), returnable);
    if (quantity <= 0) continue;

    const lineTotalMinor = toMinor(source.lineTotal);
    const refundMinor =
      quantity === returnable
        ? lineTotalMinor - toMinor(already.amount)
        : Math.round((lineTotalMinor * quantity) / source.quantity);

    // The line's share of what was charged before the markdown, and of the
    // markdown itself, so the slip's own figures still add up.
    const unitGrossMinor = toMinor(source.unitPrice) * quantity;
    const lineDiscountMinor = unitGrossMinor - refundMinor;

    grossMinor += unitGrossMinor;
    discountMinor += lineDiscountMinor;

    lines.push({
      productId: source.productId,
      name: source.name,
      sku: source.sku,
      barcode: source.barcode,
      unitPrice: source.unitPrice,
      // Negative throughout. A refund is a sale with the signs turned over, and
      // that is what lets six existing readers net it out untouched.
      quantity: -quantity,
      selectedSize: source.selectedSize,
      selectedColor: source.selectedColor,
      lineDiscount: -fromMinor(lineDiscountMinor),
      lineTotal: -fromMinor(refundMinor),
      originalLineIndex: index,
    });
  }

  if (!lines.length) return null;

  return {
    lines,
    subtotal: -fromMinor(grossMinor),
    discount: -fromMinor(discountMinor),
    total: -fromMinor(grossMinor - discountMinor),
  };
}

/** What is still returnable on each line of a sale, for the picker's caps. */
export function returnableQuantities(
  original: Pick<LocalSale, 'lines'>,
  returned: readonly ReturnedSoFar[],
): number[] {
  return original.lines.map((line, index) =>
    Math.max(0, line.quantity - (returned[index]?.quantity ?? 0)),
  );
}
