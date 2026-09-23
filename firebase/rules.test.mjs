/**
 * Firestore-rules behavior tests.
 *
 * Catches the class of bug that hit v1.13.0 (storage.rules grammar) and
 * v1.15.0 (users/{uid} first-create silently denied) — regressions that
 * only surface at `firebase deploy` time on a consumer machine. Running
 * this suite on every PR that touches firebase/*.rules fails early.
 *
 * Local run:
 *   cd firebase && firebase emulators:exec --only firestore,storage \
 *     "node --test ../firebase/rules.test.mjs"
 *
 * npm run test does the same via the scripts entry in package.json.
 */

import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'caspian-rules-test',
    firestore: {
      rules: readFileSync(join(__dirname, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(join(__dirname, 'storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

after(async () => {
  if (env) await env.cleanup();
});

// Seed an admin user through a rules-bypassing context so subsequent assertions
// can distinguish "no admin exists" from "admin exists" branches in rules.
async function seedAdmin(uid) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      email: `${uid}@test.example`,
      role: 'admin',
      addresses: [],
      wishlist: [],
    });
  });
}

function authed(uid) {
  return env.authenticatedContext(uid).firestore();
}

function unauthed() {
  return env.unauthenticatedContext().firestore();
}

function authedStorage(uid) {
  return env.authenticatedContext(uid).storage();
}

// v8.6.0: storage.rules `isAdmin()` short-circuits on the `role: 'admin'`
// custom claim before falling back to a cross-service Firestore read. The
// rules-unit-testing sandbox can't wire the cross-service read (see comment
// above the siteSettings/** block) but `authenticatedContext` accepts
// arbitrary token claims via its second arg — so the claim path IS testable.
function adminClaimStorage(uid) {
  return env.authenticatedContext(uid, { role: 'admin' }).storage();
}

function unauthedStorage() {
  return env.unauthenticatedContext().storage();
}

// Tiny 1x1 PNG — valid image bytes for rules that check contentType but don't
// inspect the blob. 70 bytes, well under any size cap.
const PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

// ---- users/{uid} ------------------------------------------------------

test('users/{uid}: auth user can create their own profile with role=customer', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertSucceeds(
    setDoc(doc(db, 'users', 'alice'), {
      email: 'alice@test.example',
      role: 'customer',
      addresses: [],
      wishlist: [],
    }),
  );
});

test('users/{uid}: auth user can create their own profile with role omitted', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertSucceeds(
    setDoc(doc(db, 'users', 'alice'), {
      email: 'alice@test.example',
      addresses: [],
    }),
  );
});

test('users/{uid}: auth user CANNOT self-create with role=admin', async () => {
  await env.clearFirestore();
  const db = authed('mallory');
  await assertFails(
    setDoc(doc(db, 'users', 'mallory'), {
      email: 'mallory@test.example',
      role: 'admin',
    }),
  );
});

test('users/{uid}: auth user CANNOT create another user\'s profile', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    setDoc(doc(db, 'users', 'bob'), { email: 'bob@test.example', role: 'customer' }),
  );
});

test('users/{uid}: auth user can update non-role fields on own doc', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), {
      email: 'alice@test.example',
      role: 'customer',
      displayName: 'Alice',
    });
  });
  const db = authed('alice');
  await assertSucceeds(updateDoc(doc(db, 'users', 'alice'), { displayName: 'Alice Updated' }));
});

test('users/{uid}: auth user CANNOT self-promote to admin via update', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), {
      email: 'alice@test.example',
      role: 'customer',
    });
  });
  const db = authed('alice');
  await assertFails(updateDoc(doc(db, 'users', 'alice'), { role: 'admin' }));
});

test('users/{uid}: unauthenticated read denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), { email: 'alice@test.example' });
  });
  await assertFails(getDoc(doc(unauthed(), 'users', 'alice')));
});

test('users/{uid}: auth user can read own profile', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), { email: 'alice@test.example' });
  });
  await assertSucceeds(getDoc(doc(authed('alice'), 'users', 'alice')));
});

test('users/{uid}: auth user can delete their own profile ("Delete my account")', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), {
      email: 'alice@test.example',
      role: 'customer',
    });
  });
  await assertSucceeds(deleteDoc(doc(authed('alice'), 'users', 'alice')));
});

