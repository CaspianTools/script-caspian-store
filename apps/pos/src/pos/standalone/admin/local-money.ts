/**
 * Render an amount in the shop's currency.
 *
 * Falls back to two decimal places rather than throwing: `currency` is a free
 * text field on the shop record, and a typo in it must not take a whole screen
 * down. The shop sees an unlabelled number, which is wrong but readable, rather
 * than a page that failed to render.
 */
export function formatLocalMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/** A quantity, always signed, so a ledger row says which way it went. */
export function formatSignedQuantity(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}
