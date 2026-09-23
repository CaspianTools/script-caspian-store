import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { FirestoreQuestion, ModerationStatus } from '../types';

function docToQuestion(docSnap: QueryDocumentSnapshot): FirestoreQuestion {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    productId: data.productId,
    userId: data.userId,
    author: data.author,
    photoURL: data.photoURL ?? null,
    text: data.text,
    createdAt: data.createdAt,
    answer: data.answer ?? null,
    answeredAt: data.answeredAt ?? null,
    answeredByUid: data.answeredByUid ?? null,
    status: data.status ?? 'pending',
  };
}

export async function getApprovedQuestionsForProduct(
  db: Firestore,
  productId: string,
): Promise<FirestoreQuestion[]> {
  const q = query(
    caspianCollections(db).questions,
    where('productId', '==', productId),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToQuestion);
}

export interface CreateQuestionInput {
  productId: string;
  text: string;
}

export interface CreateQuestionAuthor {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export async function createQuestion(
  db: Firestore,
  input: CreateQuestionInput,
  author: CreateQuestionAuthor,
): Promise<string> {
  if (!input.text.trim()) throw new Error('Question text is required.');
  const payload = {
    productId: input.productId,
    userId: author.uid,
    author: author.displayName || 'Anonymous',
    photoURL: author.photoURL ?? null,
    text: input.text.trim(),
    createdAt: Timestamp.now(),
    answer: null,
    answeredAt: null,
    answeredByUid: null,
    status: 'pending' as ModerationStatus,
  };
  const ref = await addDoc(caspianCollections(db).questions, payload);
  return ref.id;
}

export async function listAllQuestions(
  db: Firestore,
  statusFilter?: ModerationStatus,
): Promise<FirestoreQuestion[]> {
  // Filtered in memory: `status ==` + `orderBy(createdAt)` needs a composite
  // index that the shipped indexes.json does not include.
  const q = query(caspianCollections(db).questions, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(docToQuestion);
  return statusFilter ? all.filter((x) => x.status === statusFilter) : all;
}

export async function setQuestionStatus(
  db: Firestore,
  id: string,
  status: ModerationStatus,
): Promise<void> {
  await updateDoc(doc(db, 'questions', id), { status });
}

export async function answerQuestion(
  db: Firestore,
  id: string,
  answer: string,
  adminUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'questions', id), {
    answer: answer.trim(),
    answeredAt: Timestamp.now(),
    answeredByUid: adminUid,
  });
}

export async function deleteQuestion(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'questions', id));
}
