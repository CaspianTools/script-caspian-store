import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { reportFunctionError } from './error-report';

/** Mirrors `PURCHASED_STATUSES` in src/services/order-service.ts. */
const PURCHASED_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

/**
 * Stamps `isVerifiedPurchase: true` on a new review when the reviewer has a
 * paid order containing the product. Firestore rules only let a client
 * write `false` (or nothing) for that field — the badge was a client-side
 * claim before v15.1, and anyone could write `true` — so this trigger is
 * the single writer of the "verified" state. The moderation `status` is
 * untouched; the admin still approves the review.
 */
export const stampVerifiedPurchase = onDocumentCreated('reviews/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const review = snap.data() as { userId?: string; productId?: string; isVerifiedPurchase?: boolean };
  if (review.isVerifiedPurchase === true) return;
  if (typeof review.userId !== 'string' || typeof review.productId !== 'string') return;

  try {
    const ordersSnap = await getFirestore()
      .collection('orders')
      .where('userId', '==', review.userId)
      .where('status', 'in', PURCHASED_STATUSES)
      .get();
    const purchased = ordersSnap.docs.some((d) => {
      const items = d.data().items as Array<{ productId?: string }> | undefined;
      return items?.some((item) => item.productId === review.productId) ?? false;
    });
    if (!purchased) return;
    await snap.ref.update({ isVerifiedPurchase: true });
    logger.info(`[stampVerifiedPurchase] reviews/${event.params.id} marked as verified purchase.`);
  } catch (error) {
    logger.error('[stampVerifiedPurchase] Failed:', error);
    void reportFunctionError('stamp-verified-purchase.onReviewCreate', error, {
      reviewId: event.params.id,
    });
  }
});
