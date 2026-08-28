/**
 * Data access for a standalone till.
 *
 * Sits on the same IndexedDB wrapper as the offline queue rather than opening a
 * second database, so a sale and the receipt number it spends can be written in
 * one transaction. That atomicity is the whole reason this is not localStorage:
 * a crash between "record the sale" and "advance the counter" would either lose
 * money or print the same receipt number twice.
 */

import type { Product } from '@caspian-explorer/script-caspian-store';
import {
  STORE_LOCAL_CATEGORIES,
  STORE_LOCAL_COUNTERS,
  STORE_LOCAL_LOTS,
  STORE_LOCAL_MOVEMENTS,
  STORE_LOCAL_OPENING_CASH,
  STORE_LOCAL_PRODUCTS,
  STORE_LOCAL_RECEIPTS,
  STORE_LOCAL_ROLES,
  STORE_LOCAL_SALES,
  STORE_LOCAL_SETTINGS,
  STORE_LOCAL_SHIFTS,
  STORE_LOCAL_SUPPLIERS,
  STORE_LOCAL_TERMINALS,
  STORE_LOCAL_USERS,
  STORE_TICKET,
  idbDelete,
  idbGet,
  idbGetAll,
  idbGetAllByIndex,
  idbPut,
  posIdbAvailable,
  posTx,
} from '../offline/pos-queue-db';
import {
  BUILTIN_ROLES,
  DEFAULT_LOCAL_SHOP_SETTINGS,
  type LocalCategory,
  type LocalOpeningCash,
  type LocalProduct,
  type LocalSale,
  type LocalShopSettings,
  type LocalStockAdjustReason,
  type LocalStockLot,
  type LocalStockMovement,
  type LocalStockReceipt,
  type LocalSupplier,
  type LocalUser,
  type RoleDefinition,
} from './types';
import { latestOpeningCash, localDayKey } from './opening-cash';
import { fromMinor, toMinor } from '../money';
import { priceLocalSale, type PricedLineInput } from './price-local-sale';
import {
  DEFAULT_SIZE_KEY,
  allocateFefo,
  receiptTotals,
  saleStockMovements,
  sortLotsFefo,
} from './lot-allocation';

const RECEIPT_COUNTER_KEY = 'receipt';
const SETTINGS_KEY = 'shop';

/** Six digits to match the cloud register's `R-000123`, so receipts look the same either way. */
const RECEIPT_PAD = 6;


export function localStoreAvailable(): boolean {
  return posIdbAvailable();
}

export function newLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// --- Products ---

/**
 * Hand the register a `Product`, the shape every POS screen already speaks.
 *
 * The unused storefront fields are filled rather than omitted: `PosRegister`,
 * the ticket and the receipt builder all read `Product`, and making them
 * tolerate a narrower type would spread standalone's concerns across files that
 * have no business knowing which mode they are running in.
 */
export function toProduct(local: LocalProduct): Product {
  return {
    id: local.id,
    name: local.name,
    brand: '',
    description: local.description,
    price: local.price,
    sku: local.sku,
    barcode: local.barcode,
    category: local.category,
    sizes: local.sizes,
    stock: local.stock,
    isActive: local.isActive,
    images: local.imageUrl
      ? [{ id: `${local.id}-0`, url: local.imageUrl, alt: local.name, hint: '' }]
      : [],
  };
}

export function makeLocalProduct(
  input: Partial<LocalProduct> & { name: string; price: number },
): LocalProduct {
  const now = Date.now();
  const name = input.name.trim();
  return {
    id: input.id || newLocalId(),
    name,
    nameLower: name.toLowerCase(),
    price: input.price,
    sku: (input.sku ?? '').trim(),
    barcode: (input.barcode ?? '').trim(),
    category: (input.category ?? '').trim(),
    sizes: input.sizes ?? [],
    stock: input.stock ?? {},
    isActive: input.isActive !== false,
    imageUrl: input.imageUrl ?? '',
    description: input.description ?? '',
    tracksLots: input.tracksLots === true,
    costPrice: input.costPrice ?? 0,
    createdAtMillis: input.createdAtMillis ?? now,
    updatedAtMillis: now,
  };
}

/**
 * Fill in fields a row on disk predates.
 *
 * Products are read straight out of `getAll` with no merge step, unlike shop
 * settings, so a catalogue written before `description`, `tracksLots` and
 * `costPrice` existed hands back `undefined` for all three and every screen
 * reading them has to defend itself. Normalising on the way out keeps the three
 * fields required in the type and means no migration ever runs -- a till that
 * upgrades overnight is not a till that rewrites its whole catalogue on boot.
 */
function hydrateLocalProduct(row: LocalProduct): LocalProduct {
  if (
    typeof row.description === 'string' &&
    typeof row.tracksLots === 'boolean' &&
    typeof row.costPrice === 'number'
  ) {
    return row;
  }
  return {
    ...row,
    description: row.description ?? '',
    tracksLots: row.tracksLots === true,
    costPrice: row.costPrice ?? 0,
  };
}

export async function listLocalProducts(): Promise<LocalProduct[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_PRODUCTS, 'readonly', (tx) =>
    idbGetAll<LocalProduct>(tx, STORE_LOCAL_PRODUCTS),
  );
  return all.map(hydrateLocalProduct).sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}

export async function getLocalProduct(id: string): Promise<LocalProduct | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_PRODUCTS, 'readonly', (tx) =>
    idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, id),
  );
  return row ? hydrateLocalProduct(row) : null;
}

/**
 * Another item already using this item's barcode or SKU, or `null`.
 *
 * Neither `by-barcode` nor `by-sku` is a unique index, and that is not an
 * oversight in the schema so much as one nobody had cause to notice:
 * `localUsers.by-username` IS unique, so the option was known. Uniqueness is
 * enforced here instead of there because a clash has to be REPORTED -- an index
 * that rejects the write gives a cashier a `ConstraintError`, not the name of
 * the item they have collided with.
 *
 * A blank code is not a clash. Most shops leave SKU empty on most items, and
 * "" is not a code two items are sharing.
 */
