import type { Functions } from 'firebase/functions';
import { httpsCallable } from 'firebase/functions';
import type { Product } from '../../types';
import type { CachedProduct } from './types';
import {
  STORE_CATALOG,
  STORE_META,
  idbGet,
  idbGetAll,
  idbGetAllByIndex,
  idbPut,
  posIdbAvailable,
  posTx,
} from './pos-queue-db';

const CURSOR_KEY = 'catalogCursor';
const MAX_PAGES_PER_SYNC = 20;

interface DeltaResponse {
  products: Array<Record<string, unknown>>;
  cursorMillis: number;
  hasMore: boolean;
}

/**
 * Flatten a catalogue document into something safe to keep on disk.
 *
 * `getPosCatalogDelta` returns raw Firestore documents, so every `Timestamp` has
 * already been reduced to `{_seconds,_nanoseconds}` by the callable wire format.
 * That object is not a `Timestamp` and throws the moment anything calls
 * `.toMillis()` on it, so storing raw documents would bake a crash into the
 * cache and only surface it during an outage — the one time nobody can fix it.
 */
function project(raw: Record<string, unknown>): CachedProduct | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  const name = typeof raw.name === 'string' ? raw.name : '';
  const updatedAt = raw.updatedAt as { _seconds?: number; seconds?: number } | undefined;
  const seconds = updatedAt?._seconds ?? updatedAt?.seconds ?? 0;

  const stockRaw = (raw.stock ?? {}) as Record<string, unknown>;
  const stock: Record<string, number> = {};
  for (const [k, v] of Object.entries(stockRaw)) if (typeof v === 'number') stock[k] = v;

  const images = raw.images as Array<{ url?: string }> | undefined;

  return {
    id,
    name,
    nameLower: name.toLowerCase(),
    price: typeof raw.price === 'number' ? raw.price : Number(raw.price) || 0,
    sku: typeof raw.sku === 'string' ? raw.sku : '',
    barcode: typeof raw.barcode === 'string' ? raw.barcode : '',
    sizes: Array.isArray(raw.sizes) ? (raw.sizes as string[]).filter((s) => typeof s === 'string') : [],
    stock,
    isActive: raw.isActive !== false,
    imageUrl: images?.[0]?.url ?? '',
    updatedAtMillis: seconds * 1000,
  };
}

/** The cached shape is a projection, so hand the register back something it knows. */
function toProduct(cached: CachedProduct): Product {
  return {
    id: cached.id,
    name: cached.name,
    price: cached.price,
    sku: cached.sku,
    barcode: cached.barcode,
    sizes: cached.sizes,
    stock: cached.stock,
    isActive: cached.isActive,
    images: cached.imageUrl ? [{ url: cached.imageUrl, alt: cached.name }] : [],
  } as unknown as Product;
}

export async function catalogCount(): Promise<number> {
  if (!posIdbAvailable()) return 0;
  const all = await posTx(STORE_CATALOG, 'readonly', (tx) => idbGetAll<CachedProduct>(tx, STORE_CATALOG));
  return all.length;
}

/**
 * Pull everything that changed since the last sync.
 *
 * Paged, because a store with thousands of SKUs cannot come down in one call,
 * and bounded per invocation so opening the register on a cold cache does not
 * block the first sale of the day behind a full catalogue download.
 */
export async function syncPosCatalog(functions: Functions): Promise<{ synced: number }> {
  if (!posIdbAvailable()) return { synced: 0 };

  const call = httpsCallable<{ sinceMillis: number }, DeltaResponse>(functions, 'getPosCatalogDelta');
  let cursor =
    (await posTx(STORE_META, 'readonly', (tx) =>
      idbGet<{ key: string; value: number }>(tx, STORE_META, CURSOR_KEY),
    ))?.value ?? 0;

  let synced = 0;
  for (let page = 0; page < MAX_PAGES_PER_SYNC; page++) {
    const { data } = await call({ sinceMillis: cursor });
    const rows = data.products.map(project).filter((p): p is CachedProduct => p !== null);
    if (rows.length) {
      await posTx([STORE_CATALOG, STORE_META], 'readwrite', async (tx) => {
        for (const row of rows) await idbPut(tx, STORE_CATALOG, row);
        await idbPut(tx, STORE_META, { key: CURSOR_KEY, value: data.cursorMillis });
      });
      synced += rows.length;
    }
    cursor = data.cursorMillis;
    if (!data.hasMore) break;
  }
  return { synced };
}

export interface CachedLookup {
  matchedBy: 'barcode' | 'sku' | 'id';
  products: Product[];
}

/**
 * Resolve a scanned code against the local cache.
 *
 * Same precedence as the online path — barcode, then SKU, then the document id
 * — so a cashier gets identical behaviour whether or not the network is up.
 */
export async function lookupCachedByCode(code: string): Promise<CachedLookup | null> {
  if (!posIdbAvailable()) return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  return posTx(STORE_CATALOG, 'readonly', async (tx) => {
    const byBarcode = await idbGetAllByIndex<CachedProduct>(tx, STORE_CATALOG, 'by-barcode', trimmed);
    const activeBarcode = byBarcode.filter((p) => p.isActive);
    if (activeBarcode.length) {
      return { matchedBy: 'barcode' as const, products: activeBarcode.map(toProduct) };
    }

    const bySku = await idbGetAllByIndex<CachedProduct>(tx, STORE_CATALOG, 'by-sku', trimmed);
    const activeSku = bySku.filter((p) => p.isActive);
    if (activeSku.length) {
      return { matchedBy: 'sku' as const, products: activeSku.map(toProduct) };
    }

    const byId = await idbGet<CachedProduct>(tx, STORE_CATALOG, trimmed);
    if (byId && byId.isActive) {
      return { matchedBy: 'id' as const, products: [toProduct(byId)] };
    }
    return null;
  });
}

export async function searchCachedProducts(term: string, limit = 40): Promise<Product[]> {
  if (!posIdbAvailable()) return [];
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  const all = await posTx(STORE_CATALOG, 'readonly', (tx) => idbGetAll<CachedProduct>(tx, STORE_CATALOG));
  return all
    .filter((p) => p.isActive && (p.nameLower.includes(needle) || p.sku.toLowerCase().includes(needle)))
    .slice(0, limit)
    .map(toProduct);
}
