/**
 * Transactional email triggers. Listens on the `orders/{id}` collection and
 * sends the matching template when an order is created or its status
 * transitions. Skips silently when:
 *
 *   - `emailSettings/site` doc is missing or `enabled: false`.
 *   - The target template doesn't exist yet or has `enabled: false`.
 *   - No enabled `emailPluginInstalls` provider is configured (the
 *     dispatcher in `email-sender.ts` logs + returns a failed SendResult).
 *
 * No retry: status transitions are the event of record and one missed email
 * is recoverable by the admin resending from the order detail page later.
 *
 * v8.0.0: provider API keys come from Google Secret Manager, declared in
 * `secrets.ts`. Each emitting trigger must attach `EMAIL_SECRETS` to its
 * options or `secret.value()` returns empty at runtime.
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { send } from './email-sender';
import { EMAIL_SECRETS } from './secrets';
import { renderEmail, type EmailSettingsFields, type RenderContext } from './email-renderer';

type AdminTemplateKey = 'new_order_admin' | 'cancelled_order_admin' | 'failed_order_admin';
type CustomerTemplateKey =
  | 'processing_order'
  | 'completed_order'
  | 'refunded_order'
  | 'customer_note'
  | 'new_account';
type TemplateKey = AdminTemplateKey | CustomerTemplateKey;

interface OrderDoc {
  userId?: string;
  userEmail?: string;
  status?: string;
  items?: Array<{ name?: string; price?: number; quantity?: number }>;
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  total?: number;
  createdAt?: FirebaseFirestore.Timestamp;
}

/**
 * Map an order's current status to the template key that should fire. Returns
 * `null` for statuses we don't have a template for — the trigger exits silently.
 */
function customerTemplateForStatus(status: string | undefined): CustomerTemplateKey | null {
  switch (status) {
    case 'paid':
    case 'processing':
      return 'processing_order';
    case 'shipped':
    case 'delivered':
      return 'completed_order';
    case 'refunded':
      return 'refunded_order';
    default:
      return null;
  }
}

function adminTemplateForStatus(status: string | undefined): AdminTemplateKey | null {
  switch (status) {
    case 'paid':
    case 'processing':
      return 'new_order_admin';
    case 'cancelled':
      return 'cancelled_order_admin';
    case 'pending':
    case 'on-hold':
      return 'failed_order_admin';
    default:
      return null;
  }
}

export const runEmailOnOrderCreate = onDocumentCreated(
  { document: 'orders/{id}', secrets: EMAIL_SECRETS },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const order = snap.data() as OrderDoc;
    const orderId = event.params.id;

    // Counter sales are not an inbox event. A walk-in has no address to write
    // to, and the shop owner does not want a "new order" mail for every item
    // rung up at the till — a busy Saturday would send hundreds, and draining a
    // backlog of held sales would send them all at once. The sale is already
    // visible on the Point of sale page and in the Orders list.
    if ((order as { channel?: string }).channel === 'pos') return;

    const customerKey = customerTemplateForStatus(order.status);
    const adminKey = adminTemplateForStatus(order.status);
    await sendForOrder(orderId, order, { customerKey, adminKey });
  },
);

export const runEmailOnOrderUpdate = onDocumentUpdated(
  { document: 'orders/{id}', secrets: EMAIL_SECRETS },
  async (event) => {
    const before = event.data?.before.data() as OrderDoc | undefined;
    const after = event.data?.after.data() as OrderDoc | undefined;
    if (!before || !after) return;
    if (before.status === after.status) return; // Only send on real status transitions.

    const orderId = event.params.id;
    const customerKey = customerTemplateForStatus(after.status);
    const adminKey = adminTemplateForStatus(after.status);
    await sendForOrder(orderId, after, { customerKey, adminKey });
  },
);