export type LocalCodeClash = { field: 'barcode' | 'sku'; product: LocalProduct };

async function findCodeClash(
  tx: IDBTransaction,
  product: LocalProduct,
): Promise<LocalCodeClash | null> {
  const fields: Array<'barcode' | 'sku'> = ['barcode', 'sku'];
  for (const field of fields) {
    const code = (product[field] ?? '').trim();
    if (!code) continue;
    const rows = await idbGetAllByIndex<LocalProduct>(
      tx,
      STORE_LOCAL_PRODUCTS,
      field === 'barcode' ? 'by-barcode' : 'by-sku',
      code,
    );
    const other = rows.find((row) => row.id !== product.id);
    if (other) return { field, product: hydrateLocalProduct(other) };
  }
  return null;
}

/**
 * Thrown rather than returned so no call site can save and ignore the clash.
 * Carries the item collided with, because "that barcode is taken" without
 * saying what took it leaves a shop hunting through its own catalogue.
 */
export class LocalCodeClashError extends Error {
  readonly clash: LocalCodeClash;
  constructor(clash: LocalCodeClash) {
    super(`${clash.field} already used by ${clash.product.name}`);
    this.name = 'LocalCodeClashError';
    this.clash = clash;
  }
}

export async function saveLocalProduct(product: LocalProduct): Promise<void> {
  await posTx(STORE_LOCAL_PRODUCTS, 'readwrite', async (tx) => {
    // Inside the transaction, not before it. Two tabs saving the same barcode
    // would both pass a check made beforehand, and IndexedDB serialises
    // overlapping readwrite transactions on a store -- so this is the only
    // place the check actually holds.
    const clash = await findCodeClash(tx, product);
    if (clash) throw new LocalCodeClashError(clash);
    await idbPut(tx, STORE_LOCAL_PRODUCTS, product);
  });
}

/**
 * Bulk upsert. One transaction, so a failed write lands nothing.
 *
 * Deliberately does NOT check for duplicate barcodes, unlike its single-product
 * sibling. Its only callers are the backup restore and the lot repair that
 * follows one, and a shop restoring its own file must always succeed: a
 * catalogue written before that check existed can hold two items on one
 * barcode, and refusing the restore would hand somebody a file they can no
 * longer open in exchange for a rule about data they already have. The clash
 * surfaces the next time either item is edited, which is the right moment --
 * somebody is looking at it.
 */
export async function saveLocalProducts(products: LocalProduct[]): Promise<number> {
  if (!products.length) return 0;
  await posTx(STORE_LOCAL_PRODUCTS, 'readwrite', async (tx) => {
    for (const p of products) await idbPut(tx, STORE_LOCAL_PRODUCTS, p);
  });
  return products.length;
}

export async function deleteLocalProduct(id: string): Promise<void> {
  await posTx(STORE_LOCAL_PRODUCTS, 'readwrite', (tx) => idbDelete(tx, STORE_LOCAL_PRODUCTS, id));
}

export async function localProductCount(): Promise<number> {
  return (await listLocalProducts()).length;
}

export interface LocalLookup {
  matchedBy: 'barcode' | 'sku' | 'id';
  products: Product[];
}

/**
 * Resolve a scanned code. Barcode, then SKU, then id — the same precedence as
 * `findProductByCode` and `lookupCachedByCode`, so a cashier moved between a
 * cloud till and a standalone one sees identical behaviour.
 */
export async function lookupLocalByCode(code: string): Promise<LocalLookup | null> {
  if (!localStoreAvailable()) return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  return posTx(STORE_LOCAL_PRODUCTS, 'readonly', async (tx) => {
    const byBarcode = await idbGetAllByIndex<LocalProduct>(
      tx,
      STORE_LOCAL_PRODUCTS,
      'by-barcode',
      trimmed,
    );
    const activeBarcode = byBarcode.filter((p) => p.isActive);
    if (activeBarcode.length) {
      return {
        matchedBy: 'barcode' as const,
        products: activeBarcode.map((p) => toProduct(hydrateLocalProduct(p))),
      };
    }

    const bySku = await idbGetAllByIndex<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, 'by-sku', trimmed);
    const activeSku = bySku.filter((p) => p.isActive);
    if (activeSku.length) {
      return {
        matchedBy: 'sku' as const,
        products: activeSku.map((p) => toProduct(hydrateLocalProduct(p))),
      };
    }

    const byId = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, trimmed);
    if (byId && byId.isActive) {
      return { matchedBy: 'id' as const, products: [toProduct(hydrateLocalProduct(byId))] };
    }
    return null;
  });
}

export async function searchLocalProducts(term: string, max = 40): Promise<Product[]> {
  if (!localStoreAvailable()) return [];
  const needle = term.trim().toLowerCase();
  const all = await listLocalProducts();
  const active = all.filter((p) => p.isActive);
  if (!needle) return active.slice(0, max).map(toProduct);
  return active
    .filter(
      (p) =>
        p.nameLower.includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        p.barcode.toLowerCase().includes(needle),
    )
    .slice(0, max)
    .map(toProduct);
}

// --- Users ---

export async function listLocalUsers(): Promise<LocalUser[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_USERS, 'readonly', (tx) =>
    idbGetAll<LocalUser>(tx, STORE_LOCAL_USERS),
  );
  return all.sort((a, b) => a.username.localeCompare(b.username));
}

export async function getLocalUser(id: string): Promise<LocalUser | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_USERS, 'readonly', (tx) =>
    idbGet<LocalUser>(tx, STORE_LOCAL_USERS, id),
  );
  return row ?? null;
}

export async function getLocalUserByUsername(username: string): Promise<LocalUser | null> {
  if (!localStoreAvailable()) return null;
  const key = username.trim().toLowerCase();
  if (!key) return null;
  const rows = await posTx(STORE_LOCAL_USERS, 'readonly', (tx) =>
    idbGetAllByIndex<LocalUser>(tx, STORE_LOCAL_USERS, 'by-username', key),
  );
  return rows[0] ?? null;
}

export async function saveLocalUser(user: LocalUser): Promise<void> {
  await posTx(STORE_LOCAL_USERS, 'readwrite', (tx) => idbPut(tx, STORE_LOCAL_USERS, user));
}

