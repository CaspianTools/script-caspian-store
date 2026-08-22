import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';

/** Roles that are mirrored onto the Auth token. `customer` carries no claim. */
const CLAIM_ROLES = ['admin', 'staff'] as const;
type ClaimRole = (typeof CLAIM_ROLES)[number];

function asClaimRole(value: unknown): ClaimRole | null {
  return CLAIM_ROLES.includes(value as ClaimRole) ? (value as ClaimRole) : null;
}

/**
 * Keep the Firebase Auth custom claim `role` in sync with `users/{uid}.role`.
 *
 * firestore.rules and storage.rules check `request.auth.token.role` first
 * (with a Firestore fallback for migration safety), so the claim is what makes
 * authorization a zero-read operation. It is also set inline by `claimAdmin`,
 * `onUserCreate`, `setUserRole`, and the `grant-admin` CLI — but the Firestore
 * field can still change without passing through any of them (console edits,
 * data imports, backfill scripts). This trigger is the safety net: every write
 * to a `users/{uid}` doc reconciles the claim with whatever Firestore now
 * says. Idempotent — a correct claim is a no-op.
 *
 * v10.0.0 generalized this from admin-only to any claim-bearing role so POS
 * cashiers (`staff`) authorize the same way.
 *
 * NOTE: `index.ts` deliberately re-exports this as `syncAdminClaim`. The
 * exported symbol name *is* the deployed function name, so renaming it would
 * make every consumer's next `firebase deploy` offer to delete the old trigger
 * and create a new one — a confirmation prompt, a brief window with no claim
 * sync, and a hand-step in an upgrade that is supposed to be `npm install`
 * and nothing else. The file and the const carry the accurate name; the
 * deployed identity stays put.
 */
export const syncUserRoleClaim = onDocumentWritten('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const newRole = event.data?.after.data()?.role;
  const oldRole = event.data?.before.data()?.role;
  if (newRole === oldRole) return;

  let userRecord;
  try {
    userRecord = await getAuth().getUser(uid);
  } catch (error) {
    // The Firestore doc can outlive the Auth user (account deletion in flight,
    // or a stale doc from a deleted test user). Nothing to sync.
    logger.warn(`[syncUserRoleClaim] Auth user not found for uid=${uid}; skipping.`, error);
    return;
  }

  const existingClaims = userRecord.customClaims ?? {};
  const claimRole = (existingClaims as { role?: string }).role ?? null;
  const desiredRole = asClaimRole(newRole);

  if (desiredRole === claimRole) return;

  if (desiredRole) {
    await getAuth().setCustomUserClaims(uid, { ...existingClaims, role: desiredRole });
    logger.info(`[syncUserRoleClaim] Set role='${desiredRole}' claim for uid=${uid}.`);
    return;
  }

  const { role: _drop, ...rest } = existingClaims as { role?: string };
  void _drop;
  await getAuth().setCustomUserClaims(uid, rest);
  logger.info(`[syncUserRoleClaim] Cleared role claim for uid=${uid} (now '${newRole}').`);
});
