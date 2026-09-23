import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { reportFunctionError } from './error-report';

/**
 * Account-linking for guest checkout (WooCommerce-parity).
 *
 * Whenever a real account with a VERIFIED email exists, prior guest orders
 * that carry the same email are re-stamped onto it:
 *
 *   - `userId` ← new uid (so Firestore rules let the buyer read it from
 *     the Account page).
 *   - `isGuest` cleared (no longer a guest order).
 *
 * Verification is the whole security of this feature: an email/password
 * signup can claim any address, and before v15.1 the trigger attached that
 * address's guest orders (name, street address, purchase history) to the
 * new account on the spot. So linking runs on two paths, both gated on
 * `emailVerified`:
 *
 *   1. `linkGuestOrdersOnUserCreate` — fires on `users/{uid}` create. Covers
 *      providers that arrive verified (Google and other OAuth providers).
 *      An email/password signup is unverified at that moment and is skipped.
 *   2. `linkMyGuestOrders` — a callable for the client to invoke after the
 *      user verifies their address (Firebase has no "email verified"
 *      trigger). Reads `email_verified` from the ID token, so a fresh token
 *      is required after verification.
 *
 * Anonymous accounts are excluded — Firebase anonymous users get a
 * `users/{uid}` doc too (via `fetchOrCreateUserProfile`), but linking an
 * anonymous "account" to its own prior guest orders is a no-op and would
 * clobber the guest flag prematurely.
 *
 * Single batched write capped at 450 docs per run to stay well under
 * Firestore's 500-write batch limit. The unmatched remainder (rare — a
 * buyer would need 450+ guest orders on one email) is picked up by the next
 * call. Emails are compared lowercased: the Stripe callable and webhook
 * lowercase `userEmail` at write time so the equality query here matches.
 *
 * Added in v9.1 alongside the inline guest-checkout UX.
 */
async function linkGuestOrdersTo(uid: string, email: string): Promise<number> {
  const db = getFirestore();
  const ordersSnap = await db
    .collection('orders')
    .where('userEmail', '==', email)
    .where('isGuest', '==', true)
    .limit(450)
    .get();

  if (ordersSnap.empty) return 0;

  const batch = db.batch();
  for (const doc of ordersSnap.docs) {
    batch.update(doc.ref, {
      userId: uid,
      isGuest: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  logger.info(`[linkGuestOrders] Linked ${ordersSnap.size} guest order(s) to uid=${uid}.`);
  return ordersSnap.size;
}

export const linkGuestOrdersOnUserCreate = onDocumentCreated(
  'users/{uid}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const uid = event.params.uid;

    try {
      const userRecord = await getAuth().getUser(uid);
      // Anonymous accounts never own prior guest orders — they ARE the guest.
      if (userRecord.providerData.length === 0) {
        return;
      }
      if (!userRecord.emailVerified) {
        logger.info(`[linkGuestOrders] uid=${uid} email not verified yet; deferring to linkMyGuestOrders.`);
        return;
      }
      const email = (userRecord.email ?? '').trim().toLowerCase();
      if (!email) return;

      await linkGuestOrdersTo(uid, email);
    } catch (error) {
      logger.error('[linkGuestOrders] Failed to link guest orders:', error);
      void reportFunctionError('link-guest-orders.linkOnUserCreate', error, { uid });
    }
  },
);

/**
 * Client-invoked linking for accounts whose email was verified after signup
 * (email/password). Idempotent: already-linked orders no longer match the
 * `isGuest == true` filter. Returns the number of orders linked this call.
 */
export const linkMyGuestOrders = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  const token = request.auth.token;
  if (token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('failed-precondition', 'Guest sessions cannot claim orders.');
  }
  const email = (token.email ?? '').trim().toLowerCase();
  if (!email || token.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Verify your email address first.');
  }

  try {
    const linked = await linkGuestOrdersTo(request.auth.uid, email);
    return { linked };
  } catch (error) {
    logger.error('[linkGuestOrders] Callable failed:', error);
    void reportFunctionError('link-guest-orders.linkMyGuestOrders', error, {
      uid: request.auth.uid,
    });
    throw new HttpsError('internal', 'Could not link orders.');
  }
});
