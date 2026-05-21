import type { Auth, User } from 'firebase/auth';
import type { Functions } from 'firebase/functions';
import type { CartItem } from '../types';

export type PaymentPluginId = 'stripe' | 'bacs' | 'cheque' | 'cod';

export const PAYMENT_PLUGIN_IDS: readonly PaymentPluginId[] = [
  'stripe',
  'bacs',
  'cheque',
  'cod',
] as const;

/**
 * Shared config shape for manual-payment plugins (BACS / cheque / cash on
 * delivery). Every manual plugin renders the `instructions` block to the
 * shopper on the order-confirmation screen. Individual plugins may extend
 * this with extra fields (e.g. BACS account numbers). Added in v2.8.
 */
export interface ManualPaymentBaseConfig {
  /** Customer-facing instructions displayed after checkout. Supports line breaks. */
  instructions: string;
}

export interface BacsConfig extends ManualPaymentBaseConfig {
  accountName: string;
  accountNumber: string;
  sortCode?: string;
  iban?: string;
  swift?: string;
}

export interface ChequeConfig extends ManualPaymentBaseConfig {
  /** Payee name that cheques should be made out to. */
  payableTo?: string;
  /** Postal address to send cheques to. */
  postalAddress?: string;
}

export interface CodConfig extends ManualPaymentBaseConfig {
  /** Optional allowlist of shipping method names (plugin install `name`) for which COD is permitted. Empty/undefined = all. */
  enabledForShippingMethods?: string[];
}

export interface CheckoutShippingInfoInput {
  name: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  shippingMethod: string;
  orderNotes?: string;
}

export interface StartCheckoutOptions {
  /** URL to return to after payment. `{CHECKOUT_SESSION_ID}` is appended automatically unless already present. */
  successUrl: string;
  /** URL to return to if the customer cancels. */
  cancelUrl: string;
  /** Optional promo code (server re-validates; client-side value is ignored on the server). */
  promoCode?: string | null;
  /** Optional shipping cost — added as a line item when > 0. */
  shippingCost?: number;
  /** Optional shipping details — stored on the order when the webhook fires. */
  shippingInfo?: CheckoutShippingInfoInput;
  /** Optional locale pass-through (e.g. for email templating). */
  locale?: string;
  /**
   * Email collected on the checkout form. For anonymous (guest) buyers this
   * is the only contact channel — `ctx.user.email` is empty for Firebase
   * anonymous-auth users, so plugins stamp this onto `Order.userEmail` and
   * pass it to the payment provider (Stripe `customer_email`, etc.). For
   * signed-in buyers this typically matches `ctx.user.email`; the form value
   * still wins when set, so a buyer can ship to a different contact email.
   * Added in v9.1 alongside guest checkout.
   */
  email?: string;
  /**
   * Set by the checkout page when an anonymous buyer ticks the "Create an
   * account for faster checkout next time" checkbox. The page itself promotes
   * the anonymous session to a real account via `signUpWithSetupLink()` before
   * starting checkout; this flag is forwarded to payment plugins so server
   * code (Stripe webhook, etc.) can stamp `Order.isGuest = false` and surface
   * the post-purchase setup-link email. Added in v9.1.
   */
  createAccount?: boolean;
  /**
   * Optional override of the server endpoint. When set, the plugin will POST
   * JSON to this URL instead of invoking its Cloud Function callable. Useful
   * for consumers (like Next.js apps) that already host the checkout endpoint.
   * Plugins that don't support a custom endpoint must ignore this.
   */
  endpoint?: string;
}

export interface PaymentPluginCheckoutCtx {
  functions: Functions;
  auth: Auth;
  /** Signed-in user. `useCheckout` guards the sign-in gate; plugins always receive a user. */
  user: User;
  items: CartItem[];
  /** Plugin config from the active `PaymentPluginInstall.config` (after `validateConfig`). */
  config: Record<string, unknown>;
}

export interface PaymentPluginStartResult {
  /** URL to redirect to for payment, if any. `useCheckout` navigates to it on success. */
  redirectUrl: string | null;
  /** Provider-assigned identifier for this attempt (Stripe: session id). Persisted on the resulting order. */
  externalRef: string;
}

export interface PaymentPlugin<C = Record<string, unknown>> {
  id: PaymentPluginId;
  /** Brand name shown in admin and checkout UI. Plain string (brand names don't translate). */
  name: string;
  /** One-line description shown in the admin catalog. */
  description: string;
  /** Default config rendered into the install dialog. */
  defaultConfig: C;
  /** Parse raw Firestore config into the plugin's typed shape. Throws with a user-facing message on invalid input. */
  validateConfig: (config: unknown) => C;
  /** Invoke the provider to start a checkout session. */
  startCheckout: (
    ctx: PaymentPluginCheckoutCtx,
    options: StartCheckoutOptions,
  ) => Promise<PaymentPluginStartResult>;
}

export type StripeMode = 'live' | 'test';

export interface StripeConfig {
  /** Which key pair is active. Server-side secrets (Cloud Functions) must be kept in sync. */
  mode: StripeMode;
  /** `pk_live_...` key. Required when `mode === 'live'`, optional otherwise. */
  publishableKeyLive: string;
  /** `pk_test_...` key. Required when `mode === 'test'`, optional otherwise. */
  publishableKeyTest: string;
  /**
   * Derived from `mode` at validate time — the active publishable key for
   * client-side Stripe.js. Not persisted; callers can read it from the
   * validated config.
   */
  publishableKey: string;
}
