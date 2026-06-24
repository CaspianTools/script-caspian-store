import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Defense-in-depth admin gate: requires both the `admin` custom claim AND
 * `users/{uid}.role === 'admin'` in Firestore. Used by the connect/disconnect
 * and comment-moderation callables (the token-touching, write surfaces).
 * Mirror of functions-inventory/src/auth.ts.
 */
export async function assertAdmin(request: CallableRequest): Promise<void> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if ((request.auth.token as { role?: string }).role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }
  const snap = await getFirestore().collection('users').doc(request.auth.uid).get();
  if (!snap.exists || snap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }
}

/**
 * Staff gate — accepts `admin` OR `staff` (admins are implicitly staff). Gates
 * the read-only `instagramInbox` so in-person staff can view the feed/comments
 * without admin rights. Same claim-first / Firestore-fallback shape as assertAdmin.
 */
export async function assertStaff(request: CallableRequest): Promise<void> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const claimRole = (request.auth.token as { role?: string }).role;
  if (claimRole === 'admin' || claimRole === 'staff') return;
  const snap = await getFirestore().collection('users').doc(request.auth.uid).get();
  const role = snap.exists ? snap.data()?.role : undefined;
  if (role !== 'admin' && role !== 'staff') {
    throw new HttpsError('permission-denied', 'Staff role required.');
  }
}