export async function deleteLocalUser(id: string): Promise<void> {
  await posTx(STORE_LOCAL_USERS, 'readwrite', (tx) => idbDelete(tx, STORE_LOCAL_USERS, id));
}

export async function localUserCount(): Promise<number> {
  return (await listLocalUsers()).length;
}

// --- Sales and the receipt counter ---

export async function getLocalSale(saleId: string): Promise<LocalSale | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_SALES, 'readonly', (tx) =>
    idbGet<LocalSale>(tx, STORE_LOCAL_SALES, saleId),
  );
  return row ?? null;
}

export async function listLocalSales(
  fromMillis = 0,
  toMillis = Number.MAX_SAFE_INTEGER,
): Promise<LocalSale[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_SALES, 'readonly', (tx) =>
    idbGetAll<LocalSale>(tx, STORE_LOCAL_SALES),
  );
  return all
    .filter((s) => s.committedAtMillis >= fromMillis && s.committedAtMillis <= toMillis)
    .sort((a, b) => b.committedAtMillis - a.committedAtMillis);
}

/**
 * Write a sale, spend its receipt number, and decrement stock — all in one
 * transaction, keyed on `saleId`.
 *
 * Idempotent by contract (`PosStorageAdapter.commitSale`): committing the same
 * draft twice yields one sale and reports the second as a duplicate. A retry
 * after a crash must not take stock down twice or burn a second number.
 *
 * Stock is decremented but never gated, matching the cloud register: the
 * customer is already holding the goods and the money is already in the drawer,
 * so refusing the write would lose the sale record, which is strictly worse
 * than recording an oversell. A shortfall is stamped on the sale instead.
 */
export type LocalCommitLine = PricedLineInput;

export interface LocalCommitInput {
  saleId: string;
  deviceId: string;
  lines: LocalCommitLine[];
  tenders: LocalSale['tenders'];
  cashierId: string;
  cashierName: string;
  committedAtMillis: number;
  /**
   * Which counter rang it, and which turn at that counter.
   *
   * Resolved by the caller rather than looked up here, so this module keeps no
   * dependency on the roster or the shift store -- `local-terminals.ts` and
   * `local-shifts.ts` import from here, and a lookup in this direction would
   * close the loop. Absent on a till with no roster or with shifts switched
   * off, which is every till until an owner sets one up.
   */
  terminalId?: string;
  terminalName?: string;
  shiftId?: string;
}

export async function commitLocalSale(
  input: LocalCommitInput,
  receiptPrefix: string,
): Promise<{ sale: LocalSale; duplicate: boolean }> {
  return posTx(
    [
      STORE_LOCAL_SALES,
      STORE_LOCAL_PRODUCTS,
      STORE_LOCAL_COUNTERS,
      STORE_LOCAL_LOTS,
      STORE_LOCAL_MOVEMENTS,
    ],
    'readwrite',
    async (tx) => {
      const existing = await idbGet<LocalSale>(tx, STORE_LOCAL_SALES, input.saleId);
      if (existing) return { sale: existing, duplicate: true };

      const counter = await idbGet<{ key: string; value: number }>(
        tx,
        STORE_LOCAL_COUNTERS,
        RECEIPT_COUNTER_KEY,
      );
      const next = (counter?.value ?? 0) + 1;
      await idbPut(tx, STORE_LOCAL_COUNTERS, { key: RECEIPT_COUNTER_KEY, value: next });

      // Read the catalogue inside this transaction so prices and stock come
      // from one consistent view, then hand the arithmetic to `priceLocalSale`.
      const products = new Map<string, LocalProduct | undefined>();
      for (const line of input.lines) {
        if (!products.has(line.productId)) {
          products.set(
            line.productId,
            await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, line.productId),
          );
        }
      }

      // Read in the same transaction as the products, for the same reason: a
      // delivery landing mid-sale must not leave the draw and the shelf
      // disagreeing. Only lot-tracked products are looked up, so a shop that
      // has never turned lots on does no extra reads.
      const lots = new Map<string, LocalStockLot[]>();
      for (const product of products.values()) {
        if (!product?.tracksLots || lots.has(product.id)) continue;
        lots.set(
          product.id,
          await idbGetAllByIndex<LocalStockLot>(tx, STORE_LOCAL_LOTS, 'by-product', product.id),
        );
      }

      const priced = priceLocalSale(input.lines, products, lots);

      for (const [productId, stock] of priced.stockAfter) {
        const product = products.get(productId);
        if (!product) continue;
        await idbPut(tx, STORE_LOCAL_PRODUCTS, {
          ...product,
          stock,
          updatedAtMillis: input.committedAtMillis,
        });
      }

      const lotById = new Map<string, LocalStockLot>();
      for (const forProduct of lots.values()) {
        for (const lot of forProduct) lotById.set(lot.id, lot);
      }
      for (const [lotId, remainingQty] of priced.lotsAfter) {
        const lot = lotById.get(lotId);
        if (!lot) continue;
        await idbPut(tx, STORE_LOCAL_LOTS, { ...lot, remainingQty });
      }

      const committed: LocalSale = {
        saleId: input.saleId,
        receiptNumber: `${receiptPrefix}-${String(next).padStart(RECEIPT_PAD, '0')}`,
        deviceId: input.deviceId,
        lines: priced.lines,
        tenders: input.tenders,
        subtotal: priced.subtotal,
        discount: priced.discount,
        total: priced.total,
        committedAtMillis: input.committedAtMillis,
        cashierId: input.cashierId,
        cashierName: input.cashierName,
        stockShortfall: priced.stockShortfall,
        // Spread rather than assigned, so a till with no roster writes a sale
        // with no `terminalId` key at all rather than one holding `undefined` --
        // which IndexedDB stores faithfully and the CSV then renders as the word.
        ...(input.terminalId ? { terminalId: input.terminalId } : {}),
        ...(input.terminalName ? { terminalName: input.terminalName } : {}),
        ...(input.shiftId ? { shiftId: input.shiftId } : {}),
      };
      await idbPut(tx, STORE_LOCAL_SALES, committed);

      // Written here rather than derived later, and inside this transaction
      // rather than after it: a ledger that can disagree with the sale that
      // caused it is worse than no ledger.
      for (const movement of saleStockMovements(committed, priced.lotDraws)) {
        await idbPut(tx, STORE_LOCAL_MOVEMENTS, movement);
      }

      return { sale: committed, duplicate: false };
    },
  );
}