async function sendForOrder(
  orderId: string,
  order: OrderDoc,
  routes: { customerKey: CustomerTemplateKey | null; adminKey: AdminTemplateKey | null },
) {
  if (!routes.customerKey && !routes.adminKey) {
    logger.debug(
      `[email] No template matches order status "${order.status}"; skipping order ${orderId}.`,
    );
    return;
  }

  const db = getFirestore();
  const [settingsSnap, siteSnap] = await Promise.all([
    db.collection('emailSettings').doc('site').get(),
    db.collection('settings').doc('site').get(),
  ]);

  if (!settingsSnap.exists) {
    logger.info(`[email] No emailSettings/site doc — skipping order ${orderId}.`);
    return;
  }
  const settings = settingsSnap.data() as EmailSettingsFields;
  if (!settings.enabled) {
    logger.info(`[email] emailSettings.enabled is false — skipping order ${orderId}.`);
    return;
  }
  if (!settings.fromAddress) {
    logger.warn(`[email] emailSettings.fromAddress is empty — skipping order ${orderId}.`);
    return;
  }

  const siteBrand = siteSnap.exists ? String(siteSnap.data()?.brandName ?? '') : '';
  const siteContact = siteSnap.exists ? String(siteSnap.data()?.contactEmail ?? '') : '';

  const ctx: RenderContext = {
    siteTitle: settings.fromName || siteBrand || 'Store',
    orderNumber: orderId,
    orderTotal: typeof order.total === 'number' ? formatMoney(order.total) : '',
    orderDate: order.createdAt ? order.createdAt.toDate().toLocaleDateString() : '',
    customerName: extractCustomerName(order),
    customerEmail: order.userEmail ?? '',
  };

  if (routes.adminKey) {
    const tpl = await loadTemplate(db, routes.adminKey);
    if (tpl && tpl.enabled) {
      const recipients = tpl.recipients.length > 0 ? tpl.recipients : siteContact ? [siteContact] : [];
      if (recipients.length > 0) {
        const rendered = renderEmail(tpl, settings, ctx);
        const result = await send({
          to: recipients,
          from: { email: settings.fromAddress, name: settings.fromName },
          replyTo: settings.replyTo || undefined,
          ...rendered,
        });
        if (!result.ok) logger.warn(`[email] Admin send failed (${orderId}): ${result.error}`);
      } else {
        logger.warn(`[email] Admin template "${routes.adminKey}" has no recipients for ${orderId}.`);
      }
    }
  }

  if (routes.customerKey && order.userEmail) {
    const tpl = await loadTemplate(db, routes.customerKey);
    if (tpl && tpl.enabled) {
      const rendered = renderEmail(tpl, settings, ctx);
      const result = await send({
        to: order.userEmail,
        from: { email: settings.fromAddress, name: settings.fromName },
        replyTo: settings.replyTo || undefined,
        ...rendered,
      });
      if (!result.ok) logger.warn(`[email] Customer send failed (${orderId}): ${result.error}`);
    }
  }
}

interface LoadedTemplate {
  enabled: boolean;
  subject: string;
  heading: string;
  additionalContent: string;
  recipients: string[];
}

async function loadTemplate(
  db: FirebaseFirestore.Firestore,
  key: TemplateKey,
): Promise<LoadedTemplate | null> {
  const snap = await db.collection('emailTemplates').doc(key).get();
  if (!snap.exists) {
    logger.debug(`[email] Template "${key}" not configured; skipping.`);
    return null;
  }
  const data = snap.data()!;
  return {
    enabled: data.enabled ?? true,
    subject: String(data.subject ?? ''),
    heading: String(data.heading ?? ''),
    additionalContent: String(data.additionalContent ?? ''),
    recipients: Array.isArray(data.recipients) ? (data.recipients as string[]) : [],
  };
}

function formatMoney(n: number): string {
  // Keep this deliberately simple — the storefront owns full localization;
  // the trigger just needs a readable fallback.
  return `$${n.toFixed(2)}`;
}

function extractCustomerName(order: OrderDoc): string {
  const email = order.userEmail ?? '';
  return email.split('@')[0] || 'Customer';
}
