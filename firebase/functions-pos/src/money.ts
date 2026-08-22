/**
 * Money helpers shared by the sale and refund commits.
 *
 * Everything is computed in integer minor units (cents) and converted back at
 * the boundary. Accumulating `0.1 + 0.2` style floats across a 30-line ticket
 * produces totals that are off by a cent, which on a till is not a rounding
 * curiosity — it is a drawer that will not balance at close.
 */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/**
 * Round a cash amount to the smallest denomination still in circulation
 * (e.g. `0.05` where 1¢ and 2¢ coins have been withdrawn). `step <= 0`
 * disables rounding. Card and other electronic tenders are never rounded.
 */
export function roundCash(amount: number, step: number): number {
  if (!step || step <= 0) return fromMinor(toMinor(amount));
  const stepMinor = toMinor(step);
  return fromMinor(Math.round(toMinor(amount) / stepMinor) * stepMinor);
}

/** Mirrors `computeDiscount` in functions-stripe so both channels price alike. */
export function computeDiscount(
  subtotal: number,
  promo: FirebaseFirestore.DocumentData,
): number {
  if (promo.isActive === false) return 0;
  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) return 0;
  let amount = 0;
  if (promo.type === 'percentage') {
    amount = (subtotal * (promo.value ?? 0)) / 100;
    if (promo.maxDiscount) amount = Math.min(amount, promo.maxDiscount);
  } else if (promo.type === 'fixed') {
    amount = Math.min(promo.value ?? 0, subtotal);
  }
  return Math.max(0, amount);
}
