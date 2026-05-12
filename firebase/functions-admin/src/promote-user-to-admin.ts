import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin-only callable: promotes another user to `role: 'admin'`.
 *
 * Steady-state path for onboarding new admins from the AdminUsersPage UI —
 * complements `claimAdmin` (bootstrap-only) and the `grant-admin` CLI
 * (service-account required).
 *
 * Caller is verified two ways (defense-in-depth) — both must agree:
 *   1. `request.auth.token.role === 'admin'`  (the fast-path the rules use)
 *   2. `users/{caller.uid}.role === 'admin'`  (Firestore source of truth)
 *
 * The double-check protects against a freshly-demoted admin whose ID token
 * still carries `role: 'admin'` for up to ~1 hour after demotion.
 *
 * Failure modes:
 *   unauthenticated     — caller isn't signed in.
 *   permission-denied   — caller isn't admin (or claim/Firestore disagree).
 *   invalid-argument    — missing/invalid `uid` payload.
 *   not-found           — target user's `users/{uid}` doc doesn't exist.
 */
export const promoteUserToAdmin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before promoting users.');
  }
  const callerUid = request.auth.uid;
  const callerClaimRole = (request.auth.token as { role?: string }).role;
  if (callerClaimRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can promote users.');
  }

  const targetUid = (request.data as { uid?: unknown })?.uid;
  if (typeof targetUid !== 'string' || targetUid.length === 0) {
    throw new HttpsError('invalid-argument', '`uid` (string) is required.');
  }

  const db = getFirestore();

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can promote users.');
  }

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target user profile does not exist.');
  }
  if (targetSnap.data()?.role === 'admin') {
    return { ok: true, alreadyAdmin: true, requiresTokenRefresh: false };
  }

  await targetRef.update({ role: 'admin' });

  // Set the Auth custom claim inline. `syncAdminClaim` will also reconcile on
  // the Firestore write, but doing it here avoids eventual-consistency lag so
  // the client can refresh the target's token immediately if needed. Preserve
  // any pre-existing claims so other server-side processes aren't affected.
  const targetRecord = await getAuth().getUser(targetUid);
  await getAuth().setCustomUserClaims(targetUid, {
    ...(targetRecord.customClaims ?? {}),
    role: 'admin',
  });

  logger.info(
    `[promoteUserToAdmin] actor=${callerUid} promoted target=${targetUid} to admin.`,
  );

  return { ok: true, alreadyAdmin: false, requiresTokenRefresh: true };
});
