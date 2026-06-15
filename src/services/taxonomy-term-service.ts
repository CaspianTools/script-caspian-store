import {
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { TaxonomyTermDoc } from '../types';
import { slugify } from '../utils/slugify';
import { stripUndefined } from '../utils/strip-undefined';

/**
 * CRUD for generic product-taxonomy terms (materials, seasons, colors, …),
 * all stored in one `taxonomyTerms` collection keyed by a `type` field.
 *
 * Queries filter by `where('type','==',X)` only and sort client-side — the same
 * strategy as brand-service: a `where + orderBy` (or `where + where`) query
 * would need a composite index that a fresh fork won't have, throwing
 * `failed-precondition`. Equality-only uses the auto single-field index, so this
 * works everywhere with no index deploy. Term lists are small, so in-memory
 * sort/filter is free.
 */

function docToTerm(snap: QueryDocumentSnapshot): TaxonomyTermDoc {
  const data = snap.data();
  return {
    id: snap.id,
    type: data.type,
    name: data.name,
    slug: data.slug,
    isActive: data.isActive ?? true,
    order: data.order,
    createdAt: data.createdAt,
  };
}

function sortTerms(terms: TaxonomyTermDoc[]): TaxonomyTermDoc[] {
  return terms.sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

/** All terms of a taxonomy type, ordered by `order` then name. Admin term page. */
export async function listTerms(db: Firestore, type: string): Promise<TaxonomyTermDoc[]> {
  const q = query(caspianCollections(db).taxonomyTerms, where('type', '==', type));
  const snap = await getDocs(q);
  return sortTerms(snap.docs.map(docToTerm));
}

/** Active terms of a type — storefront filter/display. Filters in memory. */
export async function listActiveTerms(db: Firestore, type: string): Promise<TaxonomyTermDoc[]> {
  const all = await listTerms(db, type);
  return all.filter((t) => t.isActive);
}

export type TaxonomyTermWriteInput = Pick<TaxonomyTermDoc, 'name' | 'isActive'> &
  Partial<Pick<TaxonomyTermDoc, 'slug' | 'order'>>;

/** Deterministic per-type doc id so the same name can exist under two taxonomies. */
export function taxonomyTermId(type: string, slug: string): string {
  return `${type}__${slug}`;
}

/**
 * Create a term under `type`. The doc id is `${type}__${slug}` (slug derived
 * from the name when not given), so imports are idempotent and two taxonomies
 * can both have a term named e.g. "Black".
 */
export async function createTerm(
  db: Firestore,
  type: string,
  input: TaxonomyTermWriteInput,
  id?: string,
): Promise<string> {
  const slug = input.slug?.trim() || slugify(input.name);
  const docId = id ?? taxonomyTermId(type, slug);
  const payload = stripUndefined({
    type,
    name: input.name,
    slug,
    isActive: input.isActive,
    order: input.order,
    createdAt: Timestamp.now(),
  });
  await setDoc(doc(db, 'taxonomyTerms', docId), payload);
  return docId;
}

/** True when a term doc already exists at `${type}__${slug}` — used to reject duplicates. */
export async function termExists(db: Firestore, type: string, slug: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'taxonomyTerms', taxonomyTermId(type, slug)));
  return snap.exists();
}

export async function updateTerm(
  db: Firestore,
  id: string,
  input: Partial<TaxonomyTermWriteInput>,
): Promise<void> {
  // `type` is intentionally never written — it's immutable (part of the id).
  await updateDoc(doc(db, 'taxonomyTerms', id), stripUndefined({ ...input }));
}

export async function deleteTerm(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'taxonomyTerms', id));
}

/**
 * Count terms of a type without fetching them — drives the Settings disable
 * guard ("can't disable a taxonomy that has terms"). Equality-only query uses
 * the auto single-field index, so the server-side count works with no index
 * deploy. Mirrors the `getCountFromServer` pattern in contact-service.
 */
export async function countTerms(db: Firestore, type: string): Promise<number> {
  const q = query(caspianCollections(db).taxonomyTerms, where('type', '==', type));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
