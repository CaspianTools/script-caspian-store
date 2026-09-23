/**
 * `caspianHandleApi` — one Next.js route (`app/api/caspian-store/[...path]/route.ts`)
 * that serves everything the library otherwise needs Cloud Functions or the
 * Firebase CLI for:
 *
 *   GET  setup/status        which rules/indexes are installed (admin, or anyone before an admin exists)
 *   POST setup/install       publish rules + create indexes; on a store with no admin yet it also makes the caller admin
 *   POST call/<name>         the Cloud Functions callables (claimAdmin, setUserRole, createStripeCheckoutSession, …)
 *   POST stripe/webhook      Stripe's webhook (point the Stripe dashboard at /api/caspian-store/stripe/webhook)
 *   POST update              the /admin/about self-update (same as caspianHandleSelfUpdate)
 *
 * The callables run the *same source files* as firebase/functions-*: the
 * `./server` build aliases `firebase-functions` to ./functions-shim, so there
 * is one implementation whichever way a store runs. Runs on the host's own
 * credentials (admin-app.ts), which bypass security rules, so every route
 * checks the caller's Firebase ID token itself.
 *
 * Secrets come from the host environment: STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET (App Hosting: `firebase apphosting:secrets:set`).
 */

import type { CallableRequest, ShimCallable, ShimOnRequest, ShimResponse } from './functions-shim/https';
import { HttpsError } from './functions-shim/https';
import { getCaspianAdminApp } from './admin-app';
import { getFirebaseSetupStatus, installFirebaseSetup } from './firebase-setup';
import { caspianHandleSelfUpdate } from './self-update';
import { registerStripe } from './functions-shim/stripe';

type CallableLoader = () => Promise<ShimCallable>;

// Loaded on first use, so a store without `stripe` installed never evaluates
// the Stripe modules.
const CALLABLES: Record<string, CallableLoader> = {
  claimAdmin: async () =>
    (await import('../../firebase/functions-admin/src/claim-admin')).claimAdmin as unknown as ShimCallable,
  ensureAdminClaim: async () =>
    (await import('../../firebase/functions-admin/src/ensure-admin-claim')).ensureAdminClaim as unknown as ShimCallable,
  setUserRole: async () =>
    (await import('../../firebase/functions-admin/src/set-user-role')).setUserRole as unknown as ShimCallable,
  promoteUserToAdmin: async () =>
    (await import('../../firebase/functions-admin/src/promote-user-to-admin')).promoteUserToAdmin as unknown as ShimCallable,
  demoteAdminToCustomer: async () =>
    (await import('../../firebase/functions-admin/src/demote-admin-to-customer'))
      .demoteAdminToCustomer as unknown as ShimCallable,
  linkMyGuestOrders: async () =>
    (await import('../../firebase/functions-admin/src/link-guest-orders')).linkMyGuestOrders as unknown as ShimCallable,
  getGuestOrder: async () =>
    (await import('../../firebase/functions-admin/src/get-guest-order')).getGuestOrder as unknown as ShimCallable,
  createStripeCheckoutSession: async () =>
    (await import('../../firebase/functions-stripe/src/stripe-checkout'))
      .createStripeCheckoutSession as unknown as ShimCallable,
  getStripeSession: async () =>
    (await import('../../firebase/functions-stripe/src/stripe-session')).getStripeSession as unknown as ShimCallable,
};

/** Callable names the server API answers; the client routes these here when `serverApi` is set. */
export const CASPIAN_SERVER_CALLABLES = Object.keys(CALLABLES);

export interface CaspianHandleApiOptions {
  /**
   * The `stripe` package's default export (`import Stripe from 'stripe'`).
   * Needed only for card payments: checkout, session lookup and the webhook.
   */
  stripe?: unknown;
  /**
   * URL prefix the route is mounted at. Default `/api/caspian-store`; the
   * path after it selects the handler.
   */
  basePath?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof HttpsError) {
    return json({ error: { code: err.code, message: err.message, details: err.details } }, err.httpStatus);
  }
  // Like Cloud Functions: details stay in the server log, never in the response.
  console.error('[caspian-store] server API error:', err);
  return json({ error: { code: 'internal', message: 'Internal error' } }, 500);
}

type DecodedToken = Record<string, any> & { uid: string };

async function verifyCaller(req: Request): Promise<DecodedToken | null> {
  const header = req.headers.get('authorization') ?? '';
  const idToken = header.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) return null;
  await getCaspianAdminApp();
  const { getAuth } = await import('firebase-admin/auth');
  try {
    // checkRevoked: a demoted admin's refresh tokens are revoked, and this
    // makes their still-unexpired ID token stop working here too.
    return (await getAuth().verifyIdToken(idToken, true)) as DecodedToken;
  } catch {
    throw new HttpsError('unauthenticated', 'Your sign-in has expired. Reload the page and try again.');
  }
}

/** The profile's role is authoritative; a `role` claim can outlive a demotion by an hour. */
async function isAdmin(token: DecodedToken): Promise<boolean> {
  const { getFirestore } = await import('firebase-admin/firestore');
  const snap = await getFirestore().collection('users').doc(token.uid).get();
  return snap.exists && snap.get('role') === 'admin';
}

async function anyAdminExists(): Promise<boolean> {
  const { getFirestore } = await import('firebase-admin/firestore');
  const snap = await getFirestore().collection('users').where('role', '==', 'admin').limit(1).get();
  return !snap.empty;
}

