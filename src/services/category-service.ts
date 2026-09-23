import {
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { ProductCategoryDoc } from '../types';
import { stripUndefined } from '../utils/strip-undefined';

function docToCategory(docSnap: QueryDocumentSnapshot): ProductCategoryDoc {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    order: data.order ?? 0,
    isActive: data.isActive ?? true,
    isFeatured: data.isFeatured ?? false,
    imageUrl: data.imageUrl,
    parentId: data.parentId ?? null,
    path: data.path,
    depth: data.depth,
    createdAt: data.createdAt,
  };
}

/**
 * Active categories ordered by their configured `order`. Sorted client-side
 * for the same reason as `listActiveBrands`: `where(isActive)` + `orderBy`
 * needs a composite index that a fresh project does not have, and the query
 * then throws `failed-precondition` — which every caller swallowed, so the
 * storefront simply showed no categories.
 */
export async function listActiveCategories(db: Firestore): Promise<ProductCategoryDoc[]> {
  const q = query(caspianCollections(db).productCategories, where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs
    .map(docToCategory)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

/** Featured + active categories, ordered — used on the homepage. */
export async function getFeaturedCategories(db: Firestore): Promise<ProductCategoryDoc[]> {
  const list = await listActiveCategories(db);
  return list.filter((cat) => cat.isFeatured === true);
}

/** All categories, ordered — used by the admin page. */
export async function listAllCategories(db: Firestore): Promise<ProductCategoryDoc[]> {
  const q = query(caspianCollections(db).productCategories, orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToCategory);
}

export type CategoryWriteInput = Omit<ProductCategoryDoc, 'id' | 'createdAt'>;

export async function createCategory(
  db: Firestore,
  input: CategoryWriteInput,
  id?: string,
): Promise<string> {
  const payload = stripUndefined({ ...input, createdAt: Timestamp.now() });
  if (id) {
    await setDoc(doc(db, 'productCategories', id), payload);
    return id;
  }
  const ref = await addDoc(caspianCollections(db).productCategories, payload);
  return ref.id;
}

export async function updateCategory(
  db: Firestore,
  id: string,
  input: Partial<CategoryWriteInput>,
): Promise<void> {
  await updateDoc(doc(db, 'productCategories', id), stripUndefined({ ...input }));
}

/**
 * Deletes a category and promotes its direct children to top level. Without
 * this the children keep a dangling `parentId`, which the product editor's
 * tree walk never reaches, so they silently vanished from the dropdown.
 */
export async function deleteCategory(db: Firestore, id: string): Promise<void> {
  const children = await getDocs(
    query(caspianCollections(db).productCategories, where('parentId', '==', id)),
  );
  const batch = writeBatch(db);
  for (const child of children.docs) batch.update(child.ref, { parentId: null });
  batch.delete(doc(db, 'productCategories', id));
  await batch.commit();
}
