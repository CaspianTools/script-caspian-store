/**
 * Lot arithmetic, with no storage in it.
 *
 * Split out of the IndexedDB transactions for the same reason as
 * `price-local-sale.ts`: which lot a sale draws from decides what a shop
 * believes is on its shelf and what it thinks expires next week, and that has
 * to be checkable without a browser. `scripts/check-standalone.mjs` asserts
 * every function here against the built bundle.
 */

import type {
  LocalProduct,
  LocalSale,
  LocalStockLot,
  LocalStockMovement,
  LocalStockReceiptLine,
} from './types';
import { fromMinor, toMinor } from './price-local-sale';

/** The bucket an item with no sizes keeps its stock in. */
export const DEFAULT_SIZE_KEY = '_default';

/** How close to its expiry a lot has to be before the shelf gets a warning. */
export const LOT_EXPIRY_WARNING_DAYS = 30;

const DAY_MS = 86_400_000;

export interface LotDraw {
  lotId: string;
  lotCode: string;
  quantity: number;
}

export interface LotAllocation {
  draws: LotDraw[];
  /** What the lots could not cover. Reported, never a refusal. */
  unfulfilled: number;
}

/**
 * Oldest-expiry-first, undated last.
 *
 * First-expiry-first-out rather than first-in-first-out, because the two only
 * agree when deliveries arrive in date order and they routinely do not: a
 * short-dated case bought cheap on Friday has to leave the shelf before the
 * long-dated one that came in on Monday. Stock with no expiry sorts last so a
 * perishable lot is never left to rot behind a tin, and equal dates fall back
 * to arrival order so the oldest box still moves first.
 */
export function sortLotsFefo(lots: readonly LocalStockLot[]): LocalStockLot[] {
  return [...lots].sort((a, b) => {
    if (a.expiresOn !== b.expiresOn) {
      if (!a.expiresOn) return 1;
      if (!b.expiresOn) return -1;
      return a.expiresOn < b.expiresOn ? -1 : 1;
    }
    return a.receivedAtMillis - b.receivedAtMillis;
  });
}

/**
 * Decide which lots a quantity comes out of.
 *
 * Splits across lots when the front one cannot cover the whole line, and
 * reports the remainder rather than refusing it — the same rule the rest of the
 * till follows, and for the same reason: the customer is already holding the
 * goods. An oversell shows up as `unfulfilled` and as a stock shortfall on the
 * sale, so somebody can reconcile it later.
 *
 * Empty lots are skipped rather than filtered by the caller, so a lot that has
 * run out can stay on the record without ever being picked again.
 */
export function allocateFefo(
  lots: readonly LocalStockLot[],
  wanted: number,
): LotAllocation {
  const draws: LotDraw[] = [];
  let left = Math.max(0, wanted);

  for (const lot of sortLotsFefo(lots)) {
    if (left <= 0) break;
    const available = Math.max(0, lot.remainingQty);
    if (available <= 0) continue;
    const take = Math.min(available, left);
    draws.push({ lotId: lot.id, lotCode: lot.lotCode, quantity: take });
    left -= take;
  }

  return { draws, unfulfilled: left };
}

export interface ProductMovementSummary {
  /** Everything a delivery put on the shelf. */
  received: number;
  /** Everything sold, as a positive count. */
  sold: number;
  /** Everything handed back by a customer. */
  returned: number;
  /** Net of every hand adjustment — write-offs, recounts, wastage. */
  adjusted: number;
  /** What all of the above leaves on the shelf. */
  onHand: number;
}

/**
 * The figures on a product page, off the ledger.
 *
 * `onHand` is the net of every row rather than a reading of
 * `LocalProduct.stock`, which is what makes it worth showing: the two agreeing
 * is the check that nothing wrote stock without saying why.
 */
export function summariseProductMovements(
  movements: readonly LocalStockMovement[],
): ProductMovementSummary {
  let received = 0;
  let sold = 0;
  let returned = 0;
  let adjusted = 0;

  for (const movement of movements) {
    switch (movement.kind) {
      case 'receipt':
        received += movement.quantity;
        break;
      case 'sale':
        sold -= movement.quantity;
        break;
      case 'return':
        returned += movement.quantity;
        break;
      case 'adjustment':
        adjusted += movement.quantity;
        break;
    }
  }

  return { received, sold, returned, adjusted, onHand: received - sold + returned + adjusted };
}

export interface ReceiptTotals {
  lineCount: number;
  /** How many units the delivery contained, across every line. */
  unitCount: number;
  totalCost: number;
}

/**
 * What a delivery came to.
 *
 * Accumulated in integer minor units like every other total on this till —
 * a hundred lines at 0.07 summed as floats is out by a cent, and a delivery
 * that does not match its invoice is an argument with a supplier.
 */
export function receiptTotals(lines: readonly LocalStockReceiptLine[]): ReceiptTotals {
  let unitCount = 0;
  let totalMinor = 0;
  for (const line of lines) {
    // Rounded the same way `postLocalStockReceipt` rounds it onto the shelf.
    // They used to differ: a pasted `2.5` put 3 on the shelf while the delivery
    // said it cost 2.5 units, so the screen and the invoice disagreed by half a
    // unit and nothing said which was right.
    const quantity = Math.max(0, Math.round(line.quantity));
    unitCount += quantity;
    totalMinor += toMinor(Math.max(0, line.unitCost)) * quantity;
  }
  return { lineCount: lines.length, unitCount, totalCost: fromMinor(totalMinor) };
}