test('users/{uid}: auth user CANNOT delete another user\'s profile', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'bob'), {
      email: 'bob@test.example',
      role: 'customer',
    });
  });
  await assertFails(deleteDoc(doc(authed('alice'), 'users', 'bob')));
  await assertFails(deleteDoc(doc(unauthed(), 'users', 'bob')));
});

// ---- products/{id} ----------------------------------------------------

test('products/{id}: public read allowed', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'products', 'p1'), { name: 'Test' });
  });
  await assertSucceeds(getDoc(doc(unauthed(), 'products', 'p1')));
});

test('products/{id}: non-admin write denied', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(setDoc(doc(db, 'products', 'p1'), { name: 'Test', price: 10 }));
});

test('products/{id}: admin write allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  const db = authed('admin1');
  await assertSucceeds(setDoc(doc(db, 'products', 'p1'), { name: 'Test', price: 10 }));
});

// ---- orders/{id} ------------------------------------------------------

// The only legitimate client-side order writer is the manual-payment path
// (src/payments/plugins/manual-base.ts): own uid, `on-hold`, a manual
// payment method, a non-empty items list, no `channel`. Everything else is
// written by Cloud Functions through the Admin SDK, so the create rule pins
// this exact shape — a signed-in (or anonymous) session must not be able to
// write itself a `paid` order.
const VALID_MANUAL_ORDER = (userId) => ({
  userId,
  userEmail: 'alice@test.example',
  status: 'on-hold',
  items: [
    {
      productId: 'p1',
      name: 'Tee',
      brand: '',
      price: 20,
      quantity: 2,
      selectedSize: null,
      selectedColor: null,
      imageUrl: '',
    },
  ],
  shippingInfo: {
    name: 'Alice',
    address: '1 Main St',
    city: 'Baku',
    zip: 'AZ1000',
    country: 'AZ',
    shippingMethod: 'Standard',
  },
  payment: { stripeSessionId: '', last4: '', brand: '', amount: 45, method: 'bacs' },
  subtotal: 40,
  shippingCost: 5,
  discount: 0,
  promoCode: null,
  tax: 0,
  total: 45,
  createdAt: serverTimestamp(),
});

test('orders/{id}: auth user can create their own on-hold manual-payment order', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertSucceeds(addDoc(collection(db, 'orders'), VALID_MANUAL_ORDER('alice')));
});

test('orders/{id}: every manual method (bacs, cheque, cod) is accepted', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  for (const method of ['bacs', 'cheque', 'cod']) {
    const order = VALID_MANUAL_ORDER('alice');
    order.payment.method = method;
    await assertSucceeds(addDoc(collection(db, 'orders'), order));
  }
});

test('orders/{id}: create rejected when userId is not the caller', async () => {
  await env.clearFirestore();
  const db = authed('mallory');
  await assertFails(addDoc(collection(db, 'orders'), VALID_MANUAL_ORDER('alice')));
});

test('orders/{id}: create rejected with status=paid', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'orders'), { ...VALID_MANUAL_ORDER('alice'), status: 'paid' }),
  );
});

test('orders/{id}: create rejected with payment.method=stripe', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  const order = VALID_MANUAL_ORDER('alice');
  order.payment.method = 'stripe';
  await assertFails(addDoc(collection(db, 'orders'), order));
});

test('orders/{id}: create rejected when payment.method is absent', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  const order = VALID_MANUAL_ORDER('alice');
  delete order.payment.method;
  await assertFails(addDoc(collection(db, 'orders'), order));
});

test('orders/{id}: create rejected with an empty items list', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'orders'), { ...VALID_MANUAL_ORDER('alice'), items: [] }),
  );
});

test('orders/{id}: create rejected when it claims a POS channel', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'orders'), { ...VALID_MANUAL_ORDER('alice'), channel: 'pos' }),
  );
});

test('orders/{id}: create rejected with a negative total', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'orders'), { ...VALID_MANUAL_ORDER('alice'), total: -1 }),
  );
});

test('orders/{id}: unauthenticated create denied', async () => {
  await env.clearFirestore();
  await assertFails(addDoc(collection(unauthed(), 'orders'), VALID_MANUAL_ORDER('alice')));
});

