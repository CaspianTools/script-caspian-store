import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

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
  /** Optional — if provided, added as a shipping line item. */
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
 * 3. Resolves & validates promo code against the `promoCodes` collection.
 * 4. Adds shipping as a line item when cost > 0.
 * 5. Creates a Stripe Checkout Session with rich metadata so the webhook can
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
    const orderItems: Array<{
      productId: string;
      name: string;
      brand: string;
      price: number;
      quantity: number;
      selectedSize: string | null;
      selectedColor: string | null;
      imageUrl: string;
    }> = [];
    let subtotal = 0;

    for (const item of data.items) {
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

      const unitPriceCents = Math.round(product.price * 100);
      subtotal += product.price * item.quantity;

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
          currency: 'usd',
          unit_amount: unitPriceCents,
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

    // --- Shipping as a line item ---
    const shippingCost = data.shippingCost ?? 0;
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(shippingCost * 100),
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
    // the order receipt to go to a different address.
    const formEmail = typeof data.email === 'string' ? data.email.trim() : '';
    const resolvedEmail = formEmail || request.auth.token.email || '';
    const isGuest = request.auth.token.firebase?.sign_in_provider === 'anonymous';

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
        userId: request.auth.uid,
        userEmail: resolvedEmail,
        isGuest: isGuest ? '1' : '',
        promoCode: appliedPromoCode ?? '',
        discount: discount.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        shippingInfo: data.shippingInfo ? JSON.stringify(data.shippingInfo) : '',
        items: JSON.stringify(orderItems),
        locale: data.locale ?? '',
      },
    };

    if (discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discount * 100),
        currency: 'usd',
        duration: 'once',
        name: appliedPromoCode ?? 'Discount',
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { sessionId: session.id, url: session.url };
  },
);
