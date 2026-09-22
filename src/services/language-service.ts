import {
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  Timestamp,
  type Firestore,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { LanguageDoc } from '../types';
import { stripUndefined } from '../utils/strip-undefined';

function docToLanguage(snap: QueryDocumentSnapshot): LanguageDoc {
  const data = snap.data();
  return {
    id: snap.id,
    code: data.code,
    name: data.name,
    nativeName: data.nativeName,
    flag: data.flag,
    isDefault: data.isDefault ?? false,
    isActive: data.isActive ?? true,
    direction: data.direction ?? 'ltr',
    order: data.order ?? 0,
    updatedAt: data.updatedAt,
  };
}

export async function listLanguages(db: Firestore): Promise<LanguageDoc[]> {
  const q = query(caspianCollections(db).languages, orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToLanguage);
}

export type LanguageWriteInput = Omit<LanguageDoc, 'id' | 'updatedAt'>;

/**
 * Queues `isDefault: false` on every other language currently flagged as
 * default, so the write that promotes `keepId` leaves exactly one default.
 */
async function queueClearOtherDefaults(db: Firestore, batch: WriteBatch, keepId: string) {
  const others = await getDocs(
    query(caspianCollections(db).languages, where('isDefault', '==', true)),
  );
  for (const snap of others.docs) {
    if (snap.id !== keepId) batch.update(snap.ref, { isDefault: false });
  }
}

export async function createLanguage(
  db: Firestore,
  input: LanguageWriteInput,
  id?: string,
): Promise<string> {
  const ref = id ? doc(db, 'languages', id) : doc(caspianCollections(db).languages);
  const batch = writeBatch(db);
  batch.set(ref, stripUndefined({ ...input, updatedAt: Timestamp.now() }));
  if (input.isDefault) await queueClearOtherDefaults(db, batch, ref.id);
  await batch.commit();
  return ref.id;
}

export async function updateLanguage(
  db: Firestore,
  id: string,
  input: Partial<LanguageWriteInput>,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'languages', id), stripUndefined({ ...input, updatedAt: Timestamp.now() }));
  if (input.isDefault === true) await queueClearOtherDefaults(db, batch, id);
  await batch.commit();
}

export async function deleteLanguage(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'languages', id));
}
