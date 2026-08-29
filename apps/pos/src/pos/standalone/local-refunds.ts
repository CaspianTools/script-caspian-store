/**
 * Taking something back.
 *
 * Sits beside `local-shifts.ts` and `local-terminals.ts` rather than inside
 * `local-db.ts`, and reads through it, so the dependency runs one way.
 *
 * A refund is a row in `localSales` with negative money -- see the long note on
 * `LocalSale` for why that beats a separate store. What lives here is the part
 * that cannot be pure: spending a receipt ordinal, putting units back on the
 * lots the sale drew them from, and doing all of it in one transaction.
 */

import {
  STORE_LOCAL_COUNTERS,
  STORE_LOCAL_LOTS,
  STORE_LOCAL_MOVEMENTS,
  STORE_LOCAL_PRODUCTS,
  STORE_LOCAL_SALES,
  idbGet,
  idbGetAllByIndex,
  idbPut,
  posTx,
} from '../offline/pos-queue-db';
import { localStoreAvailable, newLocalId, readLocalShopSettings } from './local-db';
import { priceLocalRefund, summariseReturnedLines, type RefundLineRequest } from './price-local-refund';
import {
  isRefundSale,
  type LocalProduct,
  type LocalRefundReason,
  type LocalSale,
  type LocalStockLot,
  type LocalStockMovement,
} from './types';

const RECEIPT_COUNTER_KEY = 'receipt';
const RECEIPT_PAD = 6;

export interface LocalRefundInput {
  /** Minted once per attempt by the caller, so a retry lands on the same row. */
  refundId: string;
  originalSaleId: string;
  lines: RefundLineRequest[];
  tenders: Array<{ kind: 'cash' | 'card' | 'other'; amount: number; reference?: string }>;
  reason: LocalRefundReason;
  note: string;
  deviceId: string;
  cashierId: string;
  cashierName: string;
  committedAtMillis: number;
  terminalId?: string;
  terminalName?: string;
  shiftId?: string;
}

export type LocalRefundResult =
  | { ok: true; refund: LocalSale; duplicate: boolean }
  | { ok: false; reason: 'no-original' | 'already-refund' | 'nothing-returnable' | 'unavailable' };

/** Every refund written against one sale, newest first. */
export async function listRefundsForSale(saleId: string): Promise<LocalSale[]> {
  if (!localStoreAvailable()) return [];
  const rows = await posTx(STORE_LOCAL_SALES, 'readonly', (tx) =>
    idbGetAllByIndex<LocalSale>(tx, STORE_LOCAL_SALES, 'by-original', saleId),
  );
  return rows.sort((a, b) => b.committedAtMillis - a.committedAtMillis);
}

/**
 * Write a refund, put the stock back, and hand back the row.
 *
 * The ordering here is the whole thing:
 *
 * 1. **Idempotent on `refundId`.** Same contract as `commitLocalSale`; a retry
 *    after a failed write lands on the row that already exists rather than
 *    refunding twice.
 * 2. **Prior refunds are read INSIDE the transaction.** IndexedDB serialises
 *    overlapping `readwrite` transactions on a store, so a check made before
 *    opening one is a check two tabs can both pass. Reading first and writing
 *    second is exactly how a sale gets over-returned.
 * 3. **Pricing happens before the ordinal is spent.** `priceLocalRefund`
 *    returning `null` aborts, so an empty refund never burns a receipt number
 *    out of the shop's sequence.
 */
