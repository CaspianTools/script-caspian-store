import {
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { UserAddress, UserProfile } from '../types';
import { caspianCollections } from '../firebase/collections';

export async function listUsers(db: Firestore): Promise<UserProfile[]> {
  const q = query(caspianCollections(db).users, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }));
}

export async function getUserById(db: Firestore, uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(caspianCollections(db).users, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) };
}

export async function updateDisplayName(
  db: Firestore,
  uid: string,
  displayName: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    displayName,
    updatedAt: Timestamp.now(),
  });
}

export async function updatePhone(
  db: Firestore,
  uid: string,
  phone: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    phone,
    updatedAt: Timestamp.now(),
  });
}

export async function updateProfileFields(
  db: Firestore,
  uid: string,
  fields: { displayName?: string; phone?: string },
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (fields.displayName !== undefined) payload.displayName = fields.displayName;
  if (fields.phone !== undefined) payload.phone = fields.phone;
  await updateDoc(doc(db, 'users', uid), payload);
}

async function readAddresses(db: Firestore, uid: string): Promise<UserAddress[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return [];
  const data = snap.data() as UserProfile;
  return data.addresses ?? [];
}

async function writeAddresses(
  db: Firestore,
  uid: string,
  addresses: UserAddress[],
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { addresses, updatedAt: Timestamp.now() });
}

function newAddressId() {
  return `addr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function addAddress(
  db: Firestore,
  uid: string,
  address: Omit<UserAddress, 'id'>,
): Promise<UserAddress> {
  const existing = await readAddresses(db, uid);
  let nextList = existing;
  if (address.isDefault) {
    nextList = existing.map((a) => ({ ...a, isDefault: false }));
  }
  const created: UserAddress = { ...address, id: newAddressId() };
  // If this is the first address, force it default for a better UX.
  if (existing.length === 0) created.isDefault = true;
  nextList = [...nextList, created];
  await writeAddresses(db, uid, nextList);
  return created;
}

export async function updateAddress(
  db: Firestore,
  uid: string,
  address: UserAddress,
): Promise<void> {
  const existing = await readAddresses(db, uid);
  const next = existing.map((a) => {
    if (a.id === address.id) return address;
    if (address.isDefault) return { ...a, isDefault: false };
    return a;
  });
  await writeAddresses(db, uid, next);
}

export async function deleteAddress(db: Firestore, uid: string, addressId: string): Promise<void> {
  const existing = await readAddresses(db, uid);
  const filtered = existing.filter((a) => a.id !== addressId);
  // If we removed the default, promote the first remaining address.
  if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
    filtered[0] = { ...filtered[0], isDefault: true };
  }
  await writeAddresses(db, uid, filtered);
}

export async function setDefaultAddress(
  db: Firestore,
  uid: string,
  addressId: string,
): Promise<void> {
  const existing = await readAddresses(db, uid);
  const next = existing.map((a) => ({ ...a, isDefault: a.id === addressId }));
  await writeAddresses(db, uid, next);
}
