import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  type Firestore,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';
import { caspianCollections } from '../firebase/collections';
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailAudience,
  type EmailSettings,
  type EmailTemplate,
  type EmailTemplateKey,
} from '../types';
import { stripUndefined } from '../utils/strip-undefined';

/**
 * Audience-by-key lookup used to stamp the correct recipient mode when a
 * template doc is created for the first time. The admin UI can't change
 * this; it's a build-time property of the template.
 */
export const EMAIL_TEMPLATE_AUDIENCE: Record<EmailTemplateKey, EmailAudience> = {
  new_order_admin: 'admin',
  cancelled_order_admin: 'admin',
  failed_order_admin: 'admin',
  processing_order: 'customer',
  completed_order: 'customer',
  refunded_order: 'customer',
  customer_note: 'customer',
  new_account: 'customer',
  new_contact_admin: 'admin',
  contact_autoreply: 'customer',
};

/**
 * Merchant-facing labels shown in the admin emails page list. Kept as a map
 * so translations can replace the object wholesale without touching the
 * template keys the Cloud Function consumes.
 */
export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  new_order_admin: 'New order (admin)',
  cancelled_order_admin: 'Cancelled order (admin)',
  failed_order_admin: 'Failed / pending order (admin)',
  processing_order: 'Processing order (customer)',
  completed_order: 'Completed / delivered order (customer)',
  refunded_order: 'Refunded order (customer)',
  customer_note: 'Customer note (customer)',
  new_account: 'New account (customer)',
  new_contact_admin: 'New contact submission (admin)',
  contact_autoreply: 'Contact auto-reply (customer)',
};

const DEFAULT_TEMPLATES: Record<
  EmailTemplateKey,
  Pick<EmailTemplate, 'subject' | 'heading' | 'additionalContent'>
> = {
  new_order_admin: {
    subject: 'New order #{order_number} on {site_title}',
    heading: 'New order from {customer_name}',
    additionalContent:
      'You have received the following order from {customer_name}. Review it in the admin and get it ready to ship.',
  },
  cancelled_order_admin: {
    subject: 'Order #{order_number} cancelled',
    heading: 'Order cancelled',
    additionalContent: '{customer_name} has cancelled order #{order_number}.',
  },
  failed_order_admin: {
    subject: 'Order #{order_number} pending payment',
    heading: 'Payment is pending',
    additionalContent:
      'Order #{order_number} is waiting for the shopper to complete payment. Check manually if this sits for longer than expected.',
  },
  processing_order: {
    subject: 'Your {site_title} order #{order_number}',
    heading: 'Thanks for your order!',
    additionalContent:
      'Hi {customer_name}, thanks for shopping with us. We have received your order and are getting it ready.',
  },
  completed_order: {
    subject: 'Your {site_title} order has shipped',
    heading: 'Your order is on its way',
    additionalContent:
      'Hi {customer_name}, order #{order_number} has been delivered. We hope you love it — reviews always welcome.',
  },
  refunded_order: {
    subject: 'Your {site_title} refund for order #{order_number}',
    heading: 'Refund processed',
    additionalContent:
      'Hi {customer_name}, a refund for order #{order_number} ({order_total}) has been issued. It may take a few business days to appear on your statement.',
  },
  customer_note: {
    subject: 'A note on your {site_title} order #{order_number}',
    heading: 'A quick update on your order',
    additionalContent:
      'Hi {customer_name}, we added a note to your order. You can view it any time from your account.',
  },
  new_account: {
    subject: 'Welcome to {site_title}',
    heading: 'Thanks for joining {site_title}, {customer_name}',
    additionalContent:
      'You can now track orders, save addresses, and collect loyalty rewards from your account.',
  },
  new_contact_admin: {
    subject: 'New contact message on {site_title}',
    heading: 'Someone just reached out',
    additionalContent:
      '{contact_name} <{contact_email}> sent a message via the contact form.\n\nSubject: {contact_subject}\n\n{contact_message}',
  },
  contact_autoreply: {
    subject: "We got your message — thanks!",
    heading: 'Thanks for reaching out, {contact_name}',
    additionalContent:
      'We received your message about "{contact_subject}" and will get back to you as soon as we can.',
  },
};

