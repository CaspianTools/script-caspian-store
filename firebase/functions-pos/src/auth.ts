import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export interface PosCaller {
  uid: string;
  name: string;
  email: string;
  role: 'staff' | 'admin';
}

/**
 * Authorize a POS callable. Mirrors the `isStaff()` predicate in
 * firestore.rules: the Auth custom claim is the fast path, and a Firestore
 * read is the fallback for accounts promoted before their token rotated.
 *
 * `admin` is deliberately accepted everywhere `staff` is — an owner working
 * the counter must not need a second account.
 *
 * Unlike the rules, the Firestore read here is not optional: a token claim
 * survives for up to ~1 hour after a role is revoked, and these callables
 * move money and stock. Confirming against the document costs one read and
 * closes that window.
 */
export async function assertStaff(request: CallableRequest): Promise<PosCaller> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to use the register.');
  }
  const uid = request.auth.uid;
  const snap = await getFirestore().collection('users').doc(uid).get();
  const role = snap.exists ? snap.data()?.role : undefined;
  if (role !== 'staff' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'This account is not a register user.');
  }
  return {
    uid,
    name: (snap.data()?.displayName as string | undefined) ?? '',
    email: (snap.data()?.email as string | undefined) ?? request.auth.token.email ?? '',
    role,
  };
}
