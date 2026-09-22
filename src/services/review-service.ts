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
import type { FirestoreReview, ModerationStatus, ReviewPolicy } from '../types';
import { hasUserPurchasedProduct } from './order-service';

export type ReviewSortBy = 'recent' | 'highest' | 'lowest';

function docToReview(docSnap: QueryDocumentSnapshot): FirestoreReview {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    productId: data.productId,
    userId: data.userId,
    author: data.author,
    photoURL: data.photoURL ?? null,
    rating: data.rating,
    text: data.text,
    createdAt: data.createdAt,
    isVerifiedPurchase: data.isVerifiedPurchase ?? false,
    status: data.status ?? 'pending',
  };
}

export async function getApprovedReviewsForProduct(
  db: Firestore,
  productId: string,
  sortBy: ReviewSortBy = 'recent',
): Promise<FirestoreReview[]> {
  const q = query(
    caspianCollections(db).reviews,
    where('productId', '==', productId),
    where('status', '==', 'approved'),
    sortBy === 'highest' || sortBy === 'lowest'
      ? orderBy('rating', sortBy === 'highest' ? 'desc' : 'asc')
      : orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToReview);
}

export async function hasUserReviewedProduct(
  db: Firestore,
  userId: string,
  productId: string,
): Promise<boolean> {
  const q = query(
    caspianCollections(db).reviews,
    where('productId', '==', productId),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  text: string;
}

export interface CreateReviewAuthor {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

export async function createReview(
  db: Firestore,
  input: CreateReviewInput,
  author: CreateReviewAuthor,
  policy?: ReviewPolicy,
): Promise<string> {
  if (policy?.requireStarRating && (!Number.isFinite(input.rating) || input.rating < 1)) {
    throw new Error('A star rating is required.');
  }
  if (input.rating < 1 || input.rating > 5) throw new Error('Rating must be 1–5.');
  if (!input.text.trim()) throw new Error('Review text is required.');
  if (policy?.restrictToVerifiedBuyers) {
    const purchased = await hasUserPurchasedProduct(db, author.uid, input.productId);
    if (!purchased) throw new Error('Only verified buyers can leave a review for this product.');
  }
  const payload = {
    productId: input.productId,
    userId: author.uid,
    author: author.displayName || 'Anonymous',
    photoURL: author.photoURL ?? null,
    rating: input.rating,
    text: input.text.trim(),
    createdAt: Timestamp.now(),
    // The badge is stamped server-side by the `stampVerifiedPurchase`
    // trigger after checking the reviewer's orders; the rules reject `true`
    // from a client so it cannot be forged.
    isVerifiedPurchase: false,
    status: 'pending' as ModerationStatus,
  };
  const ref = await addDoc(caspianCollections(db).reviews, payload);
  return ref.id;
}

export async function listAllReviews(
  db: Firestore,
  statusFilter?: ModerationStatus,
): Promise<FirestoreReview[]> {
  // Filtered in memory: `status ==` + `orderBy(createdAt)` needs a composite
  // index that the shipped indexes.json does not include.
  const constraints = [orderBy('createdAt', 'desc')];
  const q = query(caspianCollections(db).reviews, ...constraints);
  const snap = await getDocs(q);
  const all = snap.docs.map(docToReview);
  return statusFilter ? all.filter((x) => x.status === statusFilter) : all;
}

export async function setReviewStatus(
  db: Firestore,
  id: string,
  status: ModerationStatus,
): Promise<void> {
  await updateDoc(doc(db, 'reviews', id), { status });
}

export async function deleteReview(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', id));
}
