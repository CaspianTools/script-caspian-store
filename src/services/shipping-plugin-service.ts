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
import type { ShippingPluginInstall } from '../types';
import type { ShippingPluginId } from '../shipping/types';
import { stripUndefined } from '../utils/strip-undefined';

function docToInstall(snap: QueryDocumentSnapshot): ShippingPluginInstall {
  const data = snap.data();
  return {
    id: snap.id,
    pluginId: data.pluginId as ShippingPluginId,
    name: data.name ?? '',
    enabled: data.enabled ?? true,
    order: data.order ?? 0,
    estimatedDays: data.estimatedDays ?? { min: 0, max: 0 },
    config: (data.config ?? {}) as Record<string, unknown>,
    eligibleCountries: Array.isArray(data.eligibleCountries)
      ? (data.eligibleCountries as string[])
      : undefined,
    createdAt: data.createdAt,
  };
}

export async function listShippingPluginInstalls(
  db: Firestore,
  opts: { onlyEnabled?: boolean } = {},
): Promise<ShippingPluginInstall[]> {
  const constraints = opts.onlyEnabled
    ? [where('enabled', '==', true), orderBy('order', 'asc')]
    : [orderBy('order', 'asc')];
  const snap = await getDocs(query(caspianCollections(db).shippingPluginInstalls, ...constraints));
  return snap.docs.map(docToInstall);
}

export type ShippingPluginInstallWriteInput = Omit<ShippingPluginInstall, 'id' | 'createdAt'>;

/**
 * Update payload. `eligibleCountries` additionally accepts `deleteField()` so a
 * cleared optional value is actually removed — `undefined` is stripped
 * before the write and would leave the stored value untouched.
 */
export type ShippingPluginInstallUpdateInput = Partial<Omit<ShippingPluginInstallWriteInput, 'eligibleCountries'>> & {
  eligibleCountries?: ShippingPluginInstallWriteInput['eligibleCountries'] | FieldValue;
};

export async function createShippingPluginInstall(
  db: Firestore,
  input: ShippingPluginInstallWriteInput,
  id?: string,
): Promise<string> {
  const payload = stripUndefined({ ...input, createdAt: Timestamp.now() });
  if (id) {
    await setDoc(doc(db, 'shippingPluginInstalls', id), payload);
    return id;
  }
  const ref = await addDoc(caspianCollections(db).shippingPluginInstalls, payload);
  return ref.id;
}

export async function updateShippingPluginInstall(
  db: Firestore,
  id: string,
  input: ShippingPluginInstallUpdateInput,
): Promise<void> {
  await updateDoc(doc(db, 'shippingPluginInstalls', id), stripUndefined({ ...input }));
}

export async function deleteShippingPluginInstall(
  db: Firestore,
  id: string,
): Promise<void> {
  await deleteDoc(doc(db, 'shippingPluginInstalls', id));
}
