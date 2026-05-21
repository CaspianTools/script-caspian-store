import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { reportFunctionError } from './error-report';

const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * HTTP Stripe webhook. Listens for `checkout.session.completed` and:
 * 1. Skips duplicate events by looking up existing orders by session ID.
 * 2. Parses the rich metadata the checkout Cloud Function stored.
 * 3. Creates an order doc in `orders/` keyed by `H{timestamp}`.
 * 4. Decrements per-size stock on each product.
 * 5. Clears the user's cart in `carts/{uid}`.
 */
export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2024-11-20.acacia' as any,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET.value(),
      );
    } catch (err) {
      console.error('[caspian-webhook] Signature verification failed:', err);
      void reportFunctionError('stripe-webhook.signatureVerification', err);
      res.status(400).send('Webhook Error');
      return;
    }

    if (event.type !== 'checkout.session.completed') {
      res.status(200).send(`Ignored ${event.type}`);
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const db = getFirestore();

    try {
      // --- Duplicate detection ---
      const existing = await db
        .collection('orders')
        .where('payment.stripeSessionId', '==', session.id)
        .limit(1)
        .get();
      if (!existing.empty) {
        console.log(`[caspian-webhook] Skipping duplicate ${session.id}`);
        res.status(200).send(JSON.stringify({ received: true, duplicate: true }));
        return;
      }

      const metadata = session.metadata ?? {};
      const userId = metadata.userId || (session.client_reference_id ?? '');
      if (!userId) {
        console.error('[caspian-webhook] Missing userId in session', session.id);
        res.status(400).send('Missing userId');
        return;
      }

      let shippingInfo: Record<string, unknown> | null = null;
      let items: Array<{
        productId: string;
        name: string;
        brand: string;
        price: number;
        quantity: number;
        selectedSize: string | null;
        selectedColor: string | null;
        imageUrl: string;
      }> = [];
      // Tag each parse so Cloud Logs + the error-logs collection show
      // exactly which metadata field was malformed. Response body stays
      // opaque ("Malformed metadata") so a malicious caller can't enumerate
      // expected fields by replaying webhooks with different shapes.
      let parseField: 'shippingInfo' | 'items' | null = null;
      try {
        if (metadata.shippingInfo) {
          parseField = 'shippingInfo';
          shippingInfo = JSON.parse(metadata.shippingInfo);
        }
        if (metadata.items) {
          parseField = 'items';
          items = JSON.parse(metadata.items);
        }
      } catch (err) {
        console.error(
          `[caspian-webhook] Malformed metadata JSON in field "${parseField}" for session ${session.id}:`,
          err,
        );
        void reportFunctionError('stripe-webhook.malformedMetadata', err, {
          field: parseField ?? 'unknown',
          sessionId: session.id,
        });
        res.status(400).send('Malformed metadata');
        return;
      }

      if (items.length === 0) {
        console.error('[caspian-webhook] No items in session metadata');
        res.status(400).send('Missing items');
        return;
      }

      const userEmail = metadata.userEmail || session.customer_details?.email || '';
      const isGuest = metadata.isGuest === '1';
      const promoCode = metadata.promoCode || null;
      const discount = parseFloat(metadata.discount ?? '0') || 0;
      const shippingCost = parseFloat(metadata.shippingCost ?? '0') || 0;
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = Math.max(0, subtotal + shippingCost - discount);

      // --- Enrich payment from Stripe ---
      const paymentIntent = session.payment_intent
        ? await stripe.paymentIntents.retrieve(session.payment_intent as string)
        : null;
      const charge = paymentIntent?.latest_charge
        ? await stripe.charges.retrieve(paymentIntent.latest_charge as string)
        : null;
      const cardDetails = charge?.payment_method_details?.card;

      const orderId = `H${Date.now()}`;

      await db.collection('orders').doc(orderId).set({
        userId,
        userEmail,
        status: 'paid',
        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          brand: item.brand ?? '',
          price: item.price,
          quantity: item.quantity,
          selectedSize: item.selectedSize ?? null,
          selectedColor: item.selectedColor ?? null,
          imageUrl: item.imageUrl ?? '',
        })),
        shippingInfo: shippingInfo ?? {},
        payment: {
          stripeSessionId: session.id,
          last4: cardDetails?.last4 ?? '****',
          brand: cardDetails?.brand ?? 'card',
          amount: session.amount_total ?? 0,
        },
        subtotal,
        shippingCost,
        discount,
        promoCode,
        total,
        ...(isGuest ? { isGuest: true } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // --- Decrement per-size stock ---
      for (const item of items) {
        const stockField = item.selectedSize ? `stock.${item.selectedSize}` : 'stock._default';
        await db
          .collection('products')
          .doc(item.productId)
          .update({
            [stockField]: FieldValue.increment(-item.quantity),
            updatedAt: FieldValue.serverTimestamp(),
          })
          .catch((err) => {
            console.warn(`[caspian-webhook] Stock decrement failed for ${item.productId}:`, err);
          });
      }

      // --- Clear user's cart ---
      const cartRef = db.collection('carts').doc(userId);
      const cartSnap = await cartRef.get();
      if (cartSnap.exists) {
        await cartRef.update({
          items: [],
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      console.log(`[caspian-webhook] Order ${orderId} created for user ${userId}`);
      res.status(200).send(JSON.stringify({ received: true, orderId }));
    } catch (error) {
      console.error('[caspian-webhook] Failed to process checkout.session.completed:', error);
      void reportFunctionError('stripe-webhook.processCheckoutCompleted', error);
      res.status(500).send('Failed to process order');
    }
  },
);
