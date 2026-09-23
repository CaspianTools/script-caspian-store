import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { reportFunctionError } from './error-report';
import type { CheckoutShippingInfo, PendingCheckout, PendingOrderItem } from './stripe-checkout';

const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * HTTP Stripe webhook. Listens for `checkout.session.completed` and:
 * 1. Loads the priced cart from `pendingCheckouts/{metadata.pendingCheckoutId}`
 *    (sessions created before v15.1 carried the cart inline in metadata;
 *    that path is still honoured).
 * 2. In ONE transaction: claims `stripeEvents/{event.id}`, creates the order
 *    doc in `orders/` keyed by `H{timestamp}`, decrements per-size stock,
 *    clears the user's cart in `carts/{uid}` and deletes the pending doc.
 *    A concurrent redelivery of the same event fails on the marker create
 *    instead of writing a second order and decrementing stock twice.
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
    const eventRef = db.collection('stripeEvents').doc(event.id);

    try {
      // --- Duplicate detection (cheap pre-checks; the transaction is authoritative) ---
      if ((await eventRef.get()).exists) {
        console.log(`[caspian-webhook] Skipping duplicate event ${event.id}`);
        res.status(200).send(JSON.stringify({ received: true, duplicate: true }));
        return;
      }
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

      let shippingInfo: CheckoutShippingInfo | Record<string, unknown> | null = null;
      let items: PendingOrderItem[] = [];
      let promoCode: string | null = null;
      let discount = 0;
      let shippingCost = 0;
      let userEmail = '';
      let isGuest = false;
      let pendingRef: FirebaseFirestore.DocumentReference | null = null;

      if (metadata.pendingCheckoutId) {
        pendingRef = db.collection('pendingCheckouts').doc(metadata.pendingCheckoutId);
        const pendingSnap = await pendingRef.get();
        if (!pendingSnap.exists) {
          console.error(
            `[caspian-webhook] pendingCheckouts/${metadata.pendingCheckoutId} missing for session ${session.id}`,
          );
          void reportFunctionError('stripe-webhook.missingPendingCheckout', new Error('missing'), {
            sessionId: session.id,
          });
          res.status(400).send('Missing pending checkout');
          return;
        }
        const pending = pendingSnap.data() as PendingCheckout;
        items = pending.items ?? [];
        shippingInfo = pending.shippingInfo ?? null;
        promoCode = pending.promoCode ?? null;
        discount = pending.discount ?? 0;
        shippingCost = pending.shippingCost ?? 0;
        userEmail = pending.userEmail ?? '';
        isGuest = pending.isGuest === true;
      } else {
        // Legacy sessions (created before v15.1) carry the cart in metadata.
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
        promoCode = metadata.promoCode || null;
        discount = parseFloat(metadata.discount ?? '0') || 0;
        shippingCost = parseFloat(metadata.shippingCost ?? '0') || 0;
        userEmail = metadata.userEmail ?? '';
        isGuest = metadata.isGuest === '1';
      }

      if (items.length === 0) {
        console.error('[caspian-webhook] No items for session', session.id);
        res.status(400).send('Missing items');
        return;
      }

      // Lowercased so `linkGuestOrdersOnUserCreate`'s equality query on
      // `userEmail` matches the (lowercased) Auth record email.
      userEmail = (userEmail || session.customer_details?.email || '').trim().toLowerCase();
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = Math.max(0, subtotal + shippingCost - discount);

      // --- Enrich payment from Stripe (outside the transaction: it may retry) ---
      const paymentIntent = session.payment_intent
        ? await stripe.paymentIntents.retrieve(session.payment_intent as string)
        : null;
      const charge = paymentIntent?.latest_charge
        ? await stripe.charges.retrieve(paymentIntent.latest_charge as string)
        : null;
      const cardDetails = charge?.payment_method_details?.card;

      const orderId = `H${Date.now()}`;
      const orderRef = db.collection('orders').doc(orderId);
      const cartRef = db.collection('carts').doc(userId);
      const productRefs = [...new Set(items.map((i) => i.productId))].map((id) =>
        db.collection('products').doc(id),
      );

      const outcome = await db.runTransaction(async (tx) => {
        // Firestore requires every read to precede every write in a transaction.
        const marker = await tx.get(eventRef);
        if (marker.exists) return 'duplicate' as const;
        const [cartSnap, ...productSnaps] = await Promise.all([
          tx.get(cartRef),
          ...productRefs.map((ref) => tx.get(ref)),
        ]);
        const existingProducts = new Set(productSnaps.filter((s) => s.exists).map((s) => s.id));

        // `create` (not `set`) so two deliveries racing past the pre-check
        // cannot both commit — the loser's transaction aborts here.
        tx.create(eventRef, {
          sessionId: session.id,
          orderId,
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.set(orderRef, {
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

        // --- Decrement per-size stock (deleted products are skipped, not fatal) ---
        for (const item of items) {
          if (!existingProducts.has(item.productId)) {
            console.warn(`[caspian-webhook] Product ${item.productId} gone; stock not decremented.`);
            continue;
          }
          const stockField = item.selectedSize ? `stock.${item.selectedSize}` : 'stock._default';
          tx.update(db.collection('products').doc(item.productId), {
            [stockField]: FieldValue.increment(-item.quantity),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        if (cartSnap.exists) {
          tx.update(cartRef, { items: [], updatedAt: FieldValue.serverTimestamp() });
        }
        if (pendingRef) tx.delete(pendingRef);
        return 'created' as const;
      });

      if (outcome === 'duplicate') {
        console.log(`[caspian-webhook] Skipping duplicate event ${event.id} (transaction)`);
        res.status(200).send(JSON.stringify({ received: true, duplicate: true }));
        return;
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