/** What the counter is currently at. For the admin report, never for allocation. */
export async function peekLocalReceiptCounter(): Promise<number> {
  if (!localStoreAvailable()) return 0;
  const row = await posTx(STORE_LOCAL_COUNTERS, 'readonly', (tx) =>
    idbGet<{ key: string; value: number }>(tx, STORE_LOCAL_COUNTERS, RECEIPT_COUNTER_KEY),
  );
  return row?.value ?? 0;
}

// --- Stock: lots, the ledger, and deliveries ---

/**
 * Resolve a scanned code to the product record itself.
 *
 * Unlike `lookupLocalByCode`, which answers the register and therefore only
 * offers what is on sale, this one includes hidden products: a delivery of
 * something taken off the shelf last month is still a delivery, and refusing to
 * find it would leave a storekeeper creating a duplicate of a product they
 * already have. Same barcode-then-SKU-then-id precedence, so the same scan
 * finds the same item on both screens.
 */
export async function lookupLocalProductByCode(code: string): Promise<LocalProduct | null> {
  if (!localStoreAvailable()) return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  return posTx(STORE_LOCAL_PRODUCTS, 'readonly', async (tx) => {
    for (const index of ['by-barcode', 'by-sku'] as const) {
      const hits = await idbGetAllByIndex<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, index, trimmed);
      const first = hits[0];
      if (first) return hydrateLocalProduct(first);
    }
    const byId = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, trimmed);
    return byId ? hydrateLocalProduct(byId) : null;
  });
}

/** Every lot of one product, earliest expiry first. Empty ones included — they are the record. */
export async function listLocalLots(productId: string): Promise<LocalStockLot[]> {
  if (!localStoreAvailable()) return [];
  const rows = await posTx(STORE_LOCAL_LOTS, 'readonly', (tx) =>
    idbGetAllByIndex<LocalStockLot>(tx, STORE_LOCAL_LOTS, 'by-product', productId),
  );
  return sortLotsFefo(rows);
}

/**
 * Every lot on the till.
 *
 * For the two callers that genuinely want all of them: the backup, which is the
 * shop's only copy, and the products list, which shows one expiry badge per row
 * and would otherwise do a read per product.
 */
export async function listAllLocalLots(): Promise<LocalStockLot[]> {
  if (!localStoreAvailable()) return [];
  return posTx(STORE_LOCAL_LOTS, 'readonly', (tx) => idbGetAll<LocalStockLot>(tx, STORE_LOCAL_LOTS));
}

/** One product's ledger, newest first. */
export async function listLocalMovements(productId: string): Promise<LocalStockMovement[]> {
  if (!localStoreAvailable()) return [];
  const rows = await posTx(STORE_LOCAL_MOVEMENTS, 'readonly', (tx) =>
    idbGetAllByIndex<LocalStockMovement>(tx, STORE_LOCAL_MOVEMENTS, 'by-product', productId),
  );
  return rows.sort((a, b) => b.atMillis - a.atMillis);
}

/** Posted deliveries, newest first. Drafts are deliberately left out. */
export async function listLocalStockReceipts(limit = 100): Promise<LocalStockReceipt[]> {
  if (!localStoreAvailable()) return [];
  const rows = await posTx(STORE_LOCAL_RECEIPTS, 'readonly', (tx) =>
    idbGetAll<LocalStockReceipt>(tx, STORE_LOCAL_RECEIPTS),
  );
  return rows
    .filter((r) => r.status === 'posted')
    .sort((a, b) => b.receivedAtMillis - a.receivedAtMillis)
    .slice(0, limit);
}

export async function getLocalStockReceipt(id: string): Promise<LocalStockReceipt | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_RECEIPTS, 'readonly', (tx) =>
    idbGet<LocalStockReceipt>(tx, STORE_LOCAL_RECEIPTS, id),
  );
  return row ?? null;
}

/**
 * The delivery somebody is part-way through entering, if there is one.
 *
 * Same posture as the register's open ticket: forty scans should survive a
 * dropped tab. Only one draft is kept — a till receives one delivery at a time,
 * and offering a list of half-finished ones would be a way to post the wrong
 * one.
 */
export async function readLocalStockReceiptDraft(): Promise<LocalStockReceipt | null> {
  if (!localStoreAvailable()) return null;
  const rows = await posTx(STORE_LOCAL_RECEIPTS, 'readonly', (tx) =>
    idbGetAllByIndex<LocalStockReceipt>(tx, STORE_LOCAL_RECEIPTS, 'by-status', 'draft'),
  );
  return rows.sort((a, b) => b.receivedAtMillis - a.receivedAtMillis)[0] ?? null;
}

export async function writeLocalStockReceiptDraft(draft: LocalStockReceipt): Promise<void> {
  await posTx(STORE_LOCAL_RECEIPTS, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_RECEIPTS, { ...draft, status: 'draft' as const }),
  );
}

export async function discardLocalStockReceiptDraft(id: string): Promise<void> {
  await posTx(STORE_LOCAL_RECEIPTS, 'readwrite', (tx) => idbDelete(tx, STORE_LOCAL_RECEIPTS, id));
}

/**
 * Post a delivery: create its lots, put the stock on the shelf, and say so.
 *
 * One transaction over four stores, so a delivery cannot half-land. Stock and
 * lots move together for the reason the whole design turns on — for a
 * lot-tracked product `LocalProduct.stock` is a projection of the lots, and a
 * projection written by a different transaction is a projection that drifts.
 *
 * A lot is created per line rather than merged into a matching one, even when
 * the code and date are identical: two cases of the same batch bought a week
 * apart cost different money and were counted by different people, and merging
 * them throws that away.
 */
