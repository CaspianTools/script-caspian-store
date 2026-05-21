import { getIdToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import type {
  PaymentPlugin,
  PaymentPluginCheckoutCtx,
  PaymentPluginStartResult,
  StartCheckoutOptions,
  StripeConfig,
} from '../types';

interface StripeCallablePayload {
  items: Array<{
    productId: string;
    quantity: number;
    selectedSize: string | null;
    selectedColor: string | null;
  }>;
  successUrl: string;
  cancelUrl: string;
  promoCode: string | null;
  shippingCost: number;
  shippingInfo: StartCheckoutOptions['shippingInfo'] | null;
  locale: string | null;
  /** Form-collected contact email; server stamps it on the order. */
  email: string | null;
}

interface StripeCallableResponse {
  sessionId: string;
  url: string | null;
}

function withSessionIdPlaceholder(url: string): string {
  if (url.includes('{CHECKOUT_SESSION_ID}')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

function buildPayload(
  ctx: PaymentPluginCheckoutCtx,
  options: StartCheckoutOptions,
): StripeCallablePayload {
  return {
    items: ctx.items.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      selectedSize: i.selectedSize ?? null,
      selectedColor: i.selectedColor ?? null,
    })),
    successUrl: withSessionIdPlaceholder(options.successUrl),
    cancelUrl: options.cancelUrl,
    promoCode: options.promoCode ?? null,
    shippingCost: options.shippingCost ?? 0,
    shippingInfo: options.shippingInfo ?? null,
    locale: options.locale ?? null,
    email: options.email?.trim() || null,
  };
}

async function startCheckout(
  ctx: PaymentPluginCheckoutCtx,
  options: StartCheckoutOptions,
): Promise<PaymentPluginStartResult> {
  const payload = buildPayload(ctx, options);

  let data: StripeCallableResponse;

  if (options.endpoint) {
    const token = await getIdToken(ctx.user);
    const response = await fetch(options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Checkout failed (${response.status})`);
    }
    data = (await response.json()) as StripeCallableResponse;
  } else {
    const callable = httpsCallable<StripeCallablePayload, StripeCallableResponse>(
      ctx.functions,
      'createStripeCheckoutSession',
    );
    const result = await callable(payload);
    data = result.data;
  }

  if (!data.url) throw new Error('Stripe did not return a checkout URL.');

  return { redirectUrl: data.url, externalRef: data.sessionId };
}

export const STRIPE_PLUGIN: PaymentPlugin<StripeConfig> = {
  id: 'stripe',
  name: 'Stripe',
  description:
    'Accept card payments via Stripe Checkout. Requires the `functions-stripe` Cloud Functions codebase to be deployed. Keep test and live keys on one install and flip the mode — keep the Cloud Functions `STRIPE_SECRET_KEY` in sync.',
  defaultConfig: {
    mode: 'test',
    publishableKeyLive: '',
    publishableKeyTest: '',
    publishableKey: '',
  },
  validateConfig: (config) => {
    const c = (config ?? {}) as Partial<StripeConfig> & { publishableKey?: string };
    const mode: 'live' | 'test' = c.mode === 'live' ? 'live' : 'test';
    const live = typeof c.publishableKeyLive === 'string' ? c.publishableKeyLive.trim() : '';
    const test = typeof c.publishableKeyTest === 'string' ? c.publishableKeyTest.trim() : '';
    // v2.1-era installs stored a single `publishableKey` field. Map it onto the
    // matching mode-specific slot so upgraders don't have to re-enter.
    const legacy = typeof c.publishableKey === 'string' ? c.publishableKey.trim() : '';
    const resolvedLive = live || (legacy.startsWith('pk_live_') ? legacy : '');
    const resolvedTest = test || (legacy.startsWith('pk_test_') ? legacy : '');

    const active = mode === 'live' ? resolvedLive : resolvedTest;
    if (!active) {
      throw new Error(
        mode === 'live'
          ? 'Stripe live publishable key is required when mode is "live".'
          : 'Stripe test publishable key is required when mode is "test".',
      );
    }
    const expectedPrefix = mode === 'live' ? 'pk_live_' : 'pk_test_';
    if (!active.startsWith(expectedPrefix)) {
      throw new Error(`The ${mode} publishable key must start with \`${expectedPrefix}\`.`);
    }
    if (resolvedLive && !resolvedLive.startsWith('pk_live_')) {
      throw new Error('The live publishable key must start with `pk_live_`.');
    }
    if (resolvedTest && !resolvedTest.startsWith('pk_test_')) {
      throw new Error('The test publishable key must start with `pk_test_`.');
    }

    return {
      mode,
      publishableKeyLive: resolvedLive,
      publishableKeyTest: resolvedTest,
      publishableKey: active,
    };
  },
  startCheckout,
};