test('orders/{id}: owner cannot update their own order (admin only)', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orders', 'o1'), VALID_MANUAL_ORDER('alice'));
  });
  await assertFails(updateDoc(doc(authed('alice'), 'orders', 'o1'), { status: 'paid' }));
});

// ---- pendingCheckouts / stripeEvents (server-only) ----------------------

test('pendingCheckouts/{id}: nobody reads or writes, not even admins', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'pendingCheckouts', 'pc1'), { userId: 'alice' });
  });
  await assertFails(getDoc(doc(authed('alice'), 'pendingCheckouts', 'pc1')));
  await assertFails(getDoc(doc(authed('admin1'), 'pendingCheckouts', 'pc1')));
  await assertFails(setDoc(doc(authed('alice'), 'pendingCheckouts', 'pc2'), { userId: 'alice' }));
  await assertFails(setDoc(doc(authed('admin1'), 'pendingCheckouts', 'pc2'), { userId: 'alice' }));
});

test('stripeEvents/{id}: nobody reads or writes, not even admins', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'stripeEvents', 'evt_1'), { sessionId: 'cs_1' });
  });
  await assertFails(getDoc(doc(authed('alice'), 'stripeEvents', 'evt_1')));
  await assertFails(getDoc(doc(authed('admin1'), 'stripeEvents', 'evt_1')));
  await assertFails(setDoc(doc(authed('admin1'), 'stripeEvents', 'evt_2'), { sessionId: 'cs_2' }));
});

test('orders/{id}: auth user CANNOT read another user\'s order', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orders', 'o1'), { userId: 'bob', total: 42 });
  });
  await assertFails(getDoc(doc(authed('alice'), 'orders', 'o1')));
});

test('orders/{id}: admin can read any order', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orders', 'o1'), { userId: 'bob', total: 42 });
  });
  await assertSucceeds(getDoc(doc(authed('admin1'), 'orders', 'o1')));
});

// ---- reviews/{id} -----------------------------------------------------

test('reviews/{id}: auth user can create with status=pending and valid rating', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertSucceeds(
    addDoc(collection(db, 'reviews'), {
      userId: 'alice',
      productId: 'p1',
      status: 'pending',
      rating: 5,
      body: 'great',
    }),
  );
});

test('reviews/{id}: auth user CANNOT create with status=approved (must be pending)', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'reviews'), {
      userId: 'alice',
      productId: 'p1',
      status: 'approved',
      rating: 5,
    }),
  );
});

test('reviews/{id}: rating out of [1,5] denied', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'reviews'), {
      userId: 'alice',
      productId: 'p1',
      status: 'pending',
      rating: 6,
    }),
  );
});

// The verified-purchase badge is stamped server-side (functions-admin
// `stampVerifiedPurchase`). A client may write `false` or omit the field;
// writing `true` would make the badge a free-text claim.
test('reviews/{id}: create with isVerifiedPurchase=false allowed', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertSucceeds(
    addDoc(collection(db, 'reviews'), {
      userId: 'alice',
      productId: 'p1',
      status: 'pending',
      rating: 4,
      text: 'fine',
      isVerifiedPurchase: false,
    }),
  );
});

test('reviews/{id}: create with isVerifiedPurchase=true denied', async () => {
  await env.clearFirestore();
  const db = authed('alice');
  await assertFails(
    addDoc(collection(db, 'reviews'), {
      userId: 'alice',
      productId: 'p1',
      status: 'pending',
      rating: 4,
      text: 'fine',
      isVerifiedPurchase: true,
    }),
  );
});

// ---- promoCodes/{id} --------------------------------------------------
// Shoppers never read this collection (the Stripe callable validates the
// code server-side; manual flows apply no discount), so `isAuth()` read only
// let anonymous sessions enumerate every live code. Staff + admin keep read.

test('promoCodes/{id}: anonymous / customer read denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'promoCodes', 'pc1'), {
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      isActive: true,
    });
  });
  await assertFails(getDoc(doc(unauthed(), 'promoCodes', 'pc1')));
  await assertFails(getDoc(doc(authed('alice'), 'promoCodes', 'pc1')));
});

