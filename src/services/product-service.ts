import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  type Firestore,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { InventorySettings, Product } from '../types';
import { isProductOutOfStock } from '../utils/inventory';
import { slugify } from '../utils/slugify';
import { stripUndefined } from '../utils/strip-undefined';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  isNew?: boolean;
  limited?: boolean;
  /**
   * When set, products that are entirely out of stock (every size at or below
   * `outOfStockThreshold`) are filtered out client-side before being returned.
   * Wire from `SiteSettings.inventory` upstream when its `outOfStockVisibility`
   * is `'hide'`. Added in v2.9.
   */
  hideOutOfStock?: Pick<InventorySettings, 'outOfStockThreshold'>;
}

function docToProduct(docSnap: QueryDocumentSnapshot | DocumentSnapshot): Product {
  const data = docSnap.data()!;
  return {
    id: docSnap.id,
    slug: data.slug,
    name: data.name,
    brand: data.brand,
    sku: data.sku,
    description: data.description,
    shortDescription: data.shortDescription,
    details: data.details,
    price: data.price,
    images: data.images || [],
    category: data.category,
    isNew: data.isNew ?? false,
    limited: data.limited ?? false,
    sizes: data.sizes || [],
    color: data.color || '',
    colorVariants: data.colorVariants,
    stock: data.stock || {},
    taxonomies: data.taxonomies || {},
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getProducts(
  db: Firestore,
  filters?: ProductFilters,
  max = 500,
): Promise<Product[]> {
  const products = caspianCollections(db).products;
  const constraints: Parameters<typeof query>[1][] = [where('isActive', '==', true)];
  if (filters?.category) constraints.push(where('category', '==', filters.category));
  if (filters?.isNew) constraints.push(where('isNew', '==', true));
  if (filters?.limited) constraints.push(where('limited', '==', true));

  const q = query(products, ...constraints, orderBy('createdAt', 'desc'), firestoreLimit(max));
  const snapshot = await getDocs(q);
  let list = snapshot.docs.map(docToProduct);
  if (filters?.minPrice !== undefined) list = list.filter((p) => p.price >= filters.minPrice!);
  if (filters?.maxPrice !== undefined) list = list.filter((p) => p.price <= filters.maxPrice!);
  if (filters?.sizes?.length) {
    list = list.filter((p) => p.sizes?.some((s) => filters.sizes!.includes(s)));
  }
  if (filters?.hideOutOfStock) {
    list = list.filter((p) => !isProductOutOfStock(p, filters.hideOutOfStock!));
  }
  return list;
}

export async function getProductById(db: Firestore, id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, 'products', id));
  if (!snap.exists()) return null;
  return docToProduct(snap);
}

/**
 * Look up a product by its `slug` field. Used by the storefront product detail
 * route. Single-equality query — Firestore auto-creates the underlying single
 * field index, so consumers don't need to redeploy `firestore.indexes.json` to
 * upgrade. Inactive products are filtered client-side so we don't need a
 * composite `slug + isActive` index either.
 */
