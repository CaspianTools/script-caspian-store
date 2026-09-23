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
  type FieldValue,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { PaymentPluginInstall } from '../types';
import { stripUndefined } from '../utils/strip-undefined';

function docToInstall(snap: QueryDocumentSnapshot): PaymentPluginInstall {
  const data = snap.data();
  return {
    id: snap.id,
    pluginId: data.pluginId ?? '',
    name: data.name ?? '',
    description: typeof data.description === 'string' ? data.description : undefined,
    enabled: data.enabled ?? false,
    order: data.order ?? 0,
    config: (data.config ?? {}) as Record<string, unknown>,
    createdAt: data.createdAt,
  };
}

export async function listPaymentPluginInstalls(
  db: Firestore,
  opts: { onlyEnabled?: boolean } = {},
): Promise<PaymentPluginInstall[]> {
  const constraints = opts.onlyEnabled
    ? [where('enabled', '==', true), orderBy('order', 'asc')]
    : [orderBy('order', 'asc')];
  const snap = await getDocs(query(caspianCollections(db).paymentPluginInstalls, ...constraints));
  return snap.docs.map(docToInstall);
}

export type PaymentPluginInstallWriteInput = Omit<PaymentPluginInstall, 'id' | 'createdAt'>;

/**
 * Update payload. `description` additionally accepts `deleteField()` so a
 * cleared optional value is actually removed — `undefined` is stripped
 * before the write and would leave the stored value untouched.
 */
export type PaymentPluginInstallUpdateInput = Partial<Omit<PaymentPluginInstallWriteInput, 'description'>> & {
  description?: PaymentPluginInstallWriteInput['description'] | FieldValue;
};

export async function createPaymentPluginInstall(
  db: Firestore,
  input: PaymentPluginInstallWriteInput,
  id?: string,
): Promise<string> {
  const payload = stripUndefined({ ...input, createdAt: Timestamp.now() });
  if (id) {
    await setDoc(doc(db, 'paymentPluginInstalls', id), payload);
    return id;
  }
  const ref = await addDoc(caspianCollections(db).paymentPluginInstalls, payload);
  return ref.id;
}

export async function updatePaymentPluginInstall(
  db: Firestore,
  id: string,
  input: PaymentPluginInstallUpdateInput,
): Promise<void> {
  await updateDoc(doc(db, 'paymentPluginInstalls', id), stripUndefined({ ...input }));
}

export async function deletePaymentPluginInstall(
  db: Firestore,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, 'paymentPluginInstalls', id));
}
