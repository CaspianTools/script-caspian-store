import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { resolveStoreCurrency, toStripeAmount } from './currency';
import { assertShippingCost, type ShippingCartLine } from './shipping-rates';

const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');

export interface CheckoutItem {
  productId: string;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
}

export interface CheckoutShippingInfo {
  name: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  shippingMethod: string;
  orderNotes?: string;
}

export interface CreateCheckoutRequest {
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  /** Optional — server-validated. */
  promoCode?: string | null;
  /** Optional — verified against the store's enabled shipping installs. */
  shippingCost?: number;
  /** Optional — stored on the order doc when the webhook fires. */
  shippingInfo?: CheckoutShippingInfo;
  /** Optional — pass-through for analytics / emails. */
  locale?: string | null;
  /**
   * Form-collected contact email. Used as Stripe `customer_email` (so the
   * buyer doesn't re-enter it on Stripe Checkout) and stamped on the order
   * doc as `userEmail` by the webhook. Required in practice for anonymous
   * (guest) buyers, since `request.auth.token.email` is empty for those.
   * Added in v9.1 alongside guest checkout.
   */
  email?: string | null;
}

/** Priced cart line as stored on `pendingCheckouts/{id}` and, later, the order. */
export interface PendingOrderItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  selectedSize: string | null;
  selectedColor: string | null;
  imageUrl: string;
}

/**
 * Everything the webhook needs to write the order, keyed by the id the
 * session carries in `metadata.pendingCheckoutId`. Stripe caps every metadata
 * value at 500 characters, so the priced items list (image URLs alone run
 * ~150 chars each) and the shipping address no longer fit there — two items
 * in a cart already failed session creation. Server-only collection.
 */
export interface PendingCheckout {
  userId: string;
  userEmail: string;
  isGuest: boolean;
  items: PendingOrderItem[];
  shippingInfo: CheckoutShippingInfo | null;
  shippingCost: number;
  discount: number;
  promoCode: string | null;
  currency: string;
  locale: string;
}

function computeDiscount(subtotal: number, promo: FirebaseFirestore.DocumentData): number {
  if (promo.isActive === false) return 0;
  if (promo.minOrderAmount && subtotal < promo.minOrderAmount) return 0;
  let amount = 0;
  if (promo.type === 'percentage') {
    amount = (subtotal * (promo.value ?? 0)) / 100;
    if (promo.maxDiscount) amount = Math.min(amount, promo.maxDiscount);
  } else if (promo.type === 'fixed') {
    amount = Math.min(promo.value ?? 0, subtotal);
  }
  return Math.max(0, amount);
}

/**
 * Callable Cloud Function that:
 * 1. Validates each cart item against Firestore (existence, active, stock).
 * 2. Computes subtotal server-side (never trust client).
 * 3. Verifies the requested shipping cost against the store's enabled
 *    shipping installs and adds it as a line item when > 0.
 * 4. Resolves & validates promo code against the `promoCodes` collection.
 * 5. Writes the priced cart to `pendingCheckouts/{id}` and creates a Stripe
 *    Checkout Session whose metadata points at it, so the webhook can
 *    reconstruct the order.
 *
 * Consumers invoke via:
 *   httpsCallable(functions, 'createStripeCheckoutSession')(payload)
 */
