import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin-only callable: demotes another admin to `role: 'customer'`.
 *
 * Guards (server-enforced — UI hints mirror these but aren't authoritative):
 *   - Caller must be admin (claim + Firestore agree).
 *   - Cannot demote yourself — use a different admin account.
 *   - Cannot demote the last remaining admin (avoids locking the site out).
 *
 * After clearing the Firestore role and the `role` custom claim, this also
 * calls `revokeRefreshTokens(targetUid)`. Without revocation the target's
 * existing ID token still carries `role: 'admin'` for up to ~1 hour and the
 * security rules trust the claim first — meaning the demote wouldn't take
 * effect for any in-flight session.
 *
 * Failure modes:
 *   unauthenticated     — caller isn't signed in.
 *   permission-denied   — caller isn't admin (or claim/Firestore disagree).
 *   invalid-argument    — missing/invalid `uid` payload.
 *   failed-precondition — self-demote, or demoting the only admin.
 *   not-found           — target user's `users/{uid}` doc doesn't exist.
 */
export const demoteAdminToCustomer = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before demoting users.');
  }
  const callerUid = request.auth.uid;
  const callerClaimRole = (request.auth.token as { role?: string }).role;
  if (callerClaimRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can demote users.');
  }

  const targetUid = (request.data as { uid?: unknown })?.uid;
  if (typeof targetUid !== 'string' || targetUid.length === 0) {
    throw new HttpsError('invalid-argument', '`uid` (string) is required.');
  }

  if (targetUid === callerUid) {
    throw new HttpsError(
      'failed-precondition',
      'Use a different admin account to demote yourself.',
    );
  }

  const db = getFirestore();

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can demote users.');
  }

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target user profile does not exist.');
  }
  if (targetSnap.data()?.role !== 'admin') {
    return { ok: true, alreadyCustomer: true };
  }

  // Last-admin guard. limit(2) is enough to distinguish "only one" from "more
  // than one" without paying for a full count.
  const adminsSnap = await db
    .collection('users')
    .where('role', '==', 'admin')
    .limit(2)
    .get();
  if (adminsSnap.size <= 1) {
    throw new HttpsError(
      'failed-precondition',
      'Cannot demote the only admin. Promote another user to admin first.',
    );
  }

  await targetRef.update({ role: 'customer' });

  // Strip the `role` custom claim. Mirrors `ensureAdminClaim`'s stale-claim
  // cleanup path — preserve any unrelated claims, drop only `role`.
  const targetRecord = await getAuth().getUser(targetUid);
  const nextClaims: Record<string, unknown> = { ...(targetRecord.customClaims ?? {}) };
  delete nextClaims.role;
  await getAuth().setCustomUserClaims(targetUid, nextClaims);

  // Force re-auth so the cleared claim takes effect immediately, instead of
  // ~1 h later when the existing ID token expires.
  await getAuth().revokeRefreshTokens(targetUid);

  logger.info(
    `[demoteAdminToCustomer] actor=${callerUid} demoted target=${targetUid} (claim cleared, refresh tokens revoked).`,
  );

  return { ok: true, alreadyCustomer: false };
});
