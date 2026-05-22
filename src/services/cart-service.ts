import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import type { CartItemRef, FirestoreCart } from '../types';

export async function loadUserCart(db: Firestore, uid: string): Promise<CartItemRef[]> {
  const snap = await getDoc(doc(db, 'carts', uid));
  if (!snap.exists()) return [];
  const data = snap.data() as FirestoreCart;
  return data.items ?? [];
}

export async function saveUserCart(
  db: Firestore,
  uid: string,
  items: CartItemRef[],
): Promise<void> {
  await setDoc(doc(db, 'carts', uid), { items, updatedAt: Timestamp.now() });
}

function sameLine(a: CartItemRef, b: CartItemRef): boolean {
  return (
    a.productId === b.productId &&
    (a.selectedSize ?? '') === (b.selectedSize ?? '') &&
    (a.selectedColor ?? '') === (b.selectedColor ?? '')
  );
}

// Fold two cart-item arrays into one. Matching lines (same product + size +
// color) have their quantities summed; non-matching lines are appended. Used
// to merge an anon shopper's local/prior cart into their newly-authenticated
// cart on sign-in.
export function combineCartItems(base: CartItemRef[], extra: CartItemRef[]): CartItemRef[] {
  if (extra.length === 0) return base;
  const out: CartItemRef[] = base.map((item) => ({ ...item }));
  for (const incoming of extra) {
    const idx = out.findIndex((item) => sameLine(item, incoming));
    if (idx === -1) {
      out.push({ ...incoming });
    } else {
      out[idx] = { ...out[idx], quantity: out[idx].quantity + incoming.quantity };
    }
  }
  return out;
}

// Merge anonymous-side cart items into the signed-in user's server cart.
// Writes back only when the merge actually adds lines or changes quantities,
// so a re-mount with no anon items is a no-op read. Returns the merged array
// so the caller can seed local state without a second round-trip. Mirrors
// `mergeWishlistOnSignIn` in wishlist-service.ts; the difference is that
// cart lines carry quantities + size/color variant identity, so the merge
// sums quantities for matching lines instead of doing a set union.
export async function mergeCartOnSignIn(
  db: Firestore,
  uid: string,
  localItems: CartItemRef[],
): Promise<CartItemRef[]> {
  const server = await loadUserCart(db, uid);
  if (localItems.length === 0) return server;
  const merged = combineCartItems(server, localItems);
  if (cartItemsDiffer(server, merged)) {
    await saveUserCart(db, uid, merged);
  }
  return merged;
}

function cartItemsDiffer(a: CartItemRef[], b: CartItemRef[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.productId !== y.productId ||
      x.quantity !== y.quantity ||
      (x.selectedSize ?? '') !== (y.selectedSize ?? '') ||
      (x.selectedColor ?? '') !== (y.selectedColor ?? '')
    ) {
      return true;
    }
  }
  return false;
}