test('promoCodes/{id}: staff and admin read allowed; customer write denied', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'promoCodes', 'pc1'), {
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      isActive: true,
    });
  });
  await assertSucceeds(getDoc(doc(staffClaim('cashier1'), 'promoCodes', 'pc1')));
  await assertSucceeds(getDoc(doc(authed('admin1'), 'promoCodes', 'pc1')));
  await assertFails(
    setDoc(doc(authed('alice'), 'promoCodes', 'pc2'), { code: 'FREE', type: 'fixed', value: 999 }),
  );
});

// ---- subscribers/{id} -------------------------------------------------
// Public create with a strict shape (doc id = encodeURIComponent(email), so
// the id can't be compared to the field). A second write to the same id is
// an update, which is denied — the client's "already subscribed" signal.

test('subscribers/{id}: unauthenticated create allowed with valid shape', async () => {
  await env.clearFirestore();
  await assertSucceeds(
    setDoc(doc(unauthed(), 'subscribers', encodeURIComponent('jane@example.com')), {
      email: 'jane@example.com',
      subscribedAt: serverTimestamp(),
    }),
  );
});

test('subscribers/{id}: create rejected with extra fields', async () => {
  await env.clearFirestore();
  await assertFails(
    setDoc(doc(unauthed(), 'subscribers', encodeURIComponent('jane@example.com')), {
      email: 'jane@example.com',
      subscribedAt: serverTimestamp(),
      role: 'admin',
    }),
  );
});

test('subscribers/{id}: create rejected when email is not a string or is oversize', async () => {
  await env.clearFirestore();
  await assertFails(
    setDoc(doc(unauthed(), 'subscribers', 'x1'), { email: 42, subscribedAt: serverTimestamp() }),
  );
  await assertFails(
    setDoc(doc(unauthed(), 'subscribers', 'x2'), {
      email: 'a'.repeat(321),
      subscribedAt: serverTimestamp(),
    }),
  );
});

test('subscribers/{id}: second signup for the same address is denied (update)', async () => {
  await env.clearFirestore();
  const id = encodeURIComponent('jane@example.com');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'subscribers', id), {
      email: 'jane@example.com',
      subscribedAt: serverTimestamp(),
    });
  });
  await assertFails(
    setDoc(doc(unauthed(), 'subscribers', id), {
      email: 'jane@example.com',
      subscribedAt: serverTimestamp(),
    }),
  );
});

test('subscribers/{id}: non-admin read denied, admin read allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  const id = encodeURIComponent('jane@example.com');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'subscribers', id), {
      email: 'jane@example.com',
      subscribedAt: serverTimestamp(),
    });
  });
  await assertFails(getDoc(doc(authed('alice'), 'subscribers', id)));
  await assertSucceeds(getDoc(doc(authed('admin1'), 'subscribers', id)));
});

// ---- searchTerms/{id} -------------------------------------------------
// Public upsert, but one search = exactly one increment, and only `count`
// and `lastSearchedAt` may change on update.

const SEED_SEARCH_TERM = {
  term: 'shoes',
  count: 3,
  firstSearchedAt: serverTimestamp(),
  lastSearchedAt: serverTimestamp(),
};

test('searchTerms/{id}: create with count=1 allowed; count=5 denied', async () => {
  await env.clearFirestore();
  await assertSucceeds(
    setDoc(doc(unauthed(), 'searchTerms', 'shoes'), { ...SEED_SEARCH_TERM, count: 1 }),
  );
  await assertFails(
    setDoc(doc(unauthed(), 'searchTerms', 'boots'), { ...SEED_SEARCH_TERM, term: 'boots', count: 5 }),
  );
});

test('searchTerms/{id}: update by exactly +1 allowed', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'searchTerms', 'shoes'), SEED_SEARCH_TERM);
  });
  await assertSucceeds(
    updateDoc(doc(unauthed(), 'searchTerms', 'shoes'), {
      count: increment(1),
      lastSearchedAt: serverTimestamp(),
    }),
  );
});

test('searchTerms/{id}: update by more than +1 denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'searchTerms', 'shoes'), SEED_SEARCH_TERM);
  });
  await assertFails(
    updateDoc(doc(unauthed(), 'searchTerms', 'shoes'), {
      count: 1000,
      lastSearchedAt: serverTimestamp(),
    }),
  );
});

