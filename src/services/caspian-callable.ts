import { httpsCallable, type Functions, type HttpsCallableResult } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

/**
 * Callables the host's server API (`caspianHandleApi`, `./server` entry)
 * answers. Keep in step with CALLABLES in src/server/api.ts. Anything not
 * listed (e.g. `sendTestEmail`) still goes to Cloud Functions.
 */
const SERVER_CALLABLES = new Set([
  'claimAdmin',
  'ensureAdminClaim',
  'setUserRole',
  'promoteUserToAdmin',
  'demoteAdminToCustomer',
  'linkMyGuestOrders',
  'getGuestOrder',
  'createStripeCheckoutSession',
  'getStripeSession',
]);

// Keyed by Firebase app name, so two providers on one page stay separate.
const serverApiByApp = new Map<string, string>();

/** Called by `<CaspianStoreProvider serverApi>`; `null` switches back to Cloud Functions. */
export function registerCaspianServerApi(appName: string, url: string | null | undefined): void {
  if (url) serverApiByApp.set(appName, url.replace(/\/+$/, ''));
  else serverApiByApp.delete(appName);
}

export function getCaspianServerApi(appName: string): string | null {
  return serverApiByApp.get(appName) ?? null;
}

/** Error thrown for a failed server call; `code` matches Firebase's `functions/<code>`. */
export class CaspianCallableError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'CaspianCallableError';
    this.code = `functions/${code}`;
    this.details = details;
  }
}

/**
 * Authenticated POST to the host's server API. Sends the signed-in user's
 * Firebase ID token (when there is one) so the server can check who called.
 */
export async function callCaspianServer<Res>(
  functions: Functions,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<Res> {
  const base = getCaspianServerApi(functions.app.name);
  if (!base) throw new CaspianCallableError('failed-precondition', 'No server API is configured.');
  const user = getAuth(functions.app).currentUser;
  const token = user ? await user.getIdToken() : null;
  const method = init.method ?? 'POST';
  const res = await fetch(`${base}/${path}`, {
    method,
    headers: {
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
  });
  const payload = (await res.json().catch(() => null)) as
    | (Res & { error?: { code?: string; message?: string; details?: unknown } })
    | null;
  if (!res.ok || payload?.error) {
    const err = payload?.error;
    throw new CaspianCallableError(
      err?.code ?? (res.status === 404 ? 'not-found' : 'internal'),
      err?.message ?? `Server request failed (${res.status}).`,
      err?.details,
    );
  }
  return payload as Res;
}

/**
 * Drop-in for `httpsCallable(functions, name)`: runs on the host's server API
 * when `<CaspianStoreProvider serverApi>` is set (no Cloud Functions to
 * deploy), otherwise on the deployed Cloud Function.
 */
export function caspianCallable<Req = unknown, Res = unknown>(
  functions: Functions,
  name: string,
): (data?: Req) => Promise<HttpsCallableResult<Res>> {
  return async (data?: Req) => {
    if (getCaspianServerApi(functions.app.name) && SERVER_CALLABLES.has(name)) {
      const { result } = await callCaspianServer<{ result: Res }>(functions, `call/${name}`, {
        body: { data: data ?? null },
      });
      return { data: result };
    }
    return httpsCallable<Req, Res>(functions, name)(data as Req);
  };
}
