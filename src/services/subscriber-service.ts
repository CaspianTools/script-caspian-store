import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { Subscriber } from '../types';
import { toCsv } from '../utils/csv';

export type SubscribeResult = 'subscribed' | 'already-subscribed';

/**
 * Newsletter signup. Idempotent: if the email is already in the `subscribers`
 * collection it returns `'already-subscribed'` instead of adding a duplicate.
 */
export async function subscribeEmail(db: Firestore, email: string): Promise<SubscribeResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Email is required.');

  const refs = caspianCollections(db);
  const existing = await getDocs(
    query(refs.subscribers, where('email', '==', normalized), limit(1)),
  );
  if (!existing.empty) return 'already-subscribed';

  await addDoc(refs.subscribers, {
    email: normalized,
    subscribedAt: Timestamp.now(),
  });
  return 'subscribed';
}

function docToSubscriber(snap: QueryDocumentSnapshot): Subscriber {
  const data = snap.data();
  return {
    id: snap.id,
    email: data.email,
    subscribedAt: data.subscribedAt,
  };
}

export async function listSubscribers(db: Firestore): Promise<Subscriber[]> {
  const q = query(caspianCollections(db).subscribers, orderBy('subscribedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToSubscriber);
}

export async function deleteSubscriber(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'subscribers', id));
}

/** Build a CSV string from subscribers. Does not trigger download — consumer does that. */
export function subscribersToCsv(subscribers: Subscriber[]): string {
  return toCsv([
    ['email', 'subscribedAt'],
    ...subscribers.map((s) => [
      s.email,
      s.subscribedAt?.toDate ? s.subscribedAt.toDate().toISOString() : '',
    ]),
  ]);
}