test('searchTerms/{id}: update touching other fields denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'searchTerms', 'shoes'), SEED_SEARCH_TERM);
  });
  await assertFails(
    updateDoc(doc(unauthed(), 'searchTerms', 'shoes'), {
      count: increment(1),
      lastSearchedAt: serverTimestamp(),
      term: 'hijacked',
    }),
  );
});

// ---- adminTodos/{id} --------------------------------------------------

test('adminTodos/{id}: non-admin read denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'adminTodos', 't1'), { title: 'Seed' });
  });
  await assertFails(getDoc(doc(authed('alice'), 'adminTodos', 't1')));
});

test('adminTodos/{id}: admin read allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'adminTodos', 't1'), { title: 'Seed' });
  });
  await assertSucceeds(getDoc(doc(authed('admin1'), 'adminTodos', 't1')));
});

test('adminTodos/{id}: admin write allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  const db = authed('admin1');
  await assertSucceeds(setDoc(doc(db, 'adminTodos', 't1'), { title: 'New', done: false }));
});

// ---- contacts/{id} ----------------------------------------------------
// Public contact-form submissions (v2.13). Create is open to unauthenticated
// visitors (subscribers-style); read/update/delete are admin-only.

test('contacts/{id}: unauthenticated create allowed with valid shape', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertSucceeds(
    addDoc(collection(db, 'contacts'), {
      name: 'Jane',
      email: 'jane@example.com',
      subject: 'Hello',
      message: 'Quick question about shipping.',
      status: 'new',
      createdAt: serverTimestamp(),
    }),
  );
});

test('contacts/{id}: create rejected when status != new', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    addDoc(collection(db, 'contacts'), {
      name: 'Jane',
      email: 'jane@example.com',
      message: 'Hi',
      status: 'read',
      createdAt: serverTimestamp(),
    }),
  );
});

test('contacts/{id}: create rejected when message too long', async () => {
  await env.clearFirestore();
  const db = unauthed();
  const huge = 'x'.repeat(5001);
  await assertFails(
    addDoc(collection(db, 'contacts'), {
      name: 'Jane',
      email: 'jane@example.com',
      message: huge,
      status: 'new',
      createdAt: serverTimestamp(),
    }),
  );
});

test('contacts/{id}: create rejected with empty name', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    addDoc(collection(db, 'contacts'), {
      name: '',
      email: 'jane@example.com',
      message: 'Hi',
      status: 'new',
      createdAt: serverTimestamp(),
    }),
  );
});

test('contacts/{id}: non-admin read denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'contacts', 'c1'), {
      name: 'Jane',
      email: 'jane@example.com',
      message: 'Hi',
      status: 'new',
    });
  });
  await assertFails(getDoc(doc(authed('alice'), 'contacts', 'c1')));
});

test('contacts/{id}: admin read allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'contacts', 'c1'), {
      name: 'Jane',
      email: 'jane@example.com',
      message: 'Hi',
      status: 'new',
    });
  });
  await assertSucceeds(getDoc(doc(authed('admin1'), 'contacts', 'c1')));
});

test('contacts/{id}: admin update status allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'contacts', 'c1'), {
      name: 'Jane',
      email: 'jane@example.com',
      message: 'Hi',
      status: 'new',
    });
  });
  await assertSucceeds(
    updateDoc(doc(authed('admin1'), 'contacts', 'c1'), { status: 'read' }),
  );
});

// ---- errorLogs/{id} ---------------------------------------------------
// Self-healing error logs (mod1182). Open create with a strict shape gate
// (crashes happen in unauth shopper sessions too); admin-only everything else.

const VALID_ERROR_DOC = {
  source: 'client',
  origin: 'ErrorBoundary',
  message: 'TypeError: foo is undefined',
  libraryVersion: '2.16.0',
  seenCount: 1,
  timestamp: serverTimestamp(),
  lastSeenAt: serverTimestamp(),
};

test('errorLogs/{id}: unauthenticated create allowed with valid shape', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertSucceeds(addDoc(collection(db, 'errorLogs'), { ...VALID_ERROR_DOC }));
});

test('errorLogs/{id}: create rejected when source is unknown', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    addDoc(collection(db, 'errorLogs'), { ...VALID_ERROR_DOC, source: 'bogus' }),
  );
});

test('errorLogs/{id}: create rejected when stack oversize', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    addDoc(collection(db, 'errorLogs'), {
      ...VALID_ERROR_DOC,
      stack: 'x'.repeat(4001),
    }),
  );
});