function docToTemplate(snap: QueryDocumentSnapshot | DocumentSnapshot): EmailTemplate {
  const data = snap.data()!;
  const key = (data.key ?? snap.id) as EmailTemplateKey;
  return {
    id: key,
    key,
    enabled: data.enabled ?? true,
    subject: data.subject ?? '',
    heading: data.heading ?? '',
    additionalContent: data.additionalContent ?? '',
    recipients: Array.isArray(data.recipients) ? (data.recipients as string[]) : [],
    audience: (data.audience as EmailAudience) ?? EMAIL_TEMPLATE_AUDIENCE[key] ?? 'customer',
    updatedAt: data.updatedAt,
  };
}

/**
 * Return an `EmailTemplate` for every key, hydrating any missing docs from
 * `DEFAULT_TEMPLATES` so the admin list always shows 8 rows even on first run.
 * Unsaved defaults carry `updatedAt: null as unknown as Timestamp` so the admin
 * UI can detect them and hint "not yet saved".
 */
export async function listEmailTemplates(db: Firestore): Promise<EmailTemplate[]> {
  const snap = await getDocs(caspianCollections(db).emailTemplates);
  const byKey = new Map<EmailTemplateKey, EmailTemplate>();
  for (const d of snap.docs) {
    const t = docToTemplate(d);
    byKey.set(t.key, t);
  }
  return EMAIL_TEMPLATE_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const defaults = DEFAULT_TEMPLATES[key];
    return {
      id: key,
      key,
      enabled: true,
      subject: defaults.subject,
      heading: defaults.heading,
      additionalContent: defaults.additionalContent,
      recipients: [],
      audience: EMAIL_TEMPLATE_AUDIENCE[key],
      // Sentinel — admin UI treats this as "never saved".
      updatedAt: null as unknown as Timestamp,
    };
  });
}

export interface SaveEmailTemplateInput {
  key: EmailTemplateKey;
  enabled: boolean;
  subject: string;
  heading: string;
  additionalContent: string;
  recipients: string[];
}

export async function saveEmailTemplate(
  db: Firestore,
  input: SaveEmailTemplateInput,
): Promise<void> {
  await setDoc(
    doc(db, 'emailTemplates', input.key),
    stripUndefined({
      key: input.key,
      audience: EMAIL_TEMPLATE_AUDIENCE[input.key],
      enabled: input.enabled,
      subject: input.subject,
      heading: input.heading,
      additionalContent: input.additionalContent,
      recipients: input.recipients,
      updatedAt: Timestamp.now(),
    }),
  );
}

export async function getEmailSettings(db: Firestore): Promise<EmailSettings | null> {
  const snap = await getDoc(doc(db, 'emailSettings', 'site'));
  if (!snap.exists()) return null;
  return snap.data() as EmailSettings;
}

export const DEFAULT_EMAIL_SETTINGS: Omit<EmailSettings, 'updatedAt'> = {
  id: 'site',
  fromName: '',
  fromAddress: '',
  replyTo: '',
  logoUrl: '',
  accentColor: '#111111',
  backgroundColor: '#ffffff',
  footerText: '',
  enabled: false,
};

export async function saveEmailSettings(db: Firestore, input: EmailSettings): Promise<void> {
  await setDoc(
    doc(db, 'emailSettings', 'site'),
    stripUndefined({ ...input, updatedAt: Timestamp.now() }),
  );
}

export interface SendTestEmailInput {
  /** The template key to render. */
  key: EmailTemplateKey;
  /** Recipient to send the test to. Usually the admin's own inbox. */
  to: string;
}

/**
 * Invoke the `sendTestEmail` Cloud Function (deployed from `functions-admin`)
 * to render the given template with sample placeholders and deliver it via
 * the configured provider. The admin UI wires this to a "Send test" button.
 */
export async function sendTestEmail(
  functions: Functions,
  input: SendTestEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const callable = httpsCallable<SendTestEmailInput, { ok: true } | { ok: false; error: string }>(
    functions,
    'sendTestEmail',
  );
  try {
    const result = await callable(input);
    return result.data;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Test send failed.' };
  }
}
