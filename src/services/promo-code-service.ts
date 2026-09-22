import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { AppliedPromoCode, PromoCode } from '../types';
import { stripUndefined } from '../utils/strip-undefined';

function docToPromoCode(snap: QueryDocumentSnapshot): PromoCode {
  const data = snap.data();
  return {
    id: snap.id,
    code: data.code,
    type: data.type,
    value: data.value,
    minOrderAmount: data.minOrderAmount,
    maxDiscount: data.maxDiscount,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
  };
}

export async function listPromoCodes(db: Firestore): Promise<PromoCode[]> {
  const q = query(caspianCollections(db).promoCodes, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToPromoCode);
}

export type PromoCodeWriteInput = Omit<PromoCode, 'id' | 'createdAt'>;

export type PromoCodeInputProblem =
  | 'percentageRange'
  | 'fixedPositive'
  | 'minOrderNegative'
  | 'maxDiscountNegative';

/**
 * Range check for the admin form. Returns the first problem found, or `null`
 * when the input is storable. A percentage outside (0, 100] or a fixed amount
 * of 0 would be accepted by Firestore but silently produce a useless — or,
 * for >100%, a negative-total — discount at checkout.
 */
export function validatePromoCodeInput(input: PromoCodeWriteInput): PromoCodeInputProblem | null {
  const value = Number(input.value);
  if (input.type === 'percentage') {
    if (!Number.isFinite(value) || value <= 0 || value > 100) return 'percentageRange';
  } else if (!Number.isFinite(value) || value <= 0) {
    return 'fixedPositive';
  }
  if (input.minOrderAmount !== undefined && !(input.minOrderAmount >= 0)) return 'minOrderNegative';
  if (input.maxDiscount !== undefined && !(input.maxDiscount >= 0)) return 'maxDiscountNegative';
  return null;
}

export async function createPromoCode(
  db: Firestore,
  input: PromoCodeWriteInput,
  id?: string,
): Promise<string> {
  const payload = stripUndefined({
    ...input,
    code: input.code.toUpperCase(),
    createdAt: Timestamp.now(),
  });
  if (id) {
    await setDoc(doc(db, 'promoCodes', id), payload);
    return id;
  }
  const ref = await addDoc(caspianCollections(db).promoCodes, payload);
  return ref.id;
}

export async function updatePromoCode(
  db: Firestore,
  id: string,
  input: Partial<PromoCodeWriteInput>,
): Promise<void> {
  const patch: Partial<PromoCodeWriteInput> = { ...input };
  if (typeof patch.code === 'string') patch.code = patch.code.toUpperCase();
  await updateDoc(doc(db, 'promoCodes', id), stripUndefined(patch));
}

export async function deletePromoCode(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'promoCodes', id));
}

/**
 * Client-side promo code validator. Mirrors the server-side logic in the
 * `createStripeCheckoutSession` Cloud Function so consumers can show an
 * applied-discount preview in the cart before checkout.
 *
 * Security note: the authoritative discount is STILL computed server-side by
 * the Cloud Function at checkout time. This helper is for UI only.
 */
export async function validatePromoCode(
  db: Firestore,
  code: string,
  subtotal: number,
): Promise<AppliedPromoCode | null> {
  if (!code.trim()) return null;

  const snap = await getDocs(
    query(
      caspianCollections(db).promoCodes,
      where('code', '==', code.trim().toUpperCase()),
      where('isActive', '==', true),
      limit(1),
    ),
  );
  if (snap.empty) return null;

  const promo = snap.docs[0].data() as {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    isActive: boolean;
  };

  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) return null;

  let discountAmount = 0;
  if (promo.type === 'percentage') {
    discountAmount = (subtotal * (promo.value ?? 0)) / 100;
    if (promo.maxDiscount) discountAmount = Math.min(discountAmount, promo.maxDiscount);
  } else if (promo.type === 'fixed') {
    discountAmount = Math.min(promo.value ?? 0, subtotal);
  }

  discountAmount = Math.max(0, discountAmount);
  if (discountAmount <= 0) return null;

  return {
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discountAmount,
  };
}