export async function commitLocalRefund(input: LocalRefundInput): Promise<LocalRefundResult> {
  if (!localStoreAvailable()) return { ok: false, reason: 'unavailable' };
  const settings = await readLocalShopSettings();
  const receiptPrefix = settings.receiptPrefix || 'R';

  return posTx(
    [
      STORE_LOCAL_SALES,
      STORE_LOCAL_PRODUCTS,
      STORE_LOCAL_COUNTERS,
      STORE_LOCAL_LOTS,
      STORE_LOCAL_MOVEMENTS,
    ],
    'readwrite',
    async (tx): Promise<LocalRefundResult> => {
      const existing = await idbGet<LocalSale>(tx, STORE_LOCAL_SALES, input.refundId);
      if (existing) return { ok: true, refund: existing, duplicate: true };

      const original = await idbGet<LocalSale>(tx, STORE_LOCAL_SALES, input.originalSaleId);
      if (!original) return { ok: false, reason: 'no-original' };
      // A refund cannot be refunded. Correcting a mistaken refund is selling
      // the goods again, which is a sale -- there is no void in this till and
      // adding one would be a second way to move money.
      if (isRefundSale(original)) return { ok: false, reason: 'already-refund' };

      const priors = await idbGetAllByIndex<LocalSale>(
        tx,
        STORE_LOCAL_SALES,
        'by-original',
        input.originalSaleId,
      );
      const returned = summariseReturnedLines(original, priors);
      const priorIds = new Set(priors.map((row) => row.saleId));
      const priced = priceLocalRefund(original, input.lines, returned);
      if (!priced) return { ok: false, reason: 'nothing-returnable' };

      const counter = await idbGet<{ key: string; value: number }>(
        tx,
        STORE_LOCAL_COUNTERS,
        RECEIPT_COUNTER_KEY,
      );
      const next = (counter?.value ?? 0) + 1;
      await idbPut(tx, STORE_LOCAL_COUNTERS, { key: RECEIPT_COUNTER_KEY, value: next });

      // --- stock back on the shelf ---------------------------------------
      const wanted = new Map<string, Map<string, number>>();
      for (const line of priced.lines) {
        const sizeKey = line.selectedSize || '_default';
        const bucket = wanted.get(line.productId) ?? new Map<string, number>();
        bucket.set(sizeKey, (bucket.get(sizeKey) ?? 0) + Math.abs(line.quantity));
        wanted.set(line.productId, bucket);
      }

      const movements: LocalStockMovement[] = [];

      for (const [productId, sizes] of wanted) {
        const product = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, productId);
        if (!product) continue;

        const stock = { ...product.stock };
        for (const [sizeKey, qty] of sizes) {
          stock[sizeKey] = (stock[sizeKey] ?? 0) + qty;
        }
        await idbPut(tx, STORE_LOCAL_PRODUCTS, {
          ...product,
          stock,
          updatedAtMillis: input.committedAtMillis,
        });

        if (!product.tracksLots) continue;

        // Through the `by-product` index, not `idbGetAll`. The whole ledger is
        // every movement a shop has ever made, and reading it inside a
        // readwrite transaction holding five stores -- once per lot-tracked
        // product on the refund -- is a transaction held open across a scan
        // that grows without bound.
        const ledger = await idbGetAllByIndex<LocalStockMovement>(
          tx,
          STORE_LOCAL_MOVEMENTS,
          'by-product',
          productId,
        );

        // Matched on the movement id rather than on `reference`. Both work
        // today, but the id carries the sale's own key and a receipt number is
        // a display string a shop can re-sequence.
        const drawn = ledger.filter((m) => m.id.startsWith(`sale:${original.saleId}:`));

        // How much earlier refunds against THIS sale already put back on each
        // lot. Without it a second partial return refills a lot from the same
        // draw a second time, and a lot ends up holding more than the sale ever
        // took off it -- so the shelf and the ledger disagree, and the next
        // restore reconciles the difference away.
        const backAlready = new Map<string, number>();
        for (const movement of ledger) {
          if (!movement.id.startsWith('refund:')) continue;
          const refundId = movement.id.slice('refund:'.length).split(':')[0];
          if (!priorIds.has(refundId)) continue;
          backAlready.set(movement.lotId, (backAlready.get(movement.lotId) ?? 0) + movement.quantity);
        }

        for (const [sizeKey, qty] of sizes) {
          let left = qty;
          for (const draw of drawn.filter((m) => m.sizeKey === sizeKey && m.lotId)) {
            if (left <= 0) break;
            const lot = await idbGet<LocalStockLot>(tx, STORE_LOCAL_LOTS, draw.lotId);
            if (!lot) continue;
            // Room on this lot is what the sale took off it MINUS what has
            // already gone back.
            const room = Math.abs(draw.quantity) - (backAlready.get(draw.lotId) ?? 0);
            if (room <= 0) continue;
            const back = Math.min(left, room);
            await idbPut(tx, STORE_LOCAL_LOTS, {
              ...lot,
              remainingQty: lot.remainingQty + back,
            });
            left -= back;
            movements.push(
              refundMovement(input, product, sizeKey, lot.id, back, receiptNumber(receiptPrefix, next)),
            );
          }

          if (left > 0) {
            // Nothing to put it back on -- the sale oversold, so some units
            // never came off a lot. They must still land on ONE, because
            // `reconcileLotProjection` rebuilds `stock` from the sum of the
            // lots after every restore and would quietly reconcile lotless
            // units away.
            const fresh: LocalStockLot = {
              id: newLocalId(),
              productId,
              sizeKey,
              lotCode: '',
              // No expiry: the till cannot know what date came back, and
              // guessing one would put a real date on a batch nobody checked.
              // An undated lot sorts last under FEFO, which is the safe end.
              expiresOn: '',
              receivedQty: left,
              remainingQty: left,
              unitCost: product.costPrice ?? 0,
              supplierId: '',
              receiptId: '',
              receivedAtMillis: input.committedAtMillis,
              note: '',
            };
            await idbPut(tx, STORE_LOCAL_LOTS, fresh);
            movements.push(
              refundMovement(input, product, sizeKey, fresh.id, left, receiptNumber(receiptPrefix, next)),
            );
          }
        }
      }

      // Products with no lot tracking get one movement per product+size, NOT
      // per line: a refund covering two lines of the same product and size
      // would otherwise write two movements with the same id -- they share
      // `refund:<id>:<product>:<size>:` and an empty lot -- and the second
      // would silently overwrite the first, halving the stock put back.
      for (const [productId, sizes] of wanted) {
        const product = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, productId);
        if (!product || product.tracksLots) continue;
        for (const [sizeKey, qty] of sizes) {
          movements.push(
            refundMovement(
              input,
              { id: productId },
              sizeKey,
              '',
              qty,
              receiptNumber(receiptPrefix, next),
            ),
          );
        }
      }

      const refund: LocalSale = {
        saleId: input.refundId,
        receiptNumber: receiptNumber(receiptPrefix, next),
        deviceId: input.deviceId,
        lines: priced.lines,
        // Negative, like everything else on the row. `shift-totals` sums a
        // tender's `amount` as the cash that netted into the drawer, so this is
        // what makes a cash refund reduce `expectedCash` with no arithmetic
        // change anywhere.
        tenders: input.tenders.map((tender) => ({
          kind: tender.kind,
          amount: -Math.abs(tender.amount),
          ...(tender.reference ? { reference: tender.reference } : {}),
        })),
        subtotal: priced.subtotal,
        discount: priced.discount,
        total: priced.total,
        committedAtMillis: input.committedAtMillis,
        cashierId: input.cashierId,
        cashierName: input.cashierName,
        stockShortfall: [],
        kind: 'refund',
        originalSaleId: original.saleId,
        originalReceiptNumber: original.receiptNumber,
        refundReason: input.reason,
        ...(input.note.trim() ? { refundNote: input.note.trim() } : {}),
        ...(input.terminalId ? { terminalId: input.terminalId } : {}),
        ...(input.terminalName ? { terminalName: input.terminalName } : {}),
        ...(input.shiftId ? { shiftId: input.shiftId } : {}),
      };

      await idbPut(tx, STORE_LOCAL_SALES, refund);
      for (const movement of movements) await idbPut(tx, STORE_LOCAL_MOVEMENTS, movement);

      return { ok: true, refund, duplicate: false };
    },
  );
}

function receiptNumber(prefix: string, ordinal: number): string {
  return `${prefix}-${String(ordinal).padStart(RECEIPT_PAD, '0')}`;
}

/**
 * Id mirrors the `sale:` shape, so a retried commit overwrites its own rows
 * rather than doubling the stock it puts back.
 */
function refundMovement(
  input: LocalRefundInput,
  product: { id: string },
  sizeKey: string,
  lotId: string,
  quantity: number,
  reference: string,
): LocalStockMovement {
  return {
    id: `refund:${input.refundId}:${product.id}:${sizeKey}:${lotId}`,
    productId: product.id,
    sizeKey,
    lotId,
    kind: 'return',
    quantity,
    reason: 'customer-return',
    reference,
    unitCost: 0,
    userId: input.cashierId,
    userName: input.cashierName,
    atMillis: input.committedAtMillis,
    note: '',
  };
}
