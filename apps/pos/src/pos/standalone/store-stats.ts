import type {
  LocalProduct,
  LocalSale,
  LocalStockLot,
  LocalStockMovement,
  LocalStockReceipt,
} from './types';

/**
 * What the record pages count, as pure functions.
 *
 * Split out of the screens for the reason `price-local-sale.ts` was split out of
 * the IndexedDB transaction: arithmetic a shop makes decisions on should be
 * checkable without a browser, and `check-standalone.mjs` checks it. Nothing
 * here touches storage -- every function is handed rows that a caller has
 * already read.
 *
 * One join runs through all of it and is worth stating once. A sale line records
 * `productId` and nothing else about where the goods came from: no category, no
 * supplier. Category figures therefore go through the product's CURRENT
 * `category` name, and supplier figures can only reach a sale through the batch
 * it was drawn from. Both limits are surfaced on the pages rather than papered
 * over.
 */

export const POS_RANGE_KEYS = ['today', 'week', 'month', 'all'] as const;

export type PosRange = (typeof POS_RANGE_KEYS)[number];

/**
 * The first millisecond a range covers.
 *
 * Lifted verbatim out of the sales panel, which had it as a private `startOf`,
 * so the four screens that now offer a range picker all mean the same thing by
 * "this week". Takes `nowMillis` rather than reading the clock so it can be
 * asserted; the day boundary is still the till's local midnight, because that is
 * the day a shop trades in.
 */
export function rangeStart(range: PosRange, nowMillis: number): number {
  if (range === 'all') return 0;
  const midnight = new Date(nowMillis);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  if (range === 'today') return today;
  const days = range === 'week' ? 6 : 29;
  return today - days * 24 * 60 * 60 * 1000;
}

export interface ProductSalesTotals {
  units: number;
  /** What was actually charged: line totals, after any line discount. */
  revenue: number;
  discount: number;
  /** Sales this product appeared on, not lines -- two lines on one receipt is one. */
  saleCount: number;
  lastAtMillis: number;
}

const emptyProductTotals = (): ProductSalesTotals => ({
  units: 0,
  revenue: 0,
  discount: 0,
  saleCount: 0,
  lastAtMillis: 0,
});

/** Every product that has sold in the window, keyed by id. */
export function salesByProduct(
  sales: readonly LocalSale[],
  fromMillis: number,
): Map<string, ProductSalesTotals> {
  const out = new Map<string, ProductSalesTotals>();
  for (const sale of sales) {
    if (sale.committedAtMillis < fromMillis) continue;
    // A product can appear on two lines of one receipt -- two sizes of the same
    // shirt. Counted once towards `saleCount`, or "sold on 40 sales" quietly
    // becomes "sold on 40 lines" and stops matching the receipts list.
    const seen = new Set<string>();
    for (const line of sale.lines) {
      const row = out.get(line.productId) ?? emptyProductTotals();
      row.units += line.quantity;
      row.revenue += line.lineTotal;
      row.discount += line.lineDiscount;
      if (!seen.has(line.productId)) {
        row.saleCount += 1;
        seen.add(line.productId);
      }
      row.lastAtMillis = Math.max(row.lastAtMillis, sale.committedAtMillis);
      out.set(line.productId, row);
    }
  }
  return out;
}

export interface ProductSaleRow {
  saleId: string;
  receiptNumber: string;
  atMillis: number;
  cashierName: string;
  quantity: number;
  total: number;
}

/**
 * The sales one product appeared on, newest first.
 *
 * One row per receipt rather than per line, matching `saleCount` above -- an
 * owner reading this table is looking for a receipt number to go and find.
 */
export function productSaleRows(
  sales: readonly LocalSale[],
  productId: string,
  fromMillis: number,
): ProductSaleRow[] {
  const out: ProductSaleRow[] = [];
  for (const sale of sales) {
    if (sale.committedAtMillis < fromMillis) continue;
    let quantity = 0;
    let total = 0;
    for (const line of sale.lines) {
      if (line.productId !== productId) continue;
      quantity += line.quantity;
      total += line.lineTotal;
    }
    if (quantity === 0) continue;
    out.push({
      saleId: sale.saleId,
      receiptNumber: sale.receiptNumber,
      atMillis: sale.committedAtMillis,
      cashierName: sale.cashierName,
      quantity,
      total,
    });
  }
  return out.sort((a, b) => b.atMillis - a.atMillis);
}

