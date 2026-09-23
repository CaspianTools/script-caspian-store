import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { AdminTodo } from '../types';
import { stripUndefined } from '../utils/strip-undefined';

function docToAdminTodo(snap: QueryDocumentSnapshot): AdminTodo {
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title,
    description: data.description,
    done: data.done ?? false,
    order: data.order ?? 0,
    isDefault: data.isDefault ?? false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listAdminTodos(db: Firestore): Promise<AdminTodo[]> {
  const q = query(caspianCollections(db).adminTodos, orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToAdminTodo);
}

/**
 * Live subscription to the `adminTodos` collection ordered by `order`.
 * `callback` fires on every Firestore snapshot with the current list (empty
 * array while the collection is empty). Returns an `Unsubscribe` — call it
 * on unmount.
 */
export function listenAdminTodos(
  db: Firestore,
  callback: (todos: AdminTodo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(caspianCollections(db).adminTodos, orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(docToAdminTodo)),
    (err) => onError?.(err),
  );
}

export interface AdminTodoWriteInput {
  title: string;
  description?: string;
  done?: boolean;
  order?: number;
  isDefault?: boolean;
}

export async function createAdminTodo(
  db: Firestore,
  input: AdminTodoWriteInput,
  id?: string,
): Promise<string> {
  const now = Timestamp.now();
  const payload = {
    title: input.title,
    description: input.description ?? '',
    done: input.done ?? false,
    order: input.order ?? 0,
    isDefault: input.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  };
  if (id) {
    await setDoc(doc(db, 'adminTodos', id), payload);
    return id;
  }
  const ref = await addDoc(caspianCollections(db).adminTodos, payload);
  return ref.id;
}

export async function updateAdminTodo(
  db: Firestore,
  id: string,
  input: Partial<AdminTodoWriteInput>,
): Promise<void> {
  await updateDoc(doc(db, 'adminTodos', id), stripUndefined({ ...input, updatedAt: Timestamp.now() }));
}

export async function deleteAdminTodo(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'adminTodos', id));
}

/**
 * The first-run setup checklist. Seeded into `adminTodos` the first time an
 * admin clicks "Seed setup checklist" on an empty list. Order matches the
 * sequence an admin should follow to get a fresh store production-ready.
 */
export const DEFAULT_ADMIN_TODOS: Array<{ id: string; title: string; description: string }> = [
  {
    id: 'deploy-firestore-rules',
    title: 'Deploy Firestore rules and indexes',
    description:
      'Copy `firebase/firestore.rules` and `firebase/firestore.indexes.json` from the package into your project root and run `firebase deploy --only firestore:rules,firestore:indexes`.',
  },
  {
    id: 'deploy-storage-rules',
    title: 'Deploy Storage rules',
    description:
      'Copy `firebase/storage.rules` from the package and run `firebase deploy --only storage`. Required for product-image and avatar uploads.',
  },
  {
    id: 'deploy-cloud-functions',
    title: 'Deploy Stripe Cloud Functions',
    description:
      'Copy `firebase/functions` into your project, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via `firebase functions:secrets:set`, then `firebase deploy --only functions:caspian-store`.',
  },
  {
    id: 'configure-stripe-webhook',
    title: 'Configure the Stripe webhook',
    description:
      'In Stripe → Webhooks, add an endpoint pointing at the deployed `stripeWebhook` URL and subscribe to `checkout.session.completed`. Paste the resulting `whsec_…` into the `STRIPE_WEBHOOK_SECRET` secret and redeploy.',
  },
  {
    id: 'grant-admin-role',
    title: 'Grant yourself admin role',
    description:
      'Sign up at `/register`, copy your Firebase Auth UID, then set `users/{uid}.role = "admin"` in Firestore (or run the seed script with `--admin <uid>`).',
  },
  {
    id: 'edit-site-settings',
    title: 'Edit site settings (brand, logo, favicon)',
    description:
      'Open /admin/settings and fill in brand name, brand description, logo URL, favicon URL, contact details, and social links.',
  },
  {
    id: 'activate-languages',
    title: 'Activate the languages you want to ship',
    description:
      'Open /admin/settings/languages and toggle `isActive` on the locales you plan to support. Only English is active by default.',
  },
  {
    id: 'seed-categories',
    title: 'Create at least one product category',
    description:
      'Open /admin/categories and add your top-level categories (parent/child supported). Products reference `category` by name or id.',
  },
  {
    id: 'seed-products',
    title: 'Create your first product',
    description:
      'Open /admin/products → New. Upload images, set name / price / description / category / sizes, and publish.',
  },
  {
    id: 'verify-shipping-plugins',
    title: 'Verify shipping plugins',
    description:
      'Open /admin/plugins?filter=shipping, open Settings on each switched-on shipping plugin and confirm the seeded flat-rate + free-over-threshold methods match your pricing. The checkout rate picker reads `shippingPluginInstalls` live.',
  },
  {
    id: 'edit-homepage-hero',
    title: 'Edit the homepage hero',
    description:
      'Open the Script settings editor and update the hero title / subtitle / CTA / image. The homepage reads from `scriptSettings/site.hero`.',
  },
  {
    id: 'pin-featured-categories',
    title: 'Mark a few categories and products as Featured',
    description:
      'Toggle `isFeatured` on 3–6 categories and ~8 products. The homepage renders them as Featured categories and Trending products.',
  },
];

/**
 * Idempotently writes the default first-run checklist to the `adminTodos`
 * collection. Skips any IDs that already exist. Returns the number of docs
 * that were actually written.
 */
export async function seedDefaultAdminTodos(db: Firestore): Promise<number> {
  const existing = await listAdminTodos(db);
  const have = new Set(existing.map((t) => t.id));
  const now = Timestamp.now();
  const batch = writeBatch(db);
  let written = 0;
  DEFAULT_ADMIN_TODOS.forEach((t, idx) => {
    if (have.has(t.id)) return;
    const ref = doc(db, 'adminTodos', t.id);
    batch.set(ref, {
      title: t.title,
      description: t.description,
      done: false,
      order: idx,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
    written++;
  });
  if (written > 0) await batch.commit();
  return written;
}