export const createStripeCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required to check out.');
    }

    const data = request.data as CreateCheckoutRequest;
    if (!data?.items?.length) {
      throw new HttpsError('invalid-argument', 'Cart is empty.');
    }

    const db = getFirestore();
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2024-11-20.acacia' as any,
    });

    const currency = await resolveStoreCurrency(db);

    // From v8.4 the library stores `Product.brand` as a brand-doc id (was a
    // free-text name). Orders are historical records, so we capture the
    // human-readable brand name at the moment of purchase — falling back to
    // the raw value for legacy products that haven't been migrated yet, and
    // for the empty-string case.
    const brandsSnap = await db.collection('productBrands').get();
    const brandNameById = new Map<string, string>();
    for (const b of brandsSnap.docs) {
      const name = (b.data() as { name?: string }).name;
      if (typeof name === 'string') brandNameById.set(b.id, name);
    }

    // --- Validate items & compute subtotal server-side ---
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderItems: PendingOrderItem[] = [];
    const shippingLines: ShippingCartLine[] = [];
    let subtotal = 0;

    for (const item of data.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new HttpsError('invalid-argument', 'Item quantity must be a positive integer.');
      }
      const snap = await db.collection('products').doc(item.productId).get();
      if (!snap.exists) {
        throw new HttpsError('not-found', `Product ${item.productId} not found.`);
      }
      const product = snap.data()!;
      if (product.isActive === false) {
        throw new HttpsError('failed-precondition', `${product.name} is no longer available.`);
      }

      const stockKey = item.selectedSize || '_default';
      const availableStock =
        typeof product.stock?.[stockKey] === 'number' ? product.stock[stockKey] : null;
      if (availableStock !== null && availableStock < item.quantity) {
        throw new HttpsError(
          'failed-precondition',
          `Only ${availableStock} of ${product.name}${
            item.selectedSize ? ` (${item.selectedSize})` : ''
          } in stock.`,
        );
      }

      subtotal += product.price * item.quantity;
      shippingLines.push({
        quantity: item.quantity,
        weightKg: typeof product.weightKg === 'number' ? product.weightKg : null,
      });

      const variant = item.selectedColor
        ? (product.colorVariants as Array<{ name: string; imageUrl: string }> | undefined)?.find(
            (v) => v.name === item.selectedColor,
          )
        : undefined;
      const imageUrl = variant?.imageUrl ?? product.images?.[0]?.url ?? '';

      const descriptionParts: string[] = [];
      if (item.selectedColor) descriptionParts.push(`Color: ${item.selectedColor}`);
      if (item.selectedSize) descriptionParts.push(`Size: ${item.selectedSize}`);

      lineItems.push({
        price_data: {
          currency,
          unit_amount: toStripeAmount(product.price, currency),
          product_data: {
            name: product.name,
            description: descriptionParts.length > 0 ? descriptionParts.join(' · ') : undefined,
            images: imageUrl ? [imageUrl] : undefined,
          },
        },
        quantity: item.quantity,
      });

      const rawBrand = (product.brand as string | undefined) ?? '';
      orderItems.push({
        productId: item.productId,
        name: product.name,
        brand: brandNameById.get(rawBrand) ?? rawBrand,
        price: product.price,
        quantity: item.quantity,
        selectedSize: item.selectedSize ?? null,
        selectedColor: item.selectedColor ?? null,
        imageUrl,
      });
    }

    // --- Shipping: verified against the store's offered rates, then a line item ---
    const shippingCost = await assertShippingCost(
      db,
      data.shippingCost,
      data.shippingInfo?.shippingMethod,
      subtotal,
      shippingLines,
    );
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency,
          unit_amount: toStripeAmount(shippingCost, currency),
          product_data: {
            name: `Shipping${
              data.shippingInfo?.shippingMethod ? ` (${data.shippingInfo.shippingMethod})` : ''
            }`,
          },
        },
        quantity: 1,
      });
    }

    // --- Server-side promo code validation ---
    let discount = 0;
    let appliedPromoCode: string | null = null;
    if (data.promoCode) {
      const snap = await db
        .collection('promoCodes')
        .where('code', '==', data.promoCode.toUpperCase())
        .where('isActive', '==', true)
        .limit(1)
        .get();
      if (!snap.empty) {
        const promo = snap.docs[0].data();
        discount = computeDiscount(subtotal, promo);
        if (discount > 0) appliedPromoCode = promo.code;
      }
    }

    // Anonymous-auth users (WooCommerce-style guest checkout) have an empty
    // token email, so the form-collected email is the only contact channel.
    // Form email wins when present, even for signed-in buyers — they may want
    // the order receipt to go to a different address. Lowercased so the
    // guest-order linking trigger's equality query matches the Auth record.
    const formEmail = typeof data.email === 'string' ? data.email.trim() : '';
    const resolvedEmail = (formEmail || request.auth.token.email || '').toLowerCase();
    const isGuest = request.auth.token.firebase?.sign_in_provider === 'anonymous';

    const pending: PendingCheckout = {
      userId: request.auth.uid,
      userEmail: resolvedEmail,
      isGuest,
      items: orderItems,
      shippingInfo: data.shippingInfo ?? null,
      shippingCost,
      discount,
      promoCode: appliedPromoCode,
      currency,
      locale: data.locale ?? '',
    };
    const pendingRef = db.collection('pendingCheckouts').doc();
    await pendingRef.set({ ...pending, createdAt: FieldValue.serverTimestamp() });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: data.successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? data.successUrl
        : `${data.successUrl}${data.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl,
      client_reference_id: request.auth.uid,
      customer_email: resolvedEmail || undefined,
      metadata: {
        pendingCheckoutId: pendingRef.id,
        userId: request.auth.uid,
        userEmail: resolvedEmail,
        isGuest: isGuest ? '1' : '',
      },
    };

    if (discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: toStripeAmount(discount, currency),
        currency,
        duration: 'once',
        name: appliedPromoCode ?? 'Discount',
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    await pendingRef.update({ stripeSessionId: session.id });
    return { sessionId: session.id, url: session.url };
  },
);