/** On hand across every size bucket. */
export function unitsOnHand(product: Pick<LocalProduct, 'stock'>): number {
  return (Object.values(product.stock) as number[]).reduce((a, b) => a + b, 0);
}

export interface ProductProfit {
  /** Revenue less what those units cost, over the lines whose cost is known. */
  grossProfit: number;
  /** Units sold of items with no cost price on file, so the page can say so. */
  unitsWithoutCost: number;
}

/**
 * Profit, over the part of the sales that can bear it.
 *
 * `costPrice` is restamped by each delivery and is zero on an item that has
 * never been received, so a shop that types its catalogue in by hand has no cost
 * at all. Counting those units at zero cost would report the whole sale as
 * profit, which is a number somebody would act on -- so they are excluded and
 * counted separately instead.
 */
export function profitOf(
  lines: readonly { productId: string; quantity: number; lineTotal: number }[],
  costOf: (productId: string) => number,
): ProductProfit {
  let grossProfit = 0;
  let unitsWithoutCost = 0;
  for (const line of lines) {
    const cost = costOf(line.productId);
    if (cost > 0) grossProfit += line.lineTotal - line.quantity * cost;
    else unitsWithoutCost += line.quantity;
  }
  return { grossProfit, unitsWithoutCost };
}

export interface CategoryTotals {
  products: number;
  activeProducts: number;
  unitsOnHand: number;
  /** What the shelf cost, at the last price paid for each item. */
  stockValueAtCost: number;
  unitsSold: number;
  revenue: number;
  grossProfit: number;
  unitsWithoutCost: number;
}

const emptyCategoryTotals = (): CategoryTotals => ({
  products: 0,
  activeProducts: 0,
  unitsOnHand: 0,
  stockValueAtCost: 0,
  unitsSold: 0,
  revenue: 0,
  grossProfit: 0,
  unitsWithoutCost: 0,
});

/**
 * Catalogue and trading figures for every category name in use, keyed by the
 * trimmed name.
 *
 * Products carrying no category are filed under `''`, which the Categories
 * screen does not list -- deliberately, because a shop with the screen switched
 * off has every product there and a row called "(none)" holding the whole
 * catalogue answers nothing.
 */
export function categoryTotals(
  sales: readonly LocalSale[],
  products: readonly LocalProduct[],
  fromMillis: number,
): Map<string, CategoryTotals> {
  const out = new Map<string, CategoryTotals>();
  const categoryOf = new Map<string, string>();
  const costOf = new Map<string, number>();

  for (const product of products) {
    const name = product.category.trim();
    categoryOf.set(product.id, name);
    costOf.set(product.id, product.costPrice);
    const row = out.get(name) ?? emptyCategoryTotals();
    row.products += 1;
    if (product.isActive) row.activeProducts += 1;
    const held = unitsOnHand(product);
    row.unitsOnHand += held;
    row.stockValueAtCost += held * product.costPrice;
    out.set(name, row);
  }

  for (const sale of sales) {
    if (sale.committedAtMillis < fromMillis) continue;
    for (const line of sale.lines) {
      // A product deleted since the sale has no category to file it under. It
      // still sold, so it is not silently dropped from the till's takings -- but
      // it belongs to no category page, and inventing one would put revenue on a
      // screen that cannot account for it.
      const name = categoryOf.get(line.productId);
      if (name === undefined) continue;
      const row = out.get(name) ?? emptyCategoryTotals();
      row.unitsSold += line.quantity;
      row.revenue += line.lineTotal;
      const cost = costOf.get(line.productId) ?? 0;
      if (cost > 0) row.grossProfit += line.lineTotal - line.quantity * cost;
      else row.unitsWithoutCost += line.quantity;
      out.set(name, row);
    }
  }

  return out;
}

export interface SupplierProductRow {
  productId: string;
  /** Frozen on the receipt line, so a renamed product still reads as delivered. */
  productName: string;
  unitsReceived: number;
  lastUnitCost: number;
  lastAtMillis: number;
  /** Only ever non-zero for an item received in batches. See `supplierTotals`. */
  unitsSoldFromLots: number;
}

