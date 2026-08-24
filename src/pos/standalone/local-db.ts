/**
 * Data access for a standalone till.
 *
 * Sits on the same IndexedDB wrapper as the offline queue rather than opening a
 * second database, so a sale and the receipt number it spends can be written in
 * one transaction. That atomicity is the whole reason this is not localStorage:
 * a crash between "record the sale" and "advance the counter" would either lose
 * money or print the same receipt number twice.
 */

import type { Product } from '../../types';
import {
  STORE_LOCAL_COUNTERS,
  STORE_LOCAL_OPENING_CASH,
  STORE_LOCAL_PRODUCTS,
  STORE_LOCAL_ROLES,
  STORE_LOCAL_SALES,
  STORE_LOCAL_SETTINGS,
  STORE_LOCAL_USERS,
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
  type LocalOpeningCash,
  type LocalProduct,
  type LocalSale,
  type LocalShopSettings,
  type LocalUser,
  type RoleDefinition,
} from './types';
import { latestOpeningCash, localDayKey } from './opening-cash';
import { fromMinor, priceLocalSale, toMinor, type PricedLineInput } from './price-local-sale';

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
    description: '',
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
    createdAtMillis: input.createdAtMillis ?? now,
    updatedAtMillis: now,
  };
}

export async function listLocalProducts(): Promise<LocalProduct[]> {
  if (!localStoreAvailable()) return [];
  const all = await posTx(STORE_LOCAL_PRODUCTS, 'readonly', (tx) =>
    idbGetAll<LocalProduct>(tx, STORE_LOCAL_PRODUCTS),
  );
  return all.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}

export async function getLocalProduct(id: string): Promise<LocalProduct | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_PRODUCTS, 'readonly', (tx) =>
    idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, id),
  );
  return row ?? null;
}

export async function saveLocalProduct(product: LocalProduct): Promise<void> {
  await posTx(STORE_LOCAL_PRODUCTS, 'readwrite', (tx) => idbPut(tx, STORE_LOCAL_PRODUCTS, product));
}

/** Bulk upsert, used by CSV import. One transaction, so a failed import lands nothing. */
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
      return { matchedBy: 'barcode' as const, products: activeBarcode.map(toProduct) };
    }

    const bySku = await idbGetAllByIndex<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, 'by-sku', trimmed);
    const activeSku = bySku.filter((p) => p.isActive);
    if (activeSku.length) {
      return { matchedBy: 'sku' as const, products: activeSku.map(toProduct) };
    }

    const byId = await idbGet<LocalProduct>(tx, STORE_LOCAL_PRODUCTS, trimmed);
    if (byId && byId.isActive) {
      return { matchedBy: 'id' as const, products: [toProduct(byId)] };
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
}

export async function commitLocalSale(
  input: LocalCommitInput,
  receiptPrefix: string,
): Promise<{ sale: LocalSale; duplicate: boolean }> {
  return posTx(
    [STORE_LOCAL_SALES, STORE_LOCAL_PRODUCTS, STORE_LOCAL_COUNTERS],
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

      const priced = priceLocalSale(input.lines, products);

      for (const [productId, stock] of priced.stockAfter) {
        const product = products.get(productId);
        if (!product) continue;
        await idbPut(tx, STORE_LOCAL_PRODUCTS, {
          ...product,
          stock,
          updatedAtMillis: input.committedAtMillis,
        });
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
      };
      await idbPut(tx, STORE_LOCAL_SALES, committed);
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

const ROLES_KEY = 'roles';

export async function readLocalRoles(): Promise<RoleDefinition[]> {
  if (!localStoreAvailable()) return BUILTIN_ROLES;
  return posTx(STORE_LOCAL_ROLES, 'readonly', async (tx) => {
    const stored = await idbGet<{ key: string; value: RoleDefinition[] }>(tx, STORE_LOCAL_ROLES, ROLES_KEY);
    return stored?.value ?? BUILTIN_ROLES;
  });
}

export async function writeLocalRoles(roles: RoleDefinition[]): Promise<RoleDefinition[]> {
  await posTx(STORE_LOCAL_ROLES, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_ROLES, { key: ROLES_KEY, value: roles }),
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

export async function writeLocalShopSettings(
  settings: Partial<LocalShopSettings>,
): Promise<LocalShopSettings> {
  const merged = { ...(await readLocalShopSettings()), ...settings };
  await posTx(STORE_LOCAL_SETTINGS, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_SETTINGS, { key: SETTINGS_KEY, value: merged }),
  );
  return merged;
}

/**
 * Erase a standalone till completely — catalogue, staff, sales, drawer counts,
 * counters, settings.
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
  ] as const;
  await posTx([...stores], 'readwrite', (tx) => {
    for (const s of stores) tx.objectStore(s).clear();
  });
}