test('errorLogs/{id}: create rejected when seenCount != 1', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    addDoc(collection(db, 'errorLogs'), { ...VALID_ERROR_DOC, seenCount: 5 }),
  );
});

test('errorLogs/{id}: non-admin read denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'errorLogs', 'e1'), { ...VALID_ERROR_DOC });
  });
  await assertFails(getDoc(doc(authed('alice'), 'errorLogs', 'e1')));
});

test('errorLogs/{id}: admin read allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'errorLogs', 'e1'), { ...VALID_ERROR_DOC });
  });
  await assertSucceeds(getDoc(doc(authed('admin1'), 'errorLogs', 'e1')));
});

test('errorLogs/{id}: non-admin cannot bump seenCount', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'errorLogs', 'e1'), { ...VALID_ERROR_DOC });
  });
  await assertFails(
    updateDoc(doc(authed('alice'), 'errorLogs', 'e1'), { seenCount: 2 }),
  );
});

test('errorLogs/{id}: admin can bump seenCount', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'errorLogs', 'e1'), { ...VALID_ERROR_DOC });
  });
  await assertSucceeds(
    updateDoc(doc(authed('admin1'), 'errorLogs', 'e1'), { seenCount: 2 }),
  );
});

// ---- pendingSuperAdmin/{email} (v8.7.0) -----------------------------
// Setup-wizard email allowlist for the very first admin. Doc id is the
// lowercase email; the wizard writes pre-install (unauthenticated) and
// `onUserCreate` consumes the entry on signup. Server-side trigger
// bypasses rules via Admin SDK, so the rules-level test focuses on
// wizard-time access patterns.

const VALID_PENDING_DOC = (email) => ({
  email,
  designatedAt: serverTimestamp(),
});

test('pendingSuperAdmin/{email}: unauthenticated create allowed with valid shape', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertSucceeds(
    setDoc(
      doc(db, 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('admin@example.com'),
    ),
  );
});

test('pendingSuperAdmin/{email}: create rejected when email field !== doc id', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    setDoc(
      doc(db, 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('different@example.com'),
    ),
  );
});

test('pendingSuperAdmin/{email}: create rejected with extra fields', async () => {
  await env.clearFirestore();
  const db = unauthed();
  await assertFails(
    setDoc(doc(db, 'pendingSuperAdmin', 'admin@example.com'), {
      email: 'admin@example.com',
      designatedAt: serverTimestamp(),
      role: 'admin',
    }),
  );
});

test('pendingSuperAdmin/{email}: re-create rejected when doc already exists', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('admin@example.com'),
    );
  });
  const db = unauthed();
  await assertFails(
    setDoc(
      doc(db, 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('admin@example.com'),
    ),
  );
});

test('pendingSuperAdmin/{email}: public read allowed', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('admin@example.com'),
    );
  });
  await assertSucceeds(getDoc(doc(unauthed(), 'pendingSuperAdmin', 'admin@example.com')));
});

test('pendingSuperAdmin/{email}: non-admin delete denied', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('admin@example.com'),
    );
  });
  const db = authed('alice');
  await assertFails(deleteDoc(doc(db, 'pendingSuperAdmin', 'admin@example.com')));
});

test('pendingSuperAdmin/{email}: admin delete allowed', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'pendingSuperAdmin', 'admin@example.com'),
      VALID_PENDING_DOC('admin@example.com'),
    );
  });
  await assertSucceeds(
    deleteDoc(doc(authed('admin1'), 'pendingSuperAdmin', 'admin@example.com')),
  );
});

// ---- storage: siteSettings/** ----------------------------------------
// Branding uploads (logo + favicon) from <AdminSiteSettingsPage>. Added v1.21.
//
// Limitation (Firestore fallback): `isAdmin()` in storage.rules first checks
// the `role: 'admin'` Auth custom claim and only falls back to
// `firestore.get(...)` when the claim is absent. The rules-unit-testing
// sandbox does not wire storage→Firestore reads, so the FALLBACK path is
// only verified manually in the example app. The CLAIM path (the primary
// admin signal since v8.5.1) IS covered here via `adminClaimStorage()` —
// see the "admin (custom claim) write allowed" test in each rule's block
// below.

