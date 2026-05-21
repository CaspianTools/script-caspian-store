import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { reportFunctionError } from './error-report';

export interface GetGuestOrderRequest {
  orderId: string;
  email: string;
}

export interface GetGuestOrderResponse {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number | null;
  currency: string | null;
  promoCode: string | null;
  items: Array<{
    name: string;
    brand: string;
    price: number;
    quantity: number;
    selectedSize: string | null;
    selectedColor: string | null;
    imageUrl: string;
  }>;
  shippingInfo: {
    name: string;
    address: string;
    city: string;
    zip: string;
    country: string;
    shippingMethod: string;
  } | null;
  createdAt: string | null;
}

/**
 * Public guest-order lookup. WooCommerce equivalent: the
 * `[woocommerce_order_tracking]` shortcode — order number + billing email
 * is the credential pair.
 *
 * Verifies the supplied email (case-insensitive) against `orders/{id}.userEmail`
 * before returning a sanitized projection of the order. Returns `not-found`
 * for both "order doesn't exist" and "email mismatch" so the endpoint
 * can't be used to enumerate which order ids exist for an email.
 *
 * Unauthenticated — guests by definition can't sign in to check status.
 * Rate-limiting / abuse mitigation is left to Firebase's per-function
 * default quotas; consumers can add Cloud Armor in front if needed.
 *
 * Added in v9.1.
 */
export const getGuestOrder = onCall({ cors: true }, async (request) => {
  const { orderId, email } = (request.data ?? {}) as Partial<GetGuestOrderRequest>;

  if (typeof orderId !== 'string' || !orderId.trim()) {
    throw new HttpsError('invalid-argument', 'Missing orderId.');
  }
  if (typeof email !== 'string' || !email.trim()) {
    throw new HttpsError('invalid-argument', 'Missing email.');
  }

  const trimmedId = orderId.trim();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const db = getFirestore();
    const docSnap = await db.collection('orders').doc(trimmedId).get();

    // Single 404 path for both missing and email-mismatch so callers can't
    // probe which order ids exist for an arbitrary email.
    if (!docSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }
    const data = docSnap.data() ?? {};
    const orderEmail = String(data.userEmail ?? '').trim().toLowerCase();
    if (!orderEmail || orderEmail !== normalizedEmail) {
      throw new HttpsError('not-found', 'Order not found.');
    }

    const createdAtTs = data.createdAt;
    const createdAt =
      createdAtTs && typeof createdAtTs.toDate === 'function'
        ? (createdAtTs.toDate() as Date).toISOString()
        : null;

    const response: GetGuestOrderResponse = {
      id: docSnap.id,
      status: String(data.status ?? 'pending'),
      total: Number(data.total ?? 0),
      subtotal: Number(data.subtotal ?? 0),
      shippingCost: Number(data.shippingCost ?? 0),
      discount: Number(data.discount ?? 0),
      tax: typeof data.tax === 'number' ? data.tax : null,
      currency: typeof data.currency === 'string' ? data.currency : null,
      promoCode: typeof data.promoCode === 'string' ? data.promoCode : null,
      items: Array.isArray(data.items)
        ? data.items.map((it: Record<string, unknown>) => ({
            name: String(it.name ?? ''),
            brand: String(it.brand ?? ''),
            price: Number(it.price ?? 0),
            quantity: Number(it.quantity ?? 0),
            selectedSize: (it.selectedSize as string | null) ?? null,
            selectedColor: (it.selectedColor as string | null) ?? null,
            imageUrl: String(it.imageUrl ?? ''),
          }))
        : [],
      shippingInfo: data.shippingInfo
        ? {
            name: String((data.shippingInfo as Record<string, unknown>).name ?? ''),
            address: String((data.shippingInfo as Record<string, unknown>).address ?? ''),
            city: String((data.shippingInfo as Record<string, unknown>).city ?? ''),
            zip: String((data.shippingInfo as Record<string, unknown>).zip ?? ''),
            country: String((data.shippingInfo as Record<string, unknown>).country ?? ''),
            shippingMethod: String(
              (data.shippingInfo as Record<string, unknown>).shippingMethod ?? '',
            ),
          }
        : null,
      createdAt,
    };
    return response;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[caspian-admin] getGuestOrder failed:', error);
    void reportFunctionError('get-guest-order.lookup', error);
    throw new HttpsError('internal', 'Lookup failed.');
  }
});