/** What a delivery line needs to know about the item it is for. */
export type ReceivableProduct = Pick<
  LocalProduct,
  'id' | 'name' | 'sizes' | 'costPrice'
>;

function newReceiptLine(
  product: ReceivableProduct,
  sizeKey: string,
  quantity: number,
): LocalStockReceiptLine {
  return {
    productId: product.id,
    // Frozen at entry, so a later rename does not rewrite what was delivered.
    productName: product.name,
    sizeKey,
    quantity,
    unitCost: product.costPrice,
    lotCode: '',
    expiresOn: '',
    note: '',
  };
}

/**
 * One more of this item on the delivery.
 *
 * A second scan of the same box is one more of it, not a second line -- that is
 * the whole reason a storekeeper scans rather than types.
 */
export function addReceiptLine(
  lines: readonly LocalStockReceiptLine[],
  product: ReceivableProduct,
  quantity = 1,
): LocalStockReceiptLine[] {
  const sizeKey = product.sizes[0] ?? DEFAULT_SIZE_KEY;
  const at = lines.findIndex((l) => l.productId === product.id && l.sizeKey === sizeKey);
  if (at < 0) return [...lines, newReceiptLine(product, sizeKey, quantity)];
  return lines.map((line, i) =>
    i === at ? { ...line, quantity: line.quantity + quantity } : line,
  );
}

/**
 * This item is on the delivery -- exactly once, whatever happens.
 *
 * What arriving from an item page's Receive button means: this delivery is
 * about this item. Deliberately NOT `addReceiptLine`, because the effect that
 * calls it runs twice under React's StrictMode and an incrementing version
 * would open every seeded delivery showing two.
 */
export function ensureReceiptLine(
  lines: readonly LocalStockReceiptLine[],
  product: ReceivableProduct,
): LocalStockReceiptLine[] {
  const sizeKey = product.sizes[0] ?? DEFAULT_SIZE_KEY;
  if (lines.some((l) => l.productId === product.id && l.sizeKey === sizeKey)) {
    return [...lines];
  }
  return [...lines, newReceiptLine(product, sizeKey, 1)];
}

export type LotExpiryState = 'none' | 'ok' | 'soon' | 'expired';

/**
 * How a lot's expiry should read on the shelf.
 *
 * Both dates are `YYYY-MM-DD` local day keys and are compared as UTC midnights,
 * so the answer is a whole number of calendar days and a daylight-saving change
 * cannot move it. A lot expiring today is not yet expired — it is sellable
 * until the day is out.
 */
export function lotExpiryState(
  expiresOn: string,
  today: string,
  warnDays = LOT_EXPIRY_WARNING_DAYS,
): LotExpiryState {
  if (!expiresOn) return 'none';
  const due = Date.parse(`${expiresOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(now)) return 'none';
  const days = Math.round((due - now) / DAY_MS);
  if (days < 0) return 'expired';
  return days <= warnDays ? 'soon' : 'ok';
}

/**
 * The ledger rows one sale produces.
 *
 * One row per lot the sale drew from, plus one for anything the lots could not
 * cover -- so the rows always add up to what was sold, whether or not the
 * product tracks lots and whether or not the shelf was oversold.
 *
 * Ids are deterministic (`sale:<saleId>:<productId>:<sizeKey>:<lotId>`) and
 * that is load-bearing twice. It makes a retried commit overwrite its own rows
 * instead of doubling a product's sold figure, and it makes the one-time
 * backfill of sales that predate the ledger safe to run again: called with no
 * draws, which is every sale from before lots existed, it produces exactly the
 * rows that sale would produce today.
 */
export function saleStockMovements(
  sale: Pick<
    LocalSale,
    'saleId' | 'receiptNumber' | 'lines' | 'committedAtMillis' | 'cashierId' | 'cashierName'
  >,
  draws: readonly Omit<LotDraw & { productId: string; sizeKey: string }, never>[] = [],
): LocalStockMovement[] {
  const wanted = new Map<string, { productId: string; sizeKey: string; quantity: number }>();
  for (const line of sale.lines) {
    const sizeKey = line.selectedSize || DEFAULT_SIZE_KEY;
    const key = `${line.productId}|${sizeKey}`;
    const bucket = wanted.get(key) ?? { productId: line.productId, sizeKey, quantity: 0 };
    bucket.quantity += line.quantity;
    wanted.set(key, bucket);
  }

  const base = {
    kind: 'sale' as const,
    reason: '' as const,
    reference: sale.receiptNumber,
    unitCost: 0,
    userId: sale.cashierId,
    userName: sale.cashierName,
    atMillis: sale.committedAtMillis,
    note: '',
  };

  const out: LocalStockMovement[] = [];
  for (const [key, bucket] of wanted) {
    let left = bucket.quantity;
    for (const draw of draws) {
      if (`${draw.productId}|${draw.sizeKey}` !== key) continue;
      out.push({
        id: `sale:${sale.saleId}:${bucket.productId}:${bucket.sizeKey}:${draw.lotId}`,
        productId: bucket.productId,
        sizeKey: bucket.sizeKey,
        lotId: draw.lotId,
        quantity: -draw.quantity,
        ...base,
      });
      left -= draw.quantity;
    }
    // Either the product does not track lots, or it oversold. Both are the same
    // row: stock left the shelf and no lot accounts for it.
    if (left > 0) {
      out.push({
        id: `sale:${sale.saleId}:${bucket.productId}:${bucket.sizeKey}:none`,
        productId: bucket.productId,
        sizeKey: bucket.sizeKey,
        lotId: '',
        quantity: -left,
        ...base,
      });
    }
  }
  return out;
}
