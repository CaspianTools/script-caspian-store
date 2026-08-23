/**
 * The money and stock arithmetic of a local sale, with no storage in it.
 *
 * Split out from `commitLocalSale` so it can be reasoned about and tested
 * directly: everything that decides what a customer is charged lives here, and
 * everything that decides where it is written lives there. The transaction
 * around it is mechanical; this part is not.
 */

import type { LocalProduct, LocalSale, LocalSaleLine } from './types';

/**
 * Same integer-minor-unit accumulation as `usePosTicket`.
 *
 * Summing floats across a long ticket drifts by a cent or two, and at a till
 * that is not a rounding curiosity — it is a drawer that will not balance at
 * close.
 */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

export interface PricedLineInput {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  /** What the ticket showed. Used only if the product has since been deleted. */
  unitPrice: number;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  lineDiscount?: number;
}

export interface PricedSale {
  lines: LocalSaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  stockShortfall: LocalSale['stockShortfall'];
  /** Product id → the stock map it should be left with. */
  stockAfter: Map<string, Record<string, number>>;
}

/**
 * Price a ticket against the catalogue, and work out what stock it consumes.
 *
 * Prices come from the catalogue rather than the ticket. The cloud register has
 * the server re-read every price at commit for the same reason: what the ticket
 * holds is advisory and can be stale if the catalogue moved mid-sale.
 *
 * Stock goes negative rather than blocking. The customer is already holding the
 * goods and the money is already in the drawer, so refusing would lose the sale
 * record — strictly worse than recording an oversell. The shortfall is reported
 * so somebody can reconcile it later.
 */
export function priceLocalSale(
  input: PricedLineInput[],
  products: Map<string, LocalProduct | undefined>,
): PricedSale {
  let grossMinor = 0;
  let discountMinor = 0;

  const lines: LocalSaleLine[] = input.map((line) => {
    const product = products.get(line.productId);
    const unitPrice = product ? product.price : line.unitPrice;
    const lineGrossMinor = toMinor(unitPrice) * line.quantity;
    // A markdown can take a line to zero but never below — a negative line
    // would turn a sale into a partial refund with no audit trail.
    const lineDiscountMinor = Math.max(
      0,
      Math.min(toMinor(line.lineDiscount ?? 0), lineGrossMinor),
    );
    grossMinor += lineGrossMinor;
    discountMinor += lineDiscountMinor;
    return {
      productId: line.productId,
      name: product?.name ?? line.name,
      sku: product?.sku ?? line.sku ?? '',
      barcode: product?.barcode ?? line.barcode ?? '',
      unitPrice,
      quantity: line.quantity,
      selectedSize: line.selectedSize ?? null,
      selectedColor: line.selectedColor ?? null,
      lineDiscount: fromMinor(lineDiscountMinor),
      lineTotal: fromMinor(lineGrossMinor - lineDiscountMinor),
    };
  });

  const wanted = new Map<string, Map<string, number>>();
  for (const line of input) {
    const sizeKey = line.selectedSize || '_default';
    const bucket = wanted.get(line.productId) ?? new Map<string, number>();
    bucket.set(sizeKey, (bucket.get(sizeKey) ?? 0) + line.quantity);
    wanted.set(line.productId, bucket);
  }

  const stockShortfall: LocalSale['stockShortfall'] = [];
  const stockAfter = new Map<string, Record<string, number>>();
  for (const [productId, sizes] of wanted) {
    const product = products.get(productId);
    if (!product) continue;
    const stock = { ...product.stock };
    for (const [sizeKey, qty] of sizes) {
      const available = stock[sizeKey] ?? 0;
      if (available < qty) stockShortfall.push({ productId, sizeKey, requested: qty, available });
      stock[sizeKey] = available - qty;
    }
    stockAfter.set(productId, stock);
  }

  return {
    lines,
    subtotal: fromMinor(grossMinor),
    discount: fromMinor(discountMinor),
    total: fromMinor(Math.max(0, grossMinor - discountMinor)),
    stockShortfall,
    stockAfter,
  };
}