export async function postLocalStockReceipt(
  receipt: LocalStockReceipt,
): Promise<LocalStockReceipt> {
  const totals = receiptTotals(receipt.lines);
  const posted: LocalStockReceipt = { ...receipt, totalCost: totals.totalCost, status: 'posted' };

  await posTx(
    [STORE_LOCAL_PRODUCTS, STORE_LOCAL_LOTS, STORE_LOCAL_MOVEMENTS, STORE_LOCAL_RECEIPTS],
    'readwrite',
    async (tx) => {
      // Idempotent on the receipt id, the way `commitLocalSale` is on the sale
      // id. Without this, a second call -- the same draft posted from another
      // tab, or a retry after a screen that looked stuck -- would put the whole
      // delivery on the shelf twice, and the movement ids are per line rather
      // than per attempt so nothing downstream would notice.
      const already = await idbGet<LocalStockReceipt>(tx, STORE_LOCAL_RECEIPTS, posted.id);
      if (already?.status === 'posted') return;

      for (const [index, line] of posted.lines.entries()) {
        const quantity = Math.max(0, Math.round(line.quantity));
        if (quantity <= 0) continue;

        const stored = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, line.productId);
        // A product deleted between entering the line and posting it. The line
        // is skipped rather than recreating the product: a delivery is not the
        // place to resurrect something somebody chose to remove.
        if (!stored) continue;
        const product = hydrateLocalProduct(stored);
        const sizeKey = line.sizeKey || DEFAULT_SIZE_KEY;
        const unitCost = Math.max(0, line.unitCost);

        // Only for a product that tracks them. A lot nothing ever draws down
        // would sit at its full quantity for ever, and the day a shop switched
        // tracking on for that product it would inherit a shelf full of batches
        // that were sold months ago. What the delivery cost and who it came
        // from is on the receipt and on the ledger row either way.
        let lotId = '';
        if (product.tracksLots) {
          const lot: LocalStockLot = {
            id: newLocalId(),
            productId: product.id,
            sizeKey,
            lotCode: line.lotCode,
            expiresOn: line.expiresOn,
            receivedQty: quantity,
            remainingQty: quantity,
            unitCost,
            supplierId: posted.supplierId,
            receiptId: posted.id,
            receivedAtMillis: posted.receivedAtMillis,
            note: line.note,
          };
          await idbPut(tx, STORE_LOCAL_LOTS, lot);
          lotId = lot.id;
        }

        await idbPut(tx, STORE_LOCAL_PRODUCTS, {
          ...product,
          stock: { ...product.stock, [sizeKey]: (product.stock[sizeKey] ?? 0) + quantity },
          costPrice: unitCost,
          updatedAtMillis: posted.receivedAtMillis,
        });

        const movement: LocalStockMovement = {
          id: `receipt:${posted.id}:${index}`,
          productId: product.id,
          sizeKey,
          lotId,
          kind: 'receipt',
          quantity,
          reason: '',
          reference: posted.reference,
          unitCost,
          userId: posted.userId,
          userName: posted.userName,
          atMillis: posted.receivedAtMillis,
          note: line.note,
        };
        await idbPut(tx, STORE_LOCAL_MOVEMENTS, movement);
      }

      await idbPut(tx, STORE_LOCAL_RECEIPTS, posted);
    },
  );

  return posted;
}

export interface LocalStockAdjustInput {
  productId: string;
  sizeKey: string;
  /** Signed. Positive puts stock back on the shelf. */
  quantity: number;
  reason: LocalStockAdjustReason;
  note: string;
  userId: string;
  userName: string;
  /** Which lot to move, for a product that tracks them. Blank picks by expiry. */
  lotId?: string;
}

/**
 * Move stock by hand, and say why.
 *
 * The one route a return reaches the books by: the register has no refund flow,
 * so a customer handing something back is recorded here, and `customer-return`
 * is the only reason that counts towards the Returned figure on a product page.
 * Everything else is an adjustment — a write-off, a recount, a case that went
 * out of date on the shelf.
 *
 * A negative adjustment on a lot-tracked product comes off the earliest expiry
 * first, the same order a sale would take it, unless a lot was named. A positive
 * one goes back on the lot it was named against, or onto a fresh undated lot —
 * putting a returned item back on an arbitrary batch would hand it an expiry
 * date nobody checked.
 */
