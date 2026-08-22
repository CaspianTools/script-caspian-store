import { doc, getDoc, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { Product } from '../types';

/** Which field a scanned code matched, so the register can tell the cashier. */
export type PosCodeMatch = 'barcode' | 'sku' | 'id';

export interface PosLookupResult {
  matchedBy: PosCodeMatch;
  /**
   * Every product carrying this code. Normally one. Barcodes are not enforced
   * unique — the same EAN legitimately appears on a single unit and a
   * multipack in some catalogs — so the register asks rather than guessing
   * which one the cashier meant.
   */
  products: Product[];
}

const MAX_MATCHES = 10;

function toProduct(id: string, data: Record<string, unknown>): Product {
  return { id, ...(data as Omit<Product, 'id'>) };
}

/**
 * Resolve a scanned or keyed code to product(s).
 *
 * Tried in order of how a code is most likely to arrive at a till:
 *   1. `barcode` — what the scanner actually reads off the label
 *   2. `sku` — what a cashier keys when the label will not scan
 *   3. document id — so an admin can paste a product id straight in
 *
 * Both queries are bare equality, which Firestore serves from its automatic
 * single-field indexes; no composite index is needed and none is declared.
 *
 * Returns `null` when nothing matches, rather than throwing — an unknown
 * barcode is an ordinary event at a counter (a new line not yet in the
 * catalog, a customer's loyalty card, a competitor's label), not an error.
 */
export async function findProductByCode(
  db: Firestore,
  code: string,
): Promise<PosLookupResult | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { products } = caspianCollections(db);

  const byBarcode = await getDocs(
    query(products, where('barcode', '==', trimmed), limit(MAX_MATCHES)),
  );
  if (!byBarcode.empty) {
    return {
      matchedBy: 'barcode',
      products: byBarcode.docs.map((d) => toProduct(d.id, d.data())),
    };
  }

  const bySku = await getDocs(query(products, where('sku', '==', trimmed), limit(MAX_MATCHES)));
  if (!bySku.empty) {
    return { matchedBy: 'sku', products: bySku.docs.map((d) => toProduct(d.id, d.data())) };
  }

  const byId = await getDoc(doc(db, 'products', trimmed));
  if (byId.exists()) {
    return { matchedBy: 'id', products: [toProduct(byId.id, byId.data())] };
  }

  return null;
}

/**
 * Free-text product search for the register's browse pane, for the times
 * there is no barcode to scan at all — loose produce, a service, a display
 * item whose label is long gone.
 *
 * Deliberately a client-side filter over a bounded page rather than a
 * Firestore query: Firestore has no substring matching, and the storefront's
 * search index is not wired into the POS. Fine for the few hundred products a
 * counter realistically browses; a store past that scans instead.
 */
export async function searchPosProducts(
  db: Firestore,
  term: string,
  max = 40,
): Promise<Product[]> {
  const needle = term.trim().toLowerCase();
  const { products } = caspianCollections(db);
  const snap = await getDocs(query(products, where('isActive', '==', true), limit(500)));
  const all = snap.docs.map((d) => toProduct(d.id, d.data()));
  if (!needle) return all.slice(0, max);
  return all
    .filter((p) => {
      const haystack = `${p.name ?? ''} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    })
    .slice(0, max);
}
