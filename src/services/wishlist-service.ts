import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

export async function addToWishlist(db: Firestore, uid: string, productId: string) {
  await updateDoc(doc(db, 'users', uid), { wishlist: arrayUnion(productId) });
}

export async function removeFromWishlist(db: Firestore, uid: string, productId: string) {
  await updateDoc(doc(db, 'users', uid), { wishlist: arrayRemove(productId) });
}

export async function loadUserWishlist(db: Firestore, uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return [];
  const data = snap.data() as { wishlist?: string[] };
  return data.wishlist ?? [];
}

export async function saveUserWishlist(
  db: Firestore,
  uid: string,
  ids: string[],
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { wishlist: ids });
}

// Union the local (anon) wishlist with the server wishlist on sign-in. Writes
// back only if the merged set actually adds items beyond what the server had,
// so a re-mount with no local items is a no-op. Returns the merged array so
// the caller can seed local state without a second read.
export async function mergeWishlistOnSignIn(
  db: Firestore,
  uid: string,
  localIds: string[],
): Promise<string[]> {
  const server = await loadUserWishlist(db, uid);
  if (localIds.length === 0) return server;
  const merged = Array.from(new Set([...server, ...localIds]));
  if (merged.length !== server.length) {
    await saveUserWishlist(db, uid, merged);
  }
  return merged;
}