export async function getProductBySlug(
  db: Firestore,
  slug: string,
): Promise<Product | null> {
  if (!slug) return null;
  const q = query(
    caspianCollections(db).products,
    where('slug', '==', slug),
    firestoreLimit(1),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  const product = docToProduct(first);
  if (product.isActive === false) return null;
  return product;
}

/**
 * Resolve a `/product/:param` URL segment that may be either a slug
 * (`black-leather-jacket`) or a Firestore document id (`abc123XYZ`). Tries the
 * slug lookup first; on miss, falls back to direct document lookup. Lets us
 * keep legacy ID-based URLs working while new links use slugs.
 */
export async function getProductBySlugOrId(
  db: Firestore,
  slugOrId: string,
): Promise<Product | null> {
  const bySlug = await getProductBySlug(db, slugOrId);
  if (bySlug) return bySlug;
  return getProductById(db, slugOrId);
}

/**
 * Find an unused slug starting from `base`. If `base` is taken, tries
 * `base-2`, `base-3`, … until one is free. `excludeId` lets the caller skip
 * self-collision when re-saving an existing product. Bounded to 50 attempts;
 * if you have 50 products literally named the same thing, set the slug
 * manually in the admin editor.
 */
async function ensureUniqueSlug(
  db: Firestore,
  base: string,
  excludeId?: string,
): Promise<string> {
  const products = caspianCollections(db).products;
  const isFree = async (candidate: string): Promise<boolean> => {
    const q = query(products, where('slug', '==', candidate), firestoreLimit(2));
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (excludeId && snap.docs.every((d) => d.id === excludeId)) return true;
    return false;
  };
  if (await isFree(base)) return base;
  for (let i = 2; i < 50; i += 1) {
    const candidate = `${base}-${i}`;
    if (await isFree(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function getProductsByIds(db: Firestore, ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const out: Product[] = [];
  for (const chunk of chunks) {
    const q = query(
      caspianCollections(db).products,
      where('__name__', 'in', chunk),
      where('isActive', '==', true),
    );
    const snap = await getDocs(q);
    out.push(...snap.docs.map(docToProduct));
  }
  return out;
}

/** List every product (admin-only). */
export async function listAllProducts(db: Firestore): Promise<Product[]> {
  const q = query(caspianCollections(db).products, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToProduct);
}

export type ProductWriteInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

export async function createProduct(
  db: Firestore,
  data: ProductWriteInput,
  /** Optional document ID; if omitted, Firestore assigns one. */
  id?: string,
): Promise<string> {
  const now = Timestamp.now();
  const slug = await resolveSlugForWrite(db, data.slug, data.name);
  const payload = stripUndefined({ ...data, slug, createdAt: now, updatedAt: now });
  if (id) {
    await setDoc(doc(db, 'products', id), payload);
    return id;
  }
  const ref = await addDoc(caspianCollections(db).products, payload);
  return ref.id;
}

export async function updateProduct(
  db: Firestore,
  id: string,
  data: Partial<ProductWriteInput>,
): Promise<void> {
  // On update, regenerate the slug only when:
  //   1. the admin explicitly typed one (`data.slug` provided), OR
  //   2. the existing doc has none (legacy backfill path).
  // Renaming a product without changing the slug field deliberately keeps the
  // existing slug — preserves SEO and any external links pointing at it.
  let slug: string | undefined;
  if (data.slug !== undefined) {
    slug = await resolveSlugForWrite(db, data.slug, data.name ?? '', id);
  } else {
    const existing = await getDoc(doc(db, 'products', id));
    const existingSlug = existing.exists() ? existing.data()?.slug : undefined;
    if (!existingSlug) {
      const sourceName = data.name ?? (existing.exists() ? existing.data()?.name : '') ?? '';
      slug = await resolveSlugForWrite(db, undefined, sourceName, id);
    }
  }
  await updateDoc(
    doc(db, 'products', id),
    stripUndefined({ ...data, slug, updatedAt: Timestamp.now() }),
  );
}

async function resolveSlugForWrite(
  db: Firestore,
  rawSlug: string | undefined,
  name: string,
  excludeId?: string,
): Promise<string | undefined> {
  const candidate = (rawSlug ?? '').trim();
  const base = candidate ? slugify(candidate) : slugify(name);
  if (!base) return undefined;
  return ensureUniqueSlug(db, base, excludeId);
}

export async function deleteProduct(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}

export async function getRelatedProducts(
  db: Firestore,
  category: string,
  excludeId?: string,
  limit = 4,
): Promise<Product[]> {
  const q = query(
    caspianCollections(db).products,
    where('isActive', '==', true),
    where('category', '==', category),
    firestoreLimit(limit + 1),
  );
  const snap = await getDocs(q);
  let list = snap.docs.map(docToProduct);
  if (excludeId) list = list.filter((p) => p.id !== excludeId);
  return list.slice(0, limit);
}
