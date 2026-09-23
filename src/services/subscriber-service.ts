import {
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { Subscriber } from '../types';
import { toCsv } from '../utils/csv';

export type SubscribeResult = 'subscribed' | 'already-subscribed';

/** Doc id derived from the address so one email can only ever hold one doc. */
function subscriberDocId(normalizedEmail: string): string {
  return encodeURIComponent(normalizedEmail);
}

/**
 * Newsletter signup. Idempotent: if the email is already in the `subscribers`
 * collection it returns `'already-subscribed'` instead of adding a duplicate.
 *
 * The rules grant visitors `create` only — no read — so the duplicate check
 * cannot be a query (v15.0 and earlier did exactly that, and every signup
 * from the footer, the homepage and the checkout opt-in was denied unless an
 * admin happened to be signed in). Instead the email *is* the doc id: a
 * second write to the same id is an update, which the rules deny, and that
 * denial is the "already subscribed" signal.
 */
export async function subscribeEmail(db: Firestore, email: string): Promise<SubscribeResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Email is required.');

  const ref = doc(caspianCollections(db).subscribers, subscriberDocId(normalized));
  try {
    await setDoc(ref, {
      email: normalized,
      subscribedAt: Timestamp.now(),
    });
    return 'subscribed';
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') return 'already-subscribed';
    throw error;
  }
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