test('storage siteSettings/**: unauthenticated write denied', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = unauthedStorage();
  await assertFails(
    uploadBytes(storageRef(storage, 'siteSettings/logo.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage siteSettings/**: non-admin write denied', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = authedStorage('alice');
  await assertFails(
    uploadBytes(storageRef(storage, 'siteSettings/logo.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage siteSettings/**: disallowed content-type denied', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedAdmin('admin1');
  const storage = authedStorage('admin1');
  const bytes = new TextEncoder().encode('<html></html>');
  await assertFails(
    uploadBytes(storageRef(storage, 'siteSettings/logo.html'), bytes, {
      contentType: 'text/html',
    }),
  );
});

test('storage siteSettings/**: public read allowed', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(
      storageRef(ctx.storage(), 'siteSettings/logo.png'),
      PNG_1x1,
      { contentType: 'image/png' },
    );
  });
  const publicStorage = unauthedStorage();
  await assertSucceeds(
    getDownloadURL(storageRef(publicStorage, 'siteSettings/logo.png')),
  );
});

// ---- storage: products/** --------------------------------------------
// Product catalog uploads from <AdminProductEditor>. Added v1.22. Same
// cross-service limitation as siteSettings — see comment above that block.

test('storage products/**: unauthenticated write denied', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = unauthedStorage();
  await assertFails(
    uploadBytes(storageRef(storage, 'products/p1/hero.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage products/**: non-admin write denied', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = authedStorage('alice');
  await assertFails(
    uploadBytes(storageRef(storage, 'products/p1/hero.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage products/**: SVG upload denied (product photos should be raster)', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedAdmin('admin1');
  const storage = authedStorage('admin1');
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  await assertFails(
    uploadBytes(storageRef(storage, 'products/p1/hero.svg'), svg, {
      contentType: 'image/svg+xml',
    }),
  );
});

test('storage products/**: public read allowed', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(
      storageRef(ctx.storage(), 'products/p1/hero.png'),
      PNG_1x1,
      { contentType: 'image/png' },
    );
  });
  const publicStorage = unauthedStorage();
  await assertSucceeds(
    getDownloadURL(storageRef(publicStorage, 'products/p1/hero.png')),
  );
});

// ---- storage: admin custom-claim write paths ------------------------
// v8.6.0: positive coverage for the admin-claim short-circuit in
// `isAdmin()`. Each test uploads a valid image as a user whose token
// carries `role: 'admin'` — exercising the JWT path and bypassing the
// untestable Firestore-fallback path.

test('storage siteSettings/**: admin (custom claim) write allowed', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = adminClaimStorage('admin1');
  await assertSucceeds(
    uploadBytes(storageRef(storage, 'siteSettings/logo.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage products/**: admin (custom claim) write allowed', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = adminClaimStorage('admin1');
  await assertSucceeds(
    uploadBytes(storageRef(storage, 'products/p1/hero.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage journal/**: admin (custom claim) write allowed', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = adminClaimStorage('admin1');
  await assertSucceeds(
    uploadBytes(storageRef(storage, 'journal/post1/cover.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

test('storage pageContents/**: admin (custom claim) write allowed', async () => {
  await env.clearFirestore();
  await env.clearStorage();
  const storage = adminClaimStorage('admin1');
  await assertSucceeds(
    uploadBytes(storageRef(storage, 'pageContents/about/hero.png'), PNG_1x1, {
      contentType: 'image/png',
    }),
  );
});

// --- Point of sale: the `staff` role (v10.0.0) ---
//
// `isStaff()` mirrors `isAdmin()`: the Auth custom claim is the fast path and a
// Firestore document read is the fallback. Both paths are exercised below —
// `staffClaim()` for the claim, `seedStaff()` + `authed()` for the document —
// because a cashier promoted before their token rotated relies on the second
// one, and it is the path most likely to rot unnoticed.

async function seedStaff(uid) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      email: `${uid}@test.example`,
      role: 'staff',
      addresses: [],
      wishlist: [],
    });
  });
}

function staffClaim(uid) {
  return env.authenticatedContext(uid, { role: 'staff' }).firestore();
}

test('posSessions: staff (Firestore role) can read', async () => {
  await env.clearFirestore();
  await seedStaff('cashier1');
  await assertSucceeds(getDoc(doc(authed('cashier1'), 'posSessions', 'shift1')));
});

test('posSessions: staff (custom claim) can read', async () => {
  await env.clearFirestore();
  await assertSucceeds(getDoc(doc(staffClaim('cashier1'), 'posSessions', 'shift1')));
});

test('posSessions: customer cannot read', async () => {
  await env.clearFirestore();
  await assertFails(getDoc(doc(authed('bob'), 'posSessions', 'shift1')));
});

test('posSessions: even staff cannot write — Cloud Functions own this', async () => {
  await env.clearFirestore();
  await seedStaff('cashier1');
  // The whole point: a cashier must not be able to edit `expectedCash` and
  // paper over a drawer variance at close.
  await assertFails(
    setDoc(doc(authed('cashier1'), 'posSessions', 'shift1'), { cashierId: 'cashier1' }),
  );
});

test('posSessions: admin cannot write either', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await assertFails(
    setDoc(doc(authed('admin1'), 'posSessions', 'shift1'), { expectedCash: 0 }),
  );
});

test('posCounters: nobody reads or writes the receipt counter', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await assertFails(getDoc(doc(authed('admin1'), 'posCounters', 'receipt')));
  await assertFails(setDoc(doc(authed('admin1'), 'posCounters', 'receipt'), { value: 999 }));
});

test('posLicenses: server-only on both sides', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  await assertFails(getDoc(doc(authed('admin1'), 'posLicenses', 'lic1')));
  await assertFails(setDoc(doc(authed('admin1'), 'posLicenses', 'lic1'), { deviceId: 'x' }));
});

test('posDevices: staff read, admin write, customer denied', async () => {
  await env.clearFirestore();
  await seedStaff('cashier1');
  await seedAdmin('admin1');
  await assertSucceeds(getDoc(doc(authed('cashier1'), 'posDevices', 'till1')));
  await assertFails(setDoc(doc(authed('cashier1'), 'posDevices', 'till1'), { label: 'Front' }));
  await assertSucceeds(setDoc(doc(authed('admin1'), 'posDevices', 'till1'), { label: 'Front' }));
  await assertFails(getDoc(doc(authed('bob'), 'posDevices', 'till1')));
});

test('staff can read the catalog but cannot write products or settings', async () => {
  await env.clearFirestore();
  await seedStaff('cashier1');
  const db = authed('cashier1');
  await assertSucceeds(getDoc(doc(db, 'products', 'p1')));
  // Staff sell; they do not re-price. Everything admin stays shut.
  await assertFails(setDoc(doc(db, 'products', 'p1'), { name: 'Tampered', price: 1 }));
  await assertFails(setDoc(doc(db, 'settings', 'site'), { brandName: 'Nope' }));
  await assertFails(setDoc(doc(db, 'scriptSettings', 'site'), { brandName: 'Nope' }));
});

test('staff cannot self-promote to admin', async () => {
  await env.clearFirestore();
  await seedStaff('cashier1');
  await assertFails(updateDoc(doc(authed('cashier1'), 'users', 'cashier1'), { role: 'admin' }));
});

// --- POS licences (v10.1.0) ---
//
// `posLicenses` carries the customer name for every licence sold, so it is
// server-only on BOTH sides. Admins reach it through the `listPosLicenses`
// callable instead, which keeps a compromised admin session from vacuuming the
// customer list out through the SDK.

test('posLicenses: staff cannot read or write', async () => {
  await env.clearFirestore();
  await seedStaff('cashier1');
  const db = authed('cashier1');
  await assertFails(getDoc(doc(db, 'posLicenses', 'lic1')));
  await assertFails(setDoc(doc(db, 'posLicenses', 'lic1'), { deviceId: 'x' }));
});

test('posLicenses: admin cannot read or write directly either', async () => {
  await env.clearFirestore();
  await seedAdmin('admin1');
  const db = authed('admin1');
  await assertFails(getDoc(doc(db, 'posLicenses', 'lic1')));
  await assertFails(setDoc(doc(db, 'posLicenses', 'lic1'), { name: 'Acme' }));
});

test('posLicenses: a signed-out visitor is denied', async () => {
  await env.clearFirestore();
  await assertFails(getDoc(doc(unauthed(), 'posLicenses', 'lic1')));
});
