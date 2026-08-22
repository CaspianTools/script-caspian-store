import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ROLES = ['customer', 'staff', 'admin'] as const;
type Role = (typeof ROLES)[number];

/**
 * Admin-only callable: set any user's role to `customer`, `staff`, or `admin`.
 *
 * Added in v10.0.0 alongside the POS. `promoteUserToAdmin` and
 * `demoteAdminToCustomer` are the two-role predecessors and stay deployed for
 * back-compat; this one supersedes both and is what the admin Users UI calls.
 *
 * Caller is verified two ways (defense-in-depth) — both must agree:
 *   1. `request.auth.token.role === 'admin'`  (the fast path the rules use)
 *   2. `users/{caller.uid}.role === 'admin'`  (Firestore source of truth)
 *
 * The double-check protects against a freshly-demoted admin whose ID token
 * still carries `role: 'admin'` for up to ~1 hour after demotion.
 *
 * Self-demotion is refused. An admin who removes their own last admin role
 * locks everyone out of /admin, and the recovery path (the `claimAdmin`
 * bootstrap) only works while *no* admin exists — so it would not help.
 *
 * Failure modes:
 *   unauthenticated   — caller isn't signed in.
 *   permission-denied — caller isn't admin, or claim/Firestore disagree,
 *                       or the caller is targeting themselves.
 *   invalid-argument  — missing/invalid `uid` or `role`.
 *   not-found         — target user's `users/{uid}` doc doesn't exist.
 */
export const setUserRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before changing roles.');
  }
  const callerUid = request.auth.uid;
  if ((request.auth.token as { role?: string }).role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can change roles.');
  }

  const payload = (request.data ?? {}) as { uid?: unknown; role?: unknown };
  const targetUid = payload.uid;
  const nextRole = payload.role;
  if (typeof targetUid !== 'string' || targetUid.length === 0) {
    throw new HttpsError('invalid-argument', '`uid` (string) is required.');
  }
  if (!ROLES.includes(nextRole as Role)) {
    throw new HttpsError('invalid-argument', `\`role\` must be one of: ${ROLES.join(', ')}.`);
  }
  if (targetUid === callerUid) {
    throw new HttpsError(
      'permission-denied',
      'You cannot change your own role. Ask another admin to do it.',
    );
  }

  const db = getFirestore();

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can change roles.');
  }

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target user profile does not exist.');
  }

  const currentRole = targetSnap.data()?.role ?? 'customer';
  if (currentRole === nextRole) {
    return { ok: true, changed: false, role: nextRole, requiresTokenRefresh: false };
  }

  await targetRef.update({ role: nextRole });

  // Set the claim inline as well. `syncAdminClaim` (the Firestore trigger)
  // reconciles it too, but doing it here removes the eventual-consistency lag
  // so a client can force-refresh the target's token immediately. Preserve any
  // other claims so unrelated server-side processes aren't disturbed.
  const targetRecord = await getAuth().getUser(targetUid);
  const existingClaims = targetRecord.customClaims ?? {};
  if (nextRole === 'customer') {
    const { role: _drop, ...rest } = existingClaims as { role?: string };
    void _drop;
    await getAuth().setCustomUserClaims(targetUid, rest);
  } else {
    await getAuth().setCustomUserClaims(targetUid, { ...existingClaims, role: nextRole });
  }

  logger.info(
    `[setUserRole] actor=${callerUid} set target=${targetUid} from '${currentRole}' to '${nextRole}'.`,
  );

  return { ok: true, changed: true, role: nextRole, requiresTokenRefresh: true };
});
