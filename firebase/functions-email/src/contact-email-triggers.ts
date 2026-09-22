/**
 * Transactional emails for contact-form submissions (v2.13; moved to
 * functions-email in v2.14 when the email codebase was split).
 *
 * Fires on every new `contacts/{id}` doc:
 *   1. Sends the `new_contact_admin` template to the merchant. Recipients
 *      come from the template's own `recipients[]`, falling back to
 *      `SiteSettings.contactEmail` — same chain as the order-admin emails.
 *   2. Sends the `contact_autoreply` template to the submitter's own email.
 *
 * Silent skip conditions match `order-email-triggers.ts`:
 *   - `emailSettings/site` missing or `enabled: false`.
 *   - The target template missing or `enabled: false`.
 *   - No enabled emailPluginInstalls provider (dispatcher returns error;
 *     we log + move on).
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { send } from './email-sender';
import { EMAIL_SECRETS } from './secrets';
import { renderEmail, type EmailSettingsFields, type RenderContext } from './email-renderer';

type ContactTemplateKey = 'new_contact_admin' | 'contact_autoreply';

interface ContactDoc {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  status?: string;
  createdAt?: FirebaseFirestore.Timestamp;
}

interface LoadedTemplate {
  enabled: boolean;
  subject: string;
  heading: string;
  additionalContent: string;
  recipients: string[];
}

export const runEmailOnContactCreate = onDocumentCreated(
  { document: 'contacts/{id}', secrets: EMAIL_SECRETS },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const contact = snap.data() as ContactDoc;
    const contactId = event.params.id;

    const db = getFirestore();
    const [settingsSnap, siteSnap] = await Promise.all([
      db.collection('emailSettings').doc('site').get(),
      db.collection('settings').doc('site').get(),
    ]);

    if (!settingsSnap.exists) {
      logger.info(`[email] No emailSettings/site — skipping contact ${contactId}.`);
      return;
    }
    const settings = settingsSnap.data() as EmailSettingsFields;
    if (!settings.enabled) {
      logger.info(`[email] emailSettings.enabled is false — skipping contact ${contactId}.`);
      return;
    }
    if (!settings.fromAddress) {
      logger.warn(`[email] emailSettings.fromAddress empty — skipping contact ${contactId}.`);
      return;
    }

    const siteBrand = siteSnap.exists ? String(siteSnap.data()?.brandName ?? '') : '';
    const siteContact = siteSnap.exists ? String(siteSnap.data()?.contactEmail ?? '') : '';

    const ctx: RenderContext = {
      siteTitle: settings.fromName || siteBrand || 'Store',
      orderNumber: '',
      orderTotal: '',
      orderDate: contact.createdAt ? contact.createdAt.toDate().toLocaleString() : '',
      customerName: contact.name ?? '',
      customerEmail: contact.email ?? '',
      contactName: contact.name ?? '',
      contactEmail: contact.email ?? '',
      contactSubject: contact.subject ?? '',
      contactMessage: contact.message ?? '',
    };

    // 1. Admin notify.
    const adminTpl = await loadTemplate(db, 'new_contact_admin');
    if (adminTpl && adminTpl.enabled) {
      const recipients =
        adminTpl.recipients.length > 0 ? adminTpl.recipients : siteContact ? [siteContact] : [];
      if (recipients.length > 0) {
        const rendered = renderEmail(adminTpl, settings, ctx);
        const result = await send({
          to: recipients,
          from: { email: settings.fromAddress, name: settings.fromName },
          replyTo: contact.email || settings.replyTo || undefined,
          ...rendered,
        });
        if (!result.ok) logger.warn(`[email] Admin send failed (${contactId}): ${result.error}`);
      } else {
        logger.warn(`[email] new_contact_admin has no recipients for contact ${contactId}.`);
      }
    }

    // 2. Auto-reply to submitter. `{contact_message}` is deliberately NOT
    // substituted here: the form is public and the recipient is whatever
    // address the submitter typed, so echoing the message body would turn
    // the store's sender into an open relay for spam addressed to third
    // parties. The merchant notification above still carries the message.
    if (contact.email) {
      const replyTpl = await loadTemplate(db, 'contact_autoreply');
      if (replyTpl && replyTpl.enabled) {
        const rendered = renderEmail(replyTpl, settings, { ...ctx, contactMessage: '' });
        const result = await send({
          to: contact.email,
          from: { email: settings.fromAddress, name: settings.fromName },
          replyTo: settings.replyTo || undefined,
          ...rendered,
        });
        if (!result.ok) {
          logger.warn(`[email] Auto-reply send failed (${contactId}): ${result.error}`);
        }
      }
    }
  },
);

async function loadTemplate(
  db: FirebaseFirestore.Firestore,
  key: ContactTemplateKey,
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
