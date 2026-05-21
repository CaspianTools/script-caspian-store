import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { reportFunctionError } from './error-report';

/**
 * Account-linking trigger for guest checkout (WooCommerce-parity).
 *
 * Fires on `users/{uid}` create — the same path `onUserCreate` watches.
 * Whenever a real account is added, we look up prior guest orders that
 * matched the same email and re-stamp them onto the new account:
 *
 *   - `userId` ← new uid (so Firestore rules let the buyer read it from
 *     the Account page).
 *   - `isGuest` cleared (no longer a guest order).
 *
 * Anonymous accounts are excluded — Firebase anonymous users get a
 * `users/{uid}` doc too (via `fetchOrCreateUserProfile`), but linking
 * an anonymous "account" to its own prior guest orders is a no-op and
 * would clobber the guest flag prematurely.
 *
 * Single batched write capped at 450 docs per fire to stay well under
 * Firestore's 500-write batch limit. The unmatched remainder (rare —
 * a buyer would need to have placed 450+ guest orders with the same
 * email) is left for the next run; admins can re-run via the admin
 * panel if needed.
 *
 * Added in v9.1 alongside the inline guest-checkout UX.
 */
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
      const email = (userRecord.email ?? '').trim().toLowerCase();
      if (!email) return;

      const db = getFirestore();
      const ordersSnap = await db
        .collection('orders')
        .where('userEmail', '==', email)
        .where('isGuest', '==', true)
        .limit(450)
        .get();

      if (ordersSnap.empty) return;

      const batch = db.batch();
      for (const doc of ordersSnap.docs) {
        batch.update(doc.ref, {
          userId: uid,
          isGuest: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();

      logger.info(
        `[linkGuestOrders] Linked ${ordersSnap.size} guest order(s) to uid=${uid} email=${email}.`,
      );
    } catch (error) {
      logger.error('[linkGuestOrders] Failed to link guest orders:', error);
      void reportFunctionError('link-guest-orders.linkOnUserCreate', error, { uid });
    }
  },
);
