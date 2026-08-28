/**
 * The till's money primitives. One copy, and this is it.
 *
 * These four functions had four homes before this file existed: `toMinor` and
 * `fromMinor` were written out again in `pos-tender-dialog.tsx`,
 * `build-receipt-model.ts` and `use-pos-ticket.ts` beside the canonical pair in
 * `price-local-sale.ts`, and `roundCash` twice. Four copies of an arithmetic
 * rule is four places for it to drift, and the one that drifted was the change
 * a customer is handed.
 *
 * Deliberately React-free and free of any `standalone/` import: the tender
 * dialog and the receipt model are shared files that a cloud-backed register
 * renders too, so they must not grow a dependency on the local back office.
 */

/**
 * Money is counted in integer minor units, everywhere, always.
 *
 * Summing floats across a long ticket drifts by a cent or two, and at a till
 * that is not a rounding curiosity -- it is a drawer that will not balance at
 * close.
 *
 * Hardcoded at 100 rather than derived from the shop's currency, and that is a
 * decision rather than an oversight. Every amount already on disk -- every
 * `LocalSale.total`, `LocalStockLot.unitCost` and `LocalShift.openingFloat` --
 * is a float whose meaning is fixed by this constant. Making it currency-driven
 * would silently move all of them by two orders of magnitude on a shop that
 * trades in a 0-decimal currency. If the till is ever sold into one, that is a
 * migration, not an edit to this line.
 */
export const MINOR_UNIT_SCALE = 100;

export function toMinor(amount: number): number {
  return Math.round(amount * MINOR_UNIT_SCALE);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / MINOR_UNIT_SCALE;
}

/**
 * Round to the smallest coin still in circulation (`5` where 1c/2c are
 * withdrawn). Mirrors `roundCash` in functions-pos so the change shown at the
 * till matches the change recorded on the order.
 *
 * Takes and returns minor units, unlike the two float-in-float-out copies it
 * replaces: those converted to minor units, rounded, converted back, and were
 * then immediately converted to minor units again by their caller. Every one of
 * those trips is a chance to reintroduce the drift the units exist to prevent.
 */
export function roundCashMinor(minor: number, stepMinor: number): number {
  if (!stepMinor || stepMinor <= 0) return Math.round(minor);
  return Math.round(minor / stepMinor) * stepMinor;
}

/**
 * Normalise negative zero before it reaches a formatter.
 *
 * `Intl.NumberFormat` renders `-0` as `-$0.00`, which is what the item page
 * printed for the stock value of an oversold item with no cost price on file:
 * `-3 * 0` is `-0`. Doing it here rather than reaching for `signDisplay`
 * keeps the fix in one place and off the browser support matrix.
 */
export function displayAmount(amount: number): number {
  return amount === 0 ? 0 : amount;
}

/**
 * The shop's currency code, or `''` if it cannot be used.
 *
 * `LocalShopSettings.currency` reaches this from a settings field, and a code
 * that is not a well-formed ISO 4217 alpha-3 makes `Intl.NumberFormat` throw.
 * Callers use the empty string as their signal to render a bare number instead
 * -- unlabelled but readable -- rather than letting the throw take a screen
 * down.
 *
 * Constructibility is checked as well as shape because the two are not the same
 * question: `ZZZ` is three letters and is not a currency.
 */
export function usableCurrency(code: string): string {
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(trimmed)) return '';
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: trimmed }).format(0);
    return trimmed;
  } catch {
    return '';
  }
}

/** A quantity, always signed, so a ledger row says which way it went. */
export function formatSignedQuantity(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}