export async function adjustLocalStock(input: LocalStockAdjustInput): Promise<number> {
  const at = Date.now();
  const sizeKey = input.sizeKey || DEFAULT_SIZE_KEY;
  const quantity = Math.round(input.quantity);
  if (!quantity) return 0;
  let moved = 0;

  await posTx(
    [STORE_LOCAL_PRODUCTS, STORE_LOCAL_LOTS, STORE_LOCAL_MOVEMENTS],
    'readwrite',
    async (tx) => {
      const stored = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, input.productId);
      if (!stored) return;
      const product = hydrateLocalProduct(stored);

      // What actually moved, which for a lot-tracked product can be less than
      // what was asked for. `LocalProduct.stock` is a projection of the lots, so
      // taking five off the shelf when the batches only hold three would leave
      // the two disagreeing for ever -- and the shelf figure is the one the
      // register sells against.
      moved = quantity;
      // One row per lot touched, so an adjustment that spans two batches is
      // legible afterwards. A single row naming only the first batch is how a
      // recall goes wrong.
      const drawn: Array<{ lotId: string; quantity: number }> = [];

      let lotId = input.lotId ?? '';
      if (product.tracksLots) {
        const lots = (
          await idbGetAllByIndex<LocalStockLot>(tx, STORE_LOCAL_LOTS, 'by-product', product.id)
        ).filter((lot) => lot.sizeKey === sizeKey);

        if (quantity < 0) {
          const eligible = lotId ? lots.filter((lot) => lot.id === lotId) : lots;
          const allocation = allocateFefo(eligible, -quantity);
          for (const draw of allocation.draws) {
            const lot = lots.find((candidate) => candidate.id === draw.lotId);
            if (!lot) continue;
            await idbPut(tx, STORE_LOCAL_LOTS, {
              ...lot,
              remainingQty: lot.remainingQty - draw.quantity,
            });
            drawn.push({ lotId: draw.lotId, quantity: -draw.quantity });
            lotId = lotId || draw.lotId;
          }
          moved = -(-quantity - allocation.unfulfilled);
        } else {
          const target = lots.find((lot) => lot.id === lotId);
          if (target) {
            await idbPut(tx, STORE_LOCAL_LOTS, {
              ...target,
              remainingQty: target.remainingQty + quantity,
            });
          } else {
            const lot: LocalStockLot = {
              id: newLocalId(),
              productId: product.id,
              sizeKey,
              lotCode: '',
              expiresOn: '',
              receivedQty: quantity,
              remainingQty: quantity,
              unitCost: product.costPrice,
              supplierId: '',
              receiptId: '',
              receivedAtMillis: at,
              note: input.note,
            };
            await idbPut(tx, STORE_LOCAL_LOTS, lot);
            lotId = lot.id;
          }
          drawn.push({ lotId, quantity });
        }
      }

      if (!moved) return;

      await idbPut(tx, STORE_LOCAL_PRODUCTS, {
        ...product,
        stock: { ...product.stock, [sizeKey]: (product.stock[sizeKey] ?? 0) + moved },
        updatedAtMillis: at,
      });

      // A return is stock coming back. Somebody who picks "a customer brought it
      // back" and then "take stock off" has picked two things that contradict
      // each other, and recording a negative return would take the product
      // page's Returned figure DOWN -- so the direction wins and it is filed as
      // the adjustment it actually is.
      const kind: LocalStockMovement['kind'] =
        input.reason === 'customer-return' && moved > 0 ? 'return' : 'adjustment';

      const rows = drawn.length ? drawn : [{ lotId, quantity: moved }];
      for (const [index, row] of rows.entries()) {
        const movement: LocalStockMovement = {
          id: `${newLocalId()}:${index}`,
          productId: product.id,
          sizeKey,
          lotId: row.lotId,
          kind,
          quantity: row.quantity,
          reason: input.reason,
          reference: '',
          unitCost: 0,
          userId: input.userId,
          userName: input.userName,
          atMillis: at,
          note: input.note,
        };
        await idbPut(tx, STORE_LOCAL_MOVEMENTS, movement);
      }
    },
  );

  return moved;
}

/** The counter row recording that sales predating the ledger have been written in. */
const MOVEMENT_BACKFILL_KEY = 'movementBackfill';

/**
 * Write ledger rows for sales that happened before the ledger existed.
 *
 * Without this a shop that has been trading for a year upgrades, opens a product
 * page and reads "Sold 0" beside a sales screen showing hundreds — which reads
 * as a broken page, not as a new feature. Runs once, guarded by a counter row,
 * and safe to run again regardless: `saleStockMovements` gives every row a
 * deterministic id, so a second pass overwrites rather than doubles.
 *
 * Deliberately not run inside `onupgradeneeded`. A version-change transaction
 * blocks every tab until it finishes, and a year of sales is not something to
 * make a cashier wait for at eight in the morning.
 */
export async function backfillLocalStockMovements(): Promise<number> {
  if (!localStoreAvailable()) return 0;

  const done = await posTx(STORE_LOCAL_COUNTERS, 'readonly', (tx) =>
    idbGet<{ key: string; value: number }>(tx, STORE_LOCAL_COUNTERS, MOVEMENT_BACKFILL_KEY),
  );
  if (done?.value) return 0;

  const [sales, existing] = await Promise.all([
    posTx(STORE_LOCAL_SALES, 'readonly', (tx) => idbGetAll<LocalSale>(tx, STORE_LOCAL_SALES)),
    posTx(STORE_LOCAL_MOVEMENTS, 'readonly', (tx) =>
      idbGetAll<LocalStockMovement>(tx, STORE_LOCAL_MOVEMENTS),
    ),
  ]);

  /**
   * Sales the ledger already knows about, so this can only ever fill gaps.
   *
   * Deterministic ids are NOT enough on their own, and that was a real bug: a
   * sale of a lot-tracked item is written by `commitLocalSale` as one row per
   * lot, keyed `...:<lotId>`, while this pass has no draws to hand and would
   * write a single `...:none` row for the whole quantity. Different ids, both
   * kept -- and the product page would have reported everything sold since the
   * upgrade twice over.
   */
  const known = new Set<string>();
  for (const movement of existing) {
    if (!movement.id.startsWith('sale:')) continue;
    const rest = movement.id.slice('sale:'.length);
    const cut = rest.indexOf(':');
    known.add(cut < 0 ? rest : rest.slice(0, cut));
  }

  let written = 0;
  await posTx([STORE_LOCAL_MOVEMENTS, STORE_LOCAL_COUNTERS], 'readwrite', async (tx) => {
    for (const sale of sales) {
      if (known.has(sale.saleId)) continue;
      // No draws: a sale this pass has anything to say about predates lots.
      for (const movement of saleStockMovements(sale)) {
        await idbPut(tx, STORE_LOCAL_MOVEMENTS, movement);
        written += 1;
      }
    }
    await idbPut(tx, STORE_LOCAL_COUNTERS, { key: MOVEMENT_BACKFILL_KEY, value: 1 });
  });

  return written;
}

// --- Categories ---

export function makeLocalCategory(input: Partial<LocalCategory> & { name: string }): LocalCategory {
  const now = Date.now();
  const name = input.name.trim();
  return {
    id: input.id || newLocalId(),
    name,
    nameLower: name.toLowerCase(),
    sortOrder: input.sortOrder ?? now,
    createdAtMillis: input.createdAtMillis ?? now,
    updatedAtMillis: now,
  };
}

export async function listLocalCategories(): Promise<LocalCategory[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_CATEGORIES, 'readonly', (tx) =>
    idbGetAll<LocalCategory>(tx, STORE_LOCAL_CATEGORIES),
  );
  return all.sort((a, b) => a.sortOrder - b.sortOrder || a.nameLower.localeCompare(b.nameLower));
}

export async function saveLocalCategory(category: LocalCategory): Promise<void> {
  await posTx(STORE_LOCAL_CATEGORIES, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_CATEGORIES, category),
  );
}