/** Makes `token.uid` the store's admin (profile role + custom claim). */
async function promoteToAdmin(token: DecodedToken): Promise<void> {
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  const ref = getFirestore().collection('users').doc(token.uid);
  const snap = await ref.get();
  await ref.set(
    snap.exists
      ? { role: 'admin' }
      : {
          uid: token.uid,
          email: token.email ?? '',
          displayName: token.name ?? '',
          role: 'admin',
          createdAt: FieldValue.serverTimestamp(),
        },
    { merge: true },
  );
  const user = await getAuth().getUser(token.uid);
  await getAuth().setCustomUserClaims(token.uid, { ...(user.customClaims ?? {}), role: 'admin' });
}

/**
 * Setup routes are open to an admin, or — while the store has no admin at
 * all — to any signed-in user, who then becomes that admin. That is the same
 * first-come bootstrap the `claimAdmin` callable has always used.
 */
async function authorizeSetup(req: Request): Promise<{ token: DecodedToken; bootstrap: boolean }> {
  const token = await verifyCaller(req);
  if (!token) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Sign in with an account first.');
  }
  if (await isAdmin(token)) return { token, bootstrap: false };
  if (!(await anyAdminExists()) && (await claimBootstrapSlot(token.uid))) return { token, bootstrap: true };
  throw new HttpsError('permission-denied', 'Only an admin can change the store setup.');
}

/**
 * First-run lock. Installing takes seconds, and promotion only happens at
 * the end, so without this two sign-ins racing through that window would
 * both become admin. The first caller creates the doc; only that uid may
 * bootstrap afterwards (including a retry after a failed install). The
 * collection has no security rule, so clients can never read or write it.
 */
async function claimBootstrapSlot(uid: string): Promise<boolean> {
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const db = getFirestore();
  const ref = db.collection('caspianServer').doc('bootstrapAdmin');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.get('uid') === uid;
    tx.create(ref, { uid, claimedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

async function runCallable(name: string, req: Request): Promise<Response> {
  const load = CALLABLES[name];
  if (!load) throw new HttpsError('not-found', `Unknown function "${name}".`);
  const token = await verifyCaller(req);
  const body = (await req.json().catch(() => ({}))) as { data?: unknown };
  const callable = await load();
  const request: CallableRequest = {
    data: body.data ?? null,
    auth: token ? { uid: token.uid, token: token as NonNullable<CallableRequest['auth']>['token'] } : undefined,
    rawRequest: req,
  };
  const result = await callable.__caspianCallable(request);
  return json({ result: result ?? null });
}

async function runStripeWebhook(req: Request): Promise<Response> {
  const mod = await import('../../firebase/functions-stripe/src/stripe-webhook');
  const handler = (mod.stripeWebhook as unknown as ShimOnRequest).__caspianOnRequest;
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  let status = 200;
  let payload = '';
  const extraHeaders: Record<string, string> = {};
  const res: ShimResponse = {
    status(code) {
      status = code;
      return res;
    },
    send(body) {
      payload = typeof body === 'string' ? body : body === undefined ? '' : JSON.stringify(body);
      return res;
    },
    json(body) {
      extraHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
      return res;
    },
    set(name, value) {
      extraHeaders[name] = value;
      return res;
    },
  };
  await getCaspianAdminApp();
  await handler({ method: req.method, headers, rawBody, body: null }, res);
  return new Response(payload, { status, headers: extraHeaders });
}

function subPath(req: Request, basePath: string): string {
  const { pathname } = new URL(req.url);
  const idx = pathname.indexOf(basePath);
  const rest = idx >= 0 ? pathname.slice(idx + basePath.length) : pathname;
  return rest.replace(/^\/+|\/+$/g, '');
}

/**
 * Next.js App Router usage — `src/app/api/caspian-store/[...path]/route.ts`:
 *
 * ```ts
 * import { caspianHandleApi } from '@caspian-explorer/script-caspian-store/server';
 * export const runtime = 'nodejs';
 * export const dynamic = 'force-dynamic';
 * export const maxDuration = 300;
 * export const GET = (req: Request) => caspianHandleApi(req);
 * export const POST = (req: Request) => caspianHandleApi(req);
 * ```
 */
export async function caspianHandleApi(req: Request, options: CaspianHandleApiOptions = {}): Promise<Response> {
  const path = subPath(req, options.basePath ?? '/api/caspian-store');
  if (options.stripe) registerStripe(options.stripe);
  try {
    // Every route needs the Admin app, including callables with no signed-in
    // caller (guest order lookup), which never reach verifyCaller's init.
    try {
      await getCaspianAdminApp();
    } catch (err) {
      console.error('[caspian-store] server API cannot start:', err);
      throw new HttpsError(
        'failed-precondition',
        err instanceof Error ? err.message : 'The server has no Firebase credentials.',
      );
    }
    if (path === 'setup/status' && req.method === 'GET') {
      const { bootstrap } = await authorizeSetup(req);
      return json({ ...(await getFirebaseSetupStatus()), bootstrap });
    }
    if (path === 'setup/install' && req.method === 'POST') {
      const { token, bootstrap } = await authorizeSetup(req);
      const result = await installFirebaseSetup();
      // Promote only once the rules went in, so a failed install leaves no admin behind.
      if (bootstrap && result.firestoreRules) await promoteToAdmin(token);
      return json({ ...result, promotedToAdmin: bootstrap && result.firestoreRules });
    }
    if (path.startsWith('call/') && req.method === 'POST') {
      return await runCallable(path.slice('call/'.length), req);
    }
    if (path === 'stripe/webhook' && req.method === 'POST') {
      return await runStripeWebhook(req);
    }
    if (path === 'update' && req.method === 'POST') {
      return await caspianHandleSelfUpdate(req);
    }
    return json({ error: { code: 'not-found', message: `No handler for ${req.method} ${path || '/'}` } }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}
