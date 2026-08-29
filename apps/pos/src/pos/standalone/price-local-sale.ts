/**
 * The money and stock arithmetic of a local sale, with no storage in it.
 *
 * Split out from `commitLocalSale` so it can be reasoned about and tested
 * directly: everything that decides what a customer is charged lives here, and
 * everything that decides where it is written lives there. The transaction
 * around it is mechanical; this part is not.
 */

import type {
  LocalDiscountReason,
  LocalProduct,
  LocalSale,
  LocalSaleLine,
  LocalStockLot,
} from './types';
import { allocateFefo } from './lot-allocation';
import { fromMinor, toMinor } from '../money';

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
  discountReason?: LocalDiscountReason;
}

/** One draw against one lot, for the stock ledger. */
export interface PricedLotDraw {
  productId: string;
  sizeKey: string;
  lotId: string;
  lotCode: string;
  quantity: number;
}

export interface PricedSale {
  lines: LocalSaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  stockShortfall: LocalSale['stockShortfall'];
  /** Product id → the stock map it should be left with. */
  stockAfter: Map<string, Record<string, number>>;
  /**
   * Which lots the sale came out of. Empty for a till with no lot-tracked
   * products, which is every till until a shop turns lots on.
   */
  lotDraws: PricedLotDraw[];
  /** Lot id → the remaining quantity it should be left with. */
  lotsAfter: Map<string, number>;
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
 *
 * `lots` is optional and only consulted for a product marked `tracksLots`.
 * Called without it — which is every call a shop makes until it turns lots on —
 * the output is exactly what it was before lots existed.
 */
export function priceLocalSale(
  input: PricedLineInput[],
  products: Map<string, LocalProduct | undefined>,
  lots?: Map<string, LocalStockLot[]>,
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
      // Only when a markdown actually landed. A reason on a discount the clamp
      // took to zero would be a record of something that never happened.
      ...(lineDiscountMinor > 0 && line.discountReason
        ? { discountReason: line.discountReason }
        : {}),
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
  const lotDraws: PricedLotDraw[] = [];
  const lotsAfter = new Map<string, number>();
  for (const [productId, sizes] of wanted) {
    const product = products.get(productId);
    if (!product) continue;
    const stock = { ...product.stock };
    for (const [sizeKey, qty] of sizes) {
      const available = stock[sizeKey] ?? 0;
      if (available < qty) stockShortfall.push({ productId, sizeKey, requested: qty, available });
      stock[sizeKey] = available - qty;

      if (!product.tracksLots) continue;
      // Only this size's lots: a medium coming off the shelf must not draw down
      // the large's expiry dates.
      const forSize = (lots?.get(productId) ?? []).filter((lot) => lot.sizeKey === sizeKey);
      const allocation = allocateFefo(forSize, qty);
      for (const draw of allocation.draws) {
        lotDraws.push({ productId, sizeKey, ...draw });
        const lot = forSize.find((candidate) => candidate.id === draw.lotId);
        lotsAfter.set(draw.lotId, (lot?.remainingQty ?? 0) - draw.quantity);
      }
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
    lotDraws,
    lotsAfter,
  };
}
