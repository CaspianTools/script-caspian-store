import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { Product, ProductBrandDoc } from '../types';
import { slugify } from '../utils/slugify';
import { stripUndefined } from '../utils/strip-undefined';

function docToBrand(snap: QueryDocumentSnapshot): ProductBrandDoc {
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
  };
}

/**
 * Active brands ordered by name — used by the editor select and storefront
 * display lookup. Sorted client-side on purpose: a `where(isActive==true)` +
 * `orderBy('name')` query needs a `productBrands` composite index, which a
 * fresh project won't have until it's created — the query then throws
 * `failed-precondition` and blanks the product editor. Equality-only uses the
 * auto-created single-field index, so this works everywhere with no index
 * deploy. Brand lists are small, so the in-memory sort is free.
 */
export async function listActiveBrands(db: Firestore): Promise<ProductBrandDoc[]> {
  const q = query(caspianCollections(db).productBrands, where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(docToBrand).sort((a, b) => a.name.localeCompare(b.name));
}

/** All brands ordered by name — used by the admin Brands page. */
export async function listAllBrands(db: Firestore): Promise<ProductBrandDoc[]> {
  const q = query(caspianCollections(db).productBrands, orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToBrand);
}

export type BrandWriteInput = Omit<ProductBrandDoc, 'id' | 'createdAt'>;

/**
 * Create a brand. Defaults the document id to `slugify(name)` so the value
 * stored on `Product.brand` is a stable, human-readable id (e.g. `"acme"`),
 * matching how `Product.category` already references `productCategories`.
 */
export async function createBrand(
  db: Firestore,
  input: BrandWriteInput,
  id?: string,
): Promise<string> {
  const payload = stripUndefined({ ...input, createdAt: Timestamp.now() });
  const explicitId = id ?? slugify(input.name);
  if (explicitId) {
    await setDoc(doc(db, 'productBrands', explicitId), payload);
    return explicitId;
  }
  const ref = await addDoc(caspianCollections(db).productBrands, payload);
  return ref.id;
}

export async function updateBrand(
  db: Firestore,
  id: string,
  input: Partial<BrandWriteInput>,
): Promise<void> {
  await updateDoc(doc(db, 'productBrands', id), stripUndefined({ ...input }));
}

export async function deleteBrand(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'productBrands', id));
}

/**
 * Resolve a stored `Product.brand` value to a display name. Returns the
 * brand-doc's `name` when the value is a known brand id, otherwise returns
 * the raw stored string — so legacy products that store a free-text brand
 * name from before brands existed as a collection still render correctly,
 * even before an admin runs the migration helper.
 */
export function resolveBrandName(
  value: string | undefined,
  brandsById: Map<string, ProductBrandDoc>,
): string {
  if (!value) return '';
  return brandsById.get(value)?.name ?? value;
}

/**
 * Pre-v8.4 products stored a free-text brand name on `Product.brand` (e.g.
 * `"Nike"`). Starting in v8.4, that field stores a brand-doc id instead.
 * Display sites tolerate the legacy form via {@link resolveBrandName}'s
 * raw-string fallback, but the admin Brands page calls this helper to do
 * the one-shot self-healing sweep:
 *
 *   1. For every distinct legacy brand string on the products collection,
 *      create a `productBrands` doc (deterministic id = slugified name)
 *      unless a matching brand already exists by id or by case-insensitive
 *      name. "Nike" and "nike" coalesce into the same brand.
 *   2. Update each affected product's `brand` field to that brand-doc id.
 *
 * Idempotent — safe to run repeatedly. After every product already
 * references a real brand id, this returns `{ brandsCreated: 0, productsUpdated: 0 }`.
 */
export async function migrateLegacyBrandStrings(
  db: Firestore,
): Promise<{ brandsCreated: number; productsUpdated: number }> {
  const [productsSnap, brandsSnap] = await Promise.all([
    getDocs(caspianCollections(db).products),
    getDocs(caspianCollections(db).productBrands),
  ]);
  const brandIdSet = new Set(brandsSnap.docs.map((d) => d.id));
  const brandIdByLowerName = new Map<string, string>();
  for (const d of brandsSnap.docs) {
    const name = (d.data() as { name?: string }).name;
    if (typeof name === 'string' && name.length > 0) {
      brandIdByLowerName.set(name.toLowerCase(), d.id);
    }
  }

  const legacy = new Map<string, { displayName: string; productIds: string[] }>();
  for (const p of productsSnap.docs) {
    const raw = ((p.data() as Product).brand ?? '').trim();
    if (!raw || brandIdSet.has(raw)) continue;
    const lower = raw.toLowerCase();
    const entry = legacy.get(lower) ?? { displayName: raw, productIds: [] };
    entry.productIds.push(p.id);
    legacy.set(lower, entry);
  }

  let brandsCreated = 0;
  let productsUpdated = 0;
  for (const [lower, { displayName, productIds }] of legacy) {
    let brandId = brandIdByLowerName.get(lower);
    if (!brandId) {
      brandId = slugify(displayName) || `brand-${lower}`;
      await setDoc(doc(db, 'productBrands', brandId), {
        name: displayName,
        isActive: true,
        createdAt: Timestamp.now(),
      });
      brandIdSet.add(brandId);
      brandIdByLowerName.set(lower, brandId);
      brandsCreated++;
    }
    for (const pid of productIds) {
      await updateDoc(doc(db, 'products', pid), { brand: brandId });
      productsUpdated++;
    }
  }
  return { brandsCreated, productsUpdated };
}

/**
 * Quick scan to decide whether to surface the migration banner on the admin
 * Brands page. Reads at most {@link sampleSize} products and returns the
 * count whose `brand` value isn't a known brand-doc id. The full sweep runs
 * via {@link migrateLegacyBrandStrings} when the admin clicks the button.
 */
export async function countLegacyBrandStrings(
  db: Firestore,
  sampleSize = 200,
): Promise<number> {
  const [productsSnap, brandsSnap] = await Promise.all([
    getDocs(caspianCollections(db).products),
    getDocs(caspianCollections(db).productBrands),
  ]);
  const brandIdSet = new Set(brandsSnap.docs.map((d) => d.id));
  let n = 0;
  let scanned = 0;
  for (const p of productsSnap.docs) {
    if (scanned >= sampleSize) break;
    scanned++;
    const raw = ((p.data() as Product).brand ?? '').trim();
    if (raw && !brandIdSet.has(raw)) n++;
  }
  return n;
}