export interface SupplierTotals {
  deliveries: number;
  spend: number;
  lastAtMillis: number;
  unitsReceived: number;
  /** Still on the shelf out of this supplier's batches, at what they cost. */
  unitsOnHandFromLots: number;
  stockValueFromLots: number;
  /** Sold out of this supplier's batches, at what those units cost. */
  unitsSoldFromLots: number;
  costOfUnitsSoldFromLots: number;
  /** True once any of this supplier's stock arrived as a batch. */
  hasLots: boolean;
  products: SupplierProductRow[];
}

/**
 * What one supplier has delivered, and as much of what happened next as the
 * data can honestly support.
 *
 * The deliveries half is exact: a posted receipt names its supplier and freezes
 * the name on it. The sold half is not, and cannot be made so. A `LocalSaleLine`
 * records the product and never the batch, so the only path from a sale back to
 * a supplier is `LocalStockLot.supplierId` -> `LocalStockMovement.lotId`, which
 * exists only for a product with `tracksLots`. Everything else sold is real
 * revenue that simply cannot be attributed, and the page says so rather than
 * showing a zero that reads as "sold nothing".
 *
 * The figure reported for those attributable units is their COST, not their
 * revenue. Cost is exact -- it is on the lot. Revenue would mean re-joining to
 * the sale through the receipt number and apportioning a line across two
 * batches, and for an oversold line (`saleStockMovements` writes those with an
 * empty `lotId`) there is no batch to apportion to at all.
 */
export function supplierTotals(input: {
  supplierId: string;
  receipts: readonly LocalStockReceipt[];
  lots: readonly LocalStockLot[];
  movements: readonly LocalStockMovement[];
}): SupplierTotals {
  const { supplierId, receipts, lots, movements } = input;

  const mine = receipts.filter((r) => r.supplierId === supplierId && r.status === 'posted');
  const myLots = lots.filter((l) => l.supplierId === supplierId);
  const lotCost = new Map(myLots.map((l) => [l.id, l] as const));

  const soldByProduct = new Map<string, number>();
  let unitsSoldFromLots = 0;
  let costOfUnitsSoldFromLots = 0;
  for (const movement of movements) {
    if (movement.kind !== 'sale' || !movement.lotId) continue;
    const lot = lotCost.get(movement.lotId);
    if (!lot) continue;
    const units = -movement.quantity;
    unitsSoldFromLots += units;
    costOfUnitsSoldFromLots += units * lot.unitCost;
    soldByProduct.set(movement.productId, (soldByProduct.get(movement.productId) ?? 0) + units);
  }

  const byProduct = new Map<string, SupplierProductRow>();
  let unitsReceived = 0;
  let spend = 0;
  let lastAtMillis = 0;
  for (const receipt of mine) {
    spend += receipt.totalCost;
    lastAtMillis = Math.max(lastAtMillis, receipt.receivedAtMillis);
    for (const line of receipt.lines) {
      unitsReceived += line.quantity;
      const row = byProduct.get(line.productId) ?? {
        productId: line.productId,
        productName: line.productName,
        unitsReceived: 0,
        lastUnitCost: 0,
        lastAtMillis: 0,
        unitsSoldFromLots: 0,
      };
      row.unitsReceived += line.quantity;
      // Last delivery wins, so the cost shown is the one a reorder would be
      // quoted against rather than an average nobody was ever charged.
      if (receipt.receivedAtMillis >= row.lastAtMillis) {
        row.lastUnitCost = line.unitCost;
        row.lastAtMillis = receipt.receivedAtMillis;
      }
      byProduct.set(line.productId, row);
    }
  }

  for (const row of byProduct.values()) {
    row.unitsSoldFromLots = soldByProduct.get(row.productId) ?? 0;
  }

  return {
    deliveries: mine.length,
    spend,
    lastAtMillis,
    unitsReceived,
    unitsOnHandFromLots: myLots.reduce((sum, l) => sum + l.remainingQty, 0),
    stockValueFromLots: myLots.reduce((sum, l) => sum + l.remainingQty * l.unitCost, 0),
    unitsSoldFromLots,
    costOfUnitsSoldFromLots,
    hasLots: myLots.length > 0,
    products: [...byProduct.values()].sort((a, b) => b.unitsReceived - a.unitsReceived),
  };
}