/**
 * Rename a category and carry the products with it.
 *
 * A product stores the category NAME, so a rename that touched only this store
 * would strand every product on the old string. One transaction over both, so
 * the two can never disagree.
 */
export async function renameLocalCategory(id: string, nextName: string): Promise<void> {
  const name = nextName.trim();
  if (!name) return;
  await posTx([STORE_LOCAL_CATEGORIES, STORE_LOCAL_PRODUCTS], 'readwrite', async (tx) => {
    const category = await idbGet<LocalCategory>(tx, STORE_LOCAL_CATEGORIES, id);
    if (!category || category.name === name) return;
    const previous = category.name;
    await idbPut(tx, STORE_LOCAL_CATEGORIES, {
      ...category,
      name,
      nameLower: name.toLowerCase(),
      updatedAtMillis: Date.now(),
    });
    for (const row of await idbGetAll<LocalProduct>(tx, STORE_LOCAL_PRODUCTS)) {
      if (row.category !== previous) continue;
      await idbPut(tx, STORE_LOCAL_PRODUCTS, { ...hydrateLocalProduct(row), category: name });
    }
  });
}

/**
 * Drop a category from the vocabulary.
 *
 * Products keep the name they were given. Blanking them would silently
 * uncategorise a shelf because somebody tidied a list, and the name is still the
 * truthful answer to what that product was filed under.
 */
export async function deleteLocalCategory(id: string): Promise<void> {
  await posTx(STORE_LOCAL_CATEGORIES, 'readwrite', (tx) => idbDelete(tx, STORE_LOCAL_CATEGORIES, id));
}

/**
 * Take the categories already typed on products into the managed list.
 *
 * What a shop switching the Categories screen on has instead of an empty page:
 * it already filed its catalogue, it just did it in a free-text box.
 */
export async function adoptLocalCategoriesFromProducts(): Promise<number> {
  const [products, existing] = await Promise.all([listLocalProducts(), listLocalCategories()]);
  const known = new Set(existing.map((c) => c.nameLower));
  const found = new Map<string, string>();
  for (const product of products) {
    const name = product.category.trim();
    if (!name || known.has(name.toLowerCase())) continue;
    found.set(name.toLowerCase(), name);
  }
  if (!found.size) return 0;

  let sortOrder = existing.length;
  await posTx(STORE_LOCAL_CATEGORIES, 'readwrite', async (tx) => {
    for (const name of found.values()) {
      await idbPut(tx, STORE_LOCAL_CATEGORIES, makeLocalCategory({ name, sortOrder: sortOrder++ }));
    }
  });
  return found.size;
}

// --- Suppliers ---

export function makeLocalSupplier(input: Partial<LocalSupplier> & { name: string }): LocalSupplier {
  const now = Date.now();
  const name = input.name.trim();
  return {
    id: input.id || newLocalId(),
    name,
    nameLower: name.toLowerCase(),
    contactName: (input.contactName ?? '').trim(),
    phone: (input.phone ?? '').trim(),
    email: (input.email ?? '').trim(),
    address: (input.address ?? '').trim(),
    note: input.note ?? '',
    isActive: input.isActive !== false,
    createdAtMillis: input.createdAtMillis ?? now,
    updatedAtMillis: now,
  };
}

export async function listLocalSuppliers(): Promise<LocalSupplier[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_SUPPLIERS, 'readonly', (tx) =>
    idbGetAll<LocalSupplier>(tx, STORE_LOCAL_SUPPLIERS),
  );
  return all.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}

export async function saveLocalSupplier(supplier: LocalSupplier): Promise<void> {
  await posTx(STORE_LOCAL_SUPPLIERS, 'readwrite', (tx) => idbPut(tx, STORE_LOCAL_SUPPLIERS, supplier));
}

/**
 * Remove a supplier outright.
 *
 * Offered only for one entered by mistake — deliveries freeze the supplier's
 * name, so a real one is disabled instead and last quarter's paperwork still
 * says who it came from.
 */
export async function deleteLocalSupplier(id: string): Promise<void> {
  await posTx(STORE_LOCAL_SUPPLIERS, 'readwrite', (tx) => idbDelete(tx, STORE_LOCAL_SUPPLIERS, id));
}

// --- Opening cash ---

/**
 * Record what a cashier says is in the drawer.
 *
 * `roundCashTo` is deliberately not applied. That setting rounds the change
 * handed to a customer, so that the till never owes coins it does not stock; a
 * count is a count, and rounding one would make the record disagree with the
 * notes somebody actually held.
 *
 * Append-only: every confirmation is its own row, so a second declaration after
 * a handover sits beside the morning's rather than replacing it.
 */
export async function recordLocalOpeningCash(input: {
  amount: number;
  cashierId: string;
  cashierName: string;
  deviceId: string;
  deviceLabel: string;
  signInId: string;
}): Promise<LocalOpeningCash> {
  const now = Date.now();
  const utcOffsetMinutes = new Date(now).getTimezoneOffset();
  const row: LocalOpeningCash = {
    id: newLocalId(),
    // Through minor units so a keyed figure lands on a whole cent rather than
    // on a float the back office renders differently on every screen. A
    // negative is a slipped minus key, never a drawer, so it clamps instead of
    // refusing — the gate exists to get the counter open.
    amount: fromMinor(Math.max(0, toMinor(input.amount))),
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    deviceId: input.deviceId,
    deviceLabel: input.deviceLabel,
    confirmedAtMillis: now,
    signInId: input.signInId,
    businessDay: localDayKey(now, utcOffsetMinutes),
    utcOffsetMinutes,
  };
  await posTx(STORE_LOCAL_OPENING_CASH, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_OPENING_CASH, row),
  );
  return row;
}

/**
 * This cashier's most recent confirmation on this device, or null.
 *
 * The index narrows to the cashier and `latestOpeningCash` does the choosing,
 * so the rule the gate turns on stays checkable without an IndexedDB index
 * behaving itself.
 */
