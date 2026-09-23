/**
 * Stand-in for the `stripe` package inside the `./server` build. The host
 * passes its own Stripe constructor to `caspianHandleApi({ stripe })`, so
 * the host's bundler sees the import and ships `stripe` with the server —
 * a dependency loaded behind the bundler's back would be missing at runtime
 * on App Hosting / Vercel. Stores that don't take card payments never
 * install it.
 */
import { HttpsError } from './https';

type StripeCtor = new (key: string, config?: unknown) => unknown;
let registered: StripeCtor | null = null;

export function registerStripe(ctor: unknown): void {
  const c = ctor as StripeCtor | { default?: StripeCtor } | null | undefined;
  registered = typeof c === 'function' ? c : (c?.default ?? null);
}

function Stripe(key: string, config?: unknown): unknown {
  if (!registered) {
    throw new HttpsError(
      'failed-precondition',
      'Card payments are not set up on this server: run `npm install stripe` and pass it to caspianHandleApi(req, { stripe: Stripe }).',
    );
  }
  if (!key) {
    throw new HttpsError(
      'failed-precondition',
      'STRIPE_SECRET_KEY is not set on the server. Add it as a secret in your host settings.',
    );
  }
  return new registered(key, config);
}

export default Stripe;
