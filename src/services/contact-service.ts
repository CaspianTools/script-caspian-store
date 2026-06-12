import {
  addDoc,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { ContactStatus, ContactSubmission } from '../types';

function docToContact(snap: QueryDocumentSnapshot): ContactSubmission {
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    email: data.email,
    subject: data.subject || undefined,
    message: data.message,
    status: data.status ?? 'new',
    createdAt: data.createdAt,
    readAt: data.readAt ?? undefined,
    userId: data.userId ?? undefined,
  };
}

export interface CreateContactInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
  /** Optional — set when the submitter happens to be signed in. */
  userId?: string;
}

/**
 * Public contact-form submit. Open to unauthenticated visitors (same as
 * newsletter signup). Firestore rules clamp field shape + length.
 */
export async function createContact(
  db: Firestore,
  input: CreateContactInput,
): Promise<string> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const subject = input.subject?.trim() ?? '';
  const message = input.message.trim();
  if (!name) throw new Error('Name is required.');
  if (!email) throw new Error('Email is required.');
  if (!message) throw new Error('Message is required.');
  const payload: Record<string, unknown> = {
    name,
    email,
    message,
    status: 'new' as ContactStatus,
    createdAt: Timestamp.now(),
  };
  if (subject) payload.subject = subject;
  if (input.userId) payload.userId = input.userId;
  const ref = await addDoc(caspianCollections(db).contacts, payload);
  return ref.id;
}

export async function listAllContacts(
  db: Firestore,
  opts?: { status?: ContactStatus },
): Promise<ContactSubmission[]> {
  const constraints = opts?.status
    ? [where('status', '==', opts.status), orderBy('createdAt', 'desc')]
    : [orderBy('createdAt', 'desc')];
  const q = query(caspianCollections(db).contacts, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(docToContact);
}

/**
 * Messages tied to one account, for the admin user-detail view. Matched both
 * by the stored `userId` and — as a fallback — by the profile email, so
 * submissions sent while signed out (which carry no `userId`) still surface.
 * Both are single-equality reads (no composite index), merged by id and
 * sorted newest-first client-side.
 */
export async function getContactsByUser(
  db: Firestore,
  opts: { userId?: string; email?: string },
): Promise<ContactSubmission[]> {
  const email = opts.email?.trim().toLowerCase();
  const col = caspianCollections(db).contacts;
  const reads = [
    ...(opts.userId ? [getDocs(query(col, where('userId', '==', opts.userId)))] : []),
    ...(email ? [getDocs(query(col, where('email', '==', email)))] : []),
  ];
  const snaps = await Promise.all(reads);
  const byId = new Map<string, ContactSubmission>();
  for (const snap of snaps) {
    for (const d of snap.docs) byId.set(d.id, docToContact(d));
  }
  return Array.from(byId.values()).sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
  );
}

export async function listRecentContacts(
  db: Firestore,
  n = 5,
): Promise<ContactSubmission[]> {
  const q = query(caspianCollections(db).contacts, orderBy('createdAt', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(docToContact);
}

export async function countNewContacts(db: Firestore): Promise<number> {
  const q = query(caspianCollections(db).contacts, where('status', '==', 'new'));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function setContactStatus(
  db: Firestore,
  id: string,
  status: ContactStatus,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'read' || status === 'archived') {
    patch.readAt = Timestamp.now();
  }
  await updateDoc(doc(db, 'contacts', id), patch);
}

export async function deleteContact(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'contacts', id));
}