export async function latestLocalOpeningCash(
  cashierId: string,
  deviceId: string,
): Promise<LocalOpeningCash | null> {
  if (!localStoreAvailable()) return null;
  const rows = await posTx(STORE_LOCAL_OPENING_CASH, 'readonly', (tx) =>
    idbGetAllByIndex<LocalOpeningCash>(tx, STORE_LOCAL_OPENING_CASH, 'by-cashier', cashierId),
  );
  return latestOpeningCash(rows, cashierId, deviceId);
}

/** Every declaration in a window, newest first. For the back office, never for the gate. */
export async function listLocalOpeningCash(
  fromMillis = 0,
  toMillis = Number.MAX_SAFE_INTEGER,
): Promise<LocalOpeningCash[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_OPENING_CASH, 'readonly', (tx) =>
    idbGetAll<LocalOpeningCash>(tx, STORE_LOCAL_OPENING_CASH),
  );
  return all
    .filter((r) => r.confirmedAtMillis >= fromMillis && r.confirmedAtMillis <= toMillis)
    .sort((a, b) => b.confirmedAtMillis - a.confirmedAtMillis);
}

// --- Roles ---

/**
 * The single row every role definition lives in.
 *
 * Written as BOTH `id` and `key`, and that is not belt-and-braces. The store is
 * created with `keyPath: 'id'` while this code has always put `{ key, value }`
 * -- a value with no `id` is a `DataError`, so every write since the store was
 * added silently aborted its transaction and the rejection was swallowed by a
 * bare `void saveRoles(...)`. A shop that customised who may open which screen
 * got the built-in roles back on the next reload, with nothing saying so.
 *
 * Carrying both fields fixes it without a `DB_VERSION` bump: `id` satisfies the
 * store, `key` keeps rows written by a future in-line-key change readable, and
 * the existing get by `ROLES_KEY` still matches because the two are equal.
 */
const ROLES_KEY = 'roles';

export async function readLocalRoles(): Promise<RoleDefinition[]> {
  if (!localStoreAvailable()) return BUILTIN_ROLES;
  return posTx(STORE_LOCAL_ROLES, 'readonly', async (tx) => {
    const stored = await idbGet<{ key: string; value: RoleDefinition[] }>(tx, STORE_LOCAL_ROLES, ROLES_KEY);
    return stored?.value ?? BUILTIN_ROLES;
  });
}

/**
 * Split out purely so `scripts/check-standalone.mjs` can assert the `id` is
 * there. The bug this guards against needs a browser to reproduce and produced
 * no error anywhere -- exactly the shape of thing worth pinning in CI.
 */
export function localRolesRow(roles: RoleDefinition[]): {
  id: string;
  key: string;
  value: RoleDefinition[];
} {
  return { id: ROLES_KEY, key: ROLES_KEY, value: roles };
}

export async function writeLocalRoles(roles: RoleDefinition[]): Promise<RoleDefinition[]> {
  await posTx(STORE_LOCAL_ROLES, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_ROLES, localRolesRow(roles)),
  );
  return roles;
}

// --- Shop settings ---

export async function readLocalShopSettings(): Promise<LocalShopSettings> {
  if (!localStoreAvailable()) return { ...DEFAULT_LOCAL_SHOP_SETTINGS };
  const row = await posTx(STORE_LOCAL_SETTINGS, 'readonly', (tx) =>
    idbGet<{ key: string; value: LocalShopSettings }>(tx, STORE_LOCAL_SETTINGS, SETTINGS_KEY),
  );
  return { ...DEFAULT_LOCAL_SHOP_SETTINGS, ...(row?.value ?? {}) };
}

/**
 * Merge a change into the shop record.
 *
 * The read and the write are ONE transaction. They used to be two -- a
 * `readLocalShopSettings()` followed by a separate put -- and with three
 * switches on one App Admin pane that is a lost update waiting to happen:
 * flick two of them quickly and the second write merges onto a copy read
 * before the first landed, so the first silently reverts.
 */
export async function writeLocalShopSettings(
  settings: Partial<LocalShopSettings>,
): Promise<LocalShopSettings> {
  if (!localStoreAvailable()) return { ...DEFAULT_LOCAL_SHOP_SETTINGS, ...settings };
  return posTx(STORE_LOCAL_SETTINGS, 'readwrite', async (tx) => {
    const row = await idbGet<{ key: string; value: LocalShopSettings }>(
      tx,
      STORE_LOCAL_SETTINGS,
      SETTINGS_KEY,
    );
    const merged = { ...DEFAULT_LOCAL_SHOP_SETTINGS, ...(row?.value ?? {}), ...settings };
    await idbPut(tx, STORE_LOCAL_SETTINGS, { key: SETTINGS_KEY, value: merged });
    return merged;
  });
}

/**
 * Erase a standalone till completely — catalogue, staff, sales, drawer counts,
 * counters, settings, and any sale left open.
 *
 * Kept separate from `clearPosDb`, which only drops rebuildable cloud caches.
 * This one destroys records that exist nowhere else, so it is never called on a
 * cashier's behalf and never as part of a recovery path.
 */
export async function factoryResetLocalStore(): Promise<void> {
  const stores = [
    STORE_LOCAL_PRODUCTS,
    STORE_LOCAL_USERS,
    STORE_LOCAL_SALES,
    STORE_LOCAL_OPENING_CASH,
    STORE_LOCAL_COUNTERS,
    STORE_LOCAL_SETTINGS,
    STORE_LOCAL_ROLES,
    STORE_LOCAL_LOTS,
    STORE_LOCAL_MOVEMENTS,
    STORE_LOCAL_RECEIPTS,
    STORE_LOCAL_CATEGORIES,
    STORE_LOCAL_SUPPLIERS,
    STORE_LOCAL_TERMINALS,
    STORE_LOCAL_SHIFTS,
    // The sale somebody was part-way through. `clearPosDb` deliberately spares
    // it, so without this line nothing on the machine would ever erase it and a
    // till handed on to a new owner would offer them the last shop's basket.
    STORE_TICKET,
  ] as const;
  await posTx([...stores], 'readwrite', (tx) => {
    for (const s of stores) tx.objectStore(s).clear();
  });
}
