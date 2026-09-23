'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../context/cart-context';
import { useAuth } from '../context/auth-context';
import {
  useCaspianFirebase,
  useCaspianImage,
  useCaspianLink,
  useCaspianNavigation,
} from '../provider/caspian-store-provider';
import { useScriptSettings } from '../context/script-settings-context';
import { useCheckout } from '../hooks/use-checkout';
import { useFormatCurrency, useT } from '../i18n/locale-context';
import { getSiteSettings } from '../services/site-settings-service';
import { calculateShippingRates } from '../services/shipping-calculator';
import { addAddress } from '../services/user-service';
import { subscribeEmail } from '../services/subscriber-service';
import { ALL_COUNTRIES } from '../utils/countries';
import type { SiteSettings, SupportedCountry, UserAddress } from '../types';
import type { ShippingRate } from '../shipping/types';
import { Button } from '../ui/button';
import { ChevronDownIcon } from '../ui/icons';
import { Input, Label, Textarea } from '../ui/input';
import { Skeleton } from '../ui/misc';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { cn } from '../utils/cn';

export interface CheckoutPageProps {
  /** Where the payment provider returns users after successful payment. */
  successUrl: string;
  /** Where the payment provider returns users if they cancel. */
  cancelUrl: string;
  /** Price formatter. Default: the store's `defaultCurrency` in the active locale. */
  formatPrice?: (n: number) => string;
  /** Currency code passed to shipping plugins when computing rates. Default: the store's `defaultCurrency`. */
  currency?: string;
  /** Where "Return to cart" navigates. Default: `/cart`. */
  cartHref?: string;
  className?: string;
}

interface ShippingForm {
  email: string;
  newsletterOptIn: boolean;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  countryCode: string;
  postalCode: string;
  phone: string;
  orderNotes: string;
  saveAddressToProfile: boolean;
  /**
   * "Create an account for faster checkout next time" — WooCommerce-style
   * opt-in shown only to anonymous (guest) buyers when
   * `SiteSettings.accounts.allowAccountCreationAtCheckout` is enabled. No
   * password is collected here; the library calls `signUpWithSetupLink()`
   * which mails a password-setup link to the buyer post-purchase.
   */
  createAccount: boolean;
}

const CHECKOUT_FORM_ID = 'caspian-checkout-form';

// Same cap the hadiyyam checkout used; long enough for delivery instructions.
const ORDER_NOTES_MAX = 500;

// Countries whose postal codes are digits only, so the phone can show the
// number pad. Anything else (GB, CA, NL, BR, JP, PL, ...) keeps the text
// keyboard because letters, spaces or hyphens are part of the code.
const NUMERIC_POSTCODE_COUNTRIES = new Set([
  'US', 'DE', 'FR', 'ES', 'IT', 'AT', 'CH', 'BE', 'DK', 'NO', 'FI', 'SE', 'CZ', 'SK', 'HU',
  'RO', 'BG', 'HR', 'RS', 'SI', 'EE', 'LT', 'LV', 'LU', 'IS', 'GR', 'CY', 'TR', 'RU', 'UA',
  'KZ', 'GE', 'IN', 'CN', 'KR', 'AU', 'NZ', 'MX', 'ID', 'TH', 'VN', 'PH', 'PK', 'EG', 'ZA',
  'MY', 'SG', 'TW', 'IL', 'SA',
]);

/**
 * "Next" on the phone keyboard fires Enter, which a form treats as submit.
 * Move focus to the following field instead; the last field is marked
 * `done` and falls through to the real submit.
 */
function advanceOnEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter') return;
  const target = e.target as HTMLElement;
  if (!(target instanceof HTMLInputElement) || target.enterKeyHint !== 'next') return;
  const fields = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('input:not([type=checkbox]):not([type=radio]), select'),
  ).filter((el) => !el.hasAttribute('disabled'));
  const next = fields[fields.indexOf(target) + 1];
  if (!next) return;
  e.preventDefault();
  next.focus();
}

const emptyForm: ShippingForm = {
  email: '',
  newsletterOptIn: false,
  firstName: '',
  lastName: '',
  address: '',
  apartment: '',
  city: '',
  countryCode: '',
  postalCode: '',
  phone: '',
  orderNotes: '',
  saveAddressToProfile: true,
  createAccount: false,
};

/**
 * Shipping-information step of checkout. Layout: two cards on the left
 * (Contact + Shipping Address + Shipping Method), sticky Order Summary on
 * the right with line items, subtotal, shipping, optional tax, and the
 * Continue-to-Payment CTA. Payment itself happens at the active payment
 * plugin (Stripe redirect for the built-in plugin).
 *
 * Signed-in users see a picker of their saved addresses above the form;
 * picking one auto-fills. A "new address" checkbox on submit saves the
 * entered address to the user profile so it's available next time.
 *
 * Tax: respects `SiteSettings.taxMode`. Under `flat` the `flatTaxRate`
 * applies; under `per-country` the rate on the selected country's row in
 * `supportedCountries` applies; under `none` (or undefined) the tax row is
 * hidden. Tax is always labelled an *estimate* — final tax is computed at
 * the payment provider.
 *
 * Country: if `SiteSettings.supportedCountries` is non-empty, the country
 * dropdown is restricted to that list. Shipping methods are filtered to
 * those whose `eligibleCountries` include the selected country (or are
 * empty = available everywhere).
 */
export function CheckoutPage({
  successUrl,
  cancelUrl,
  formatPrice: formatPriceProp,
  currency: currencyProp,
  cartHref = '/cart',
  className,
}: CheckoutPageProps) {
  const { db, auth: firebaseAuth } = useCaspianFirebase();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const nav = useCaspianNavigation();
  const { settings } = useScriptSettings();
  const currency = currencyProp ?? settings.defaultCurrency;
  const currencyFormat = useFormatCurrency(currency);
  const formatPrice = formatPriceProp ?? ((n: number) => currencyFormat.format(n));
  const { items, subtotal, count } = useCart();
  const {
    user,
    userProfile,
    loading: authLoading,
    signIn,
    signInAsGuest,
    signInWithGoogle,
    signUpWithSetupLink,
  } = useAuth();
  const { toast } = useToast();
  const { startCheckout, loading, ready, error, activePlugin } = useCheckout();
  const t = useT();
  // Carried over from the cart page's promo field (`/checkout?promo=CODE`).
  // The server re-validates; this is display + pass-through only.
  const promoCode = nav.searchParams?.get('promo')?.trim().toUpperCase() || null;
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const guestSignInAttempted = useRef(false);

  const [site, setSite] = useState<SiteSettings | null>(null);
  const [form, setForm] = useState<ShippingForm>(() => ({ ...emptyForm }));
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  const providerName = activePlugin?.name ?? '';
  // Rates depend on whether a postal code exists, not on its characters, so
  // typing it does not refetch on every keystroke.
  const hasPostalCode = Boolean(form.postalCode.trim());

  // Load site settings (country list + tax config).
  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (alive) setSite(s ?? null);
      })
      .catch(() => {
        if (alive) setSite(null);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  // Seed contact email from profile once auth lands.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      email: f.email || user.email || '',
      firstName: f.firstName || userProfile?.displayName?.split(' ')[0] || '',
      lastName: f.lastName || userProfile?.displayName?.split(' ').slice(1).join(' ') || '',
    }));
  }, [user, userProfile]);

  // Default-select the user's default address once profile + addresses load.
  useEffect(() => {
    if (!userProfile?.addresses?.length) return;
    const def = userProfile.addresses.find((a) => a.isDefault) ?? userProfile.addresses[0];
    if (def) {
      setSelectedAddressId(def.id);
      applyAddressToForm(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  const applyAddressToForm = (addr: UserAddress) => {
    setForm((f) => ({
      ...f,
      firstName: addr.name.split(' ')[0] ?? f.firstName,
      lastName: addr.name.split(' ').slice(1).join(' ') || f.lastName,
      address: addr.address,
      city: addr.city,
      postalCode: addr.zip,
      countryCode: addr.country,
      saveAddressToProfile: false,
    }));
  };

  const handleAddressPick = (id: string) => {
    setSelectedAddressId(id);
    if (id === 'new') {
      setForm((f) => ({
        ...f,
        firstName: '',
        lastName: '',
        address: '',
        apartment: '',
        city: '',
        postalCode: '',
        countryCode: '',
        saveAddressToProfile: true,
      }));
      return;
    }
    const picked = userProfile?.addresses?.find((a) => a.id === id);
    if (picked) applyAddressToForm(picked);
  };

  // Supported-country options. Empty list → library falls back to a tiny
  // global default so checkout doesn't lock up before an admin configures it.
  const countryOptions = useMemo(() => {
    const list: SupportedCountry[] =
      site?.supportedCountries && site.supportedCountries.length > 0
        ? site.supportedCountries
        : DEFAULT_COUNTRIES;
    return [
      { value: '', label: t('checkout.country.select') },
      ...list.map((c) => ({ value: c.code, label: c.name })),
    ];
  }, [site?.supportedCountries, t]);

  // Recompute available shipping rates whenever cart or country changes.
  useEffect(() => {
    let alive = true;
    if (count === 0) {
      setRates(null);
      setSelectedRate(null);
      return;
    }
    // Honor the site-wide `hideRatesUntilAddressEntered` toggle before we even
    // run the query — keeps the picker blank while the shopper is still filling
    // in their address, which is the point of the setting.
    const hideUntilAddress = site?.shippingOptions?.hideRatesUntilAddressEntered ?? false;
    if (hideUntilAddress && (!form.countryCode || !hasPostalCode)) {
      setRates(null);
      setSelectedRate(null);
      return;
    }
    calculateShippingRates({
      db,
      items,
      subtotal,
      address: null,
      currency,
    })
      .then((list) => {
        if (!alive) return;
        // Client-side filter by eligibleCountries.
        let filtered = form.countryCode
          ? list.filter((r) => {
              const eligible = r.eligibleCountries;
              return !eligible || eligible.length === 0 || eligible.includes(form.countryCode);
            })
          : list;
        // When the merchant enables `hideRatesWhenFreeAvailable` and any rate
        // is 0, suppress the paid options so the shopper auto-lands on free.
        if (site?.shippingOptions?.hideRatesWhenFreeAvailable) {
          const hasFree = filtered.some((r) => r.price === 0);
          if (hasFree) filtered = filtered.filter((r) => r.price === 0);
        }
        setRates(filtered);
        setSelectedRate((prev) => {
          if (prev && filtered.some((r) => r.installId === prev.installId)) return prev;
          return filtered[0] ?? null;
        });
      })
      .catch((err) => {
        console.error('[caspian-store] Failed to calculate shipping rates:', err);
        if (alive) setRates([]);
      });
    return () => {
      alive = false;
    };
  }, [
    db,
    items,
    subtotal,
    count,
    currency,
    form.countryCode,
    hasPostalCode,
    site?.shippingOptions?.hideRatesUntilAddressEntered,
    site?.shippingOptions?.hideRatesWhenFreeAvailable,
  ]);

  // Tax estimate. v2.12 honors `SiteSettings.taxConfig.taxBasedOn` to pick
  // which country code drives the per-country rate lookup.
  const taxAmount = useMemo(() => {
    if (!site?.taxMode || site.taxMode === 'none') return 0;
    if (site.taxMode === 'flat') return subtotal * (site.flatTaxRate ?? 0);
    const mode = site.taxConfig?.taxBasedOn ?? 'shipping';
    const taxCountry =
      mode === 'store' ? (site.country ?? '') : form.countryCode;
    const row = site.supportedCountries?.find((c) => c.code === taxCountry);
    return subtotal * (row?.taxRate ?? 0);
  }, [site, subtotal, form.countryCode]);

  const showTaxRow = site?.taxMode === 'flat' || site?.taxMode === 'per-country';
  const taxLabel = site?.taxLabel || t('checkout.taxDefault');
  const total = useMemo(
    () => subtotal + (selectedRate?.price ?? 0) + taxAmount,
    [subtotal, selectedRate, taxAmount],
  );

  // ---- Auto-anon-signin for guest checkout ----
  //
  // WooCommerce-style: don't gate the checkout form behind a "sign in / guest"
  // interstitial. The form renders for everyone, and if the buyer has no auth
  // session we silently kick off Firebase anonymous auth so cart writes,
  // shipping-rate queries, and the eventual order create-doc all pass the
  // `isAuth()` rule. The buyer can still sign in inline or check the "create
  // account" box mid-checkout. The guard `guestSignInAttempted` is the only
  // thing keeping React StrictMode's double-mount from triggering two anon
  // sessions on the first render.
  useEffect(() => {
    if (authLoading || user) return;
    const allowGuest = site?.accounts?.allowGuestCheckout ?? true;
    if (!allowGuest) return;
    if (guestSignInAttempted.current) return;
    guestSignInAttempted.current = true;
    void signInAsGuest().catch((err) => {
      console.error('[caspian-store] Guest sign-in failed:', err);
      toast({
        title: t('checkout.guestSignInFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
      guestSignInAttempted.current = false;
    });
  }, [authLoading, user, site?.accounts?.allowGuestCheckout, signInAsGuest, toast, t]);

  const handleInlineSignIn = async (provider: 'password' | 'google') => {
    setSignInBusy(true);
    setSignInError(null);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signIn(signInEmail.trim(), signInPassword);
      }
      setSignInOpen(false);
      setSignInPassword('');
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : t('auth.login.failed'));
    } finally {
      setSignInBusy(false);
    }
  };

  // ---- Render gates ----

  if (authLoading || !ready) {
    return <CheckoutSkeleton className={className} />;
  }

  // When guest checkout is disabled and the buyer is signed out, fall back to
  // the original interstitial so admins who explicitly turned the toggle off
  // still get the auth-required UX.
  if (!user) {
    const allowRegister = site?.accounts?.allowAccountCreationAtCheckout ?? true;
    return (
      <div
        className={className}
        style={{
          padding: 40,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('checkout.signInTitle')}</h1>
        <p style={{ color: '#666', marginTop: 0 }}>{t('checkout.signInSubtitle')}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/login">{t('signInGate.signInLink')}</Link>
          {allowRegister && <Link href="/register">{t('checkout.createAccountLink')}</Link>}
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className={className} style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('checkout.emptyCart')}</h1>
        <div style={{ marginTop: 16 }}>
          <Link href="/">{t('checkout.continueShopping')}</Link>
        </div>
      </div>
    );
  }

  if (!activePlugin) {
    return (
      <div className={className} style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('checkout.noPaymentConfigured.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 8 }}>{t('checkout.noPaymentConfigured.body')}</p>
        {userProfile?.role === 'admin' && (
          <div style={{ marginTop: 16 }}>
            <Link href="/admin/plugins?filter=payment">{t('checkout.noPaymentConfigured.adminLink')}</Link>
          </div>
        )}
      </div>
    );
  }

  const handlePay = async () => {
    // Promote an anonymous (guest) session to a real account before starting
    // checkout when the buyer ticked "Create an account". This swaps the
    // Firebase auth session synchronously — `firebaseAuth.currentUser` is the
    // new user immediately on resolve, so the subsequent `addAddress` and
    // `startCheckout` calls stamp the real uid. The React `user` state lags
    // by a tick (it's driven by `onAuthStateChanged`), so we deliberately
    // read from `firebaseAuth.currentUser` in those follow-up calls.
    let accountPromoted = false;
    if (form.createAccount && user?.isAnonymous && form.email.trim()) {
      try {
        await signUpWithSetupLink(
          form.email.trim(),
          `${form.firstName} ${form.lastName}`.trim() || form.email.trim(),
        );
        accountPromoted = true;
      } catch (err) {
        // Most common failure is `auth/email-already-in-use` — surface a
        // toast and continue as a guest order. The auth-trigger Cloud
        // Function will still link the order to the existing account if
        // the buyer signs in or registers later with the same email.
        const msg =
          err instanceof Error && err.message.includes('email-already-in-use')
            ? t('checkout.accountNotCreated.emailInUse')
            : err instanceof Error
              ? err.message
              : t('checkout.accountNotCreated.fallback');
        toast({ title: t('checkout.accountNotCreated.title'), description: msg, variant: 'destructive' });
      }
    }

    // Subscribe to newsletter if opted in.
    if (form.newsletterOptIn && form.email.trim()) {
      try {
        await subscribeEmail(db, form.email.trim());
      } catch (err) {
        console.warn('[caspian-store] Newsletter subscribe failed (continuing):', err);
      }
    }

    // Persist new address to user profile if opted in. We deliberately skip
    // this for anonymous buyers — their profile is throwaway. `currentUser`
    // is fresh post-account-promotion above.
    const effectiveUser = firebaseAuth.currentUser ?? user;
    if (
      selectedAddressId === 'new' &&
      form.saveAddressToProfile &&
      effectiveUser &&
      !effectiveUser.isAnonymous
    ) {
      try {
        await addAddress(db, effectiveUser.uid, {
          name: `${form.firstName} ${form.lastName}`.trim(),
          address: [form.address, form.apartment].filter(Boolean).join(' '),
          city: form.city,
          zip: form.postalCode,
          country: form.countryCode,
          isDefault: !userProfile?.addresses?.length,
        });
      } catch (err) {
        console.warn('[caspian-store] Address save failed (continuing):', err);
      }
    }

    try {
      await startCheckout({
        successUrl,
        cancelUrl,
        promoCode,
        shippingCost: selectedRate?.price ?? 0,
        tax: taxAmount,
        email: form.email.trim(),
        createAccount: form.createAccount && !accountPromoted,
        shippingInfo: selectedRate
          ? {
              name: `${form.firstName} ${form.lastName}`.trim(),
              address: [form.address, form.apartment].filter(Boolean).join(' '),
              city: form.city,
              zip: form.postalCode,
              country: form.countryCode,
              shippingMethod: selectedRate.label,
              phone: form.phone.trim() || undefined,
              orderNotes: form.orderNotes.trim() || undefined,
            }
          : undefined,
      });
    } catch {
      // error state is surfaced via the hook
    }
  };

  const savedAddressOptions = [
    ...(userProfile?.addresses ?? []).map((a) => ({
      value: a.id,
      label: `${a.name} — ${a.address}, ${a.city}${a.isDefault ? ` ${t('checkout.address.defaultSuffix')}` : ''}`,
    })),
    { value: 'new', label: t('checkout.address.useNew') },
  ];
  const hasSavedAddresses = (userProfile?.addresses?.length ?? 0) > 0;

  const formValid = Boolean(
    form.email &&
      form.firstName &&
      form.address &&
      form.city &&
      form.countryCode &&
      form.postalCode,
  );

  // ---- Render ----

  const postalIsNumeric = NUMERIC_POSTCODE_COUNTRIES.has(form.countryCode);
  const submitDisabled = !selectedRate || !formValid;

  const summaryBody = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        {items.map((item) => {
          const img = item.product.images?.[0];
          return (
            <div
              key={`${item.product.id}-${item.selectedSize ?? ''}-${item.selectedColor ?? ''}`}
              style={{ display: 'flex', gap: 12 }}
            >
              <div
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#f5f5f5',
                  flexShrink: 0,
                }}
              >
                {img && <Image src={img.url} alt={img.alt || item.product.name} fill />}
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: '#888',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.quantity}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                  {item.product.name}
                </p>
                {(item.selectedSize || item.selectedColor) && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>
                    {[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {formatPrice(item.product.price * item.quantity)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12 }}>
        <SummaryRow label={t('cart.subtotal')} value={formatPrice(subtotal)} />
        <SummaryRow
          label={t('checkout.shippingLine')}
          value={
            selectedRate
              ? selectedRate.price > 0
                ? formatPrice(selectedRate.price)
                : t('checkout.rate.free')
              : t('checkout.rate.notSelected')
          }
        />
        {showTaxRow && (
          <SummaryRow
            label={taxLabel}
            value={form.countryCode ? formatPrice(taxAmount) : t('checkout.taxPending')}
          />
        )}
        {promoCode && <SummaryRow label={t('checkout.promoLine')} value={promoCode} />}
      </div>
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          paddingTop: 12,
          marginTop: 8,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700 }}>{t('checkout.totalLine')}</span>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{formatPrice(total)}</span>
      </div>
    </>
  );

  return (
    <div
      className={cn('caspian-has-sticky-cta', className)}
      style={{ maxWidth: 1200, margin: '0 auto', padding: '24px clamp(16px, 4vw, 24px) 64px' }}
    >
      <nav aria-label="breadcrumb" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#888', marginBottom: 12 }}>
        <Link href={cartHref}>
          <span style={{ color: '#888' }}>{t('checkout.breadcrumb.cart')}</span>
        </Link>{' '}
        &gt; <span style={{ color: '#111', fontWeight: 600 }}>{t('checkout.breadcrumb.checkout')}</span>
      </nav>

      <h1
        style={{
          fontSize: 'clamp(26px, 6vw, 32px)',
          fontWeight: 700,
          margin: '0 0 24px',
          letterSpacing: '-0.01em',
        }}
      >
        {t('checkout.shippingInformation')}
      </h1>

      {/* Phones only (hidden >= 821px in globals.css): the summary comes
          first as a collapsible row so the buyer sees what they're paying
          for before the form. Desktop keeps the sticky aside below. */}
      <details
        className="caspian-checkout-summary-mobile"
        style={{ ...cardStyle, padding: 0, marginBottom: 16 }}
      >
        <summary
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 56,
            padding: '0 16px',
            cursor: 'pointer',
            listStyle: 'none',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ChevronDownIcon className="caspian-checkout-summary-mobile__chevron" size={18} />
            {t('checkout.orderSummary')}
          </span>
          <span>{formatPrice(total)}</span>
        </summary>
        <div style={{ padding: '0 16px 16px' }}>{summaryBody}</div>
      </details>

      <div
        className="caspian-checkout-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) 400px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <form
          id={CHECKOUT_FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            void handlePay();
          }}
          onKeyDown={advanceOnEnter}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* --- Contact --- */}
          <section style={cardStyle}>
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={h2Style}>{t('checkout.contact')}</h2>
              {user?.isAnonymous && (
                <button
                  type="button"
                  onClick={() => setSignInOpen((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 13,
                    color: 'var(--caspian-primary, #111)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {signInOpen ? t('checkout.inlineSignIn.hide') : t('checkout.inlineSignIn.show')}
                </button>
              )}
            </header>
            {signInOpen && user?.isAnonymous && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  marginBottom: 16,
                  background: 'rgba(0,0,0,0.03)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <Label htmlFor="caspian-checkout-signin-email">{t('auth.login.email')}</Label>
                  <Input
                    id="caspian-checkout-signin-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="next"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="caspian-checkout-signin-password">{t('auth.login.password')}</Label>
                  <Input
                    id="caspian-checkout-signin-password"
                    type="password"
                    autoComplete="current-password"
                    enterKeyHint="go"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter here signs in; it must not submit the checkout form.
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (signInEmail.trim() && signInPassword) void handleInlineSignIn('password');
                    }}
                  />
                </div>
                {signInError && (
                  <p style={{ color: '#b91c1c', fontSize: 12, margin: 0 }}>{signInError}</p>
                )}
                <div className="caspian-stack-mobile" style={{ display: 'flex', gap: 8 }}>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleInlineSignIn('password')}
                    loading={signInBusy}
                    disabled={!signInEmail.trim() || !signInPassword}
                  >
                    {t('auth.login.submit')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleInlineSignIn('google')}
                    loading={signInBusy}
                  >
                    {t('auth.login.googleCta')}
                  </Button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <FieldLabel htmlFor="caspian-checkout-email" required>
                  {t('checkout.emailPlaceholder')}
                </FieldLabel>
                <Input
                  id="caspian-checkout-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="next"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}>
                <input
                  type="checkbox"
                  checked={form.newsletterOptIn}
                  onChange={(e) => setForm((f) => ({ ...f, newsletterOptIn: e.target.checked }))}
                />
                {t('checkout.newsletterOptIn')}
              </label>
              {user?.isAnonymous && (site?.accounts?.allowAccountCreationAtCheckout ?? true) && (
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' }}
                >
                  <input
                    type="checkbox"
                    checked={form.createAccount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, createAccount: e.target.checked }))
                    }
                  />
                  {t('checkout.createAccountOptIn')}
                </label>
              )}
            </div>
          </section>

          {/* --- Shipping Address --- */}
          <section style={cardStyle}>
            <h2 style={h2Style}>{t('checkout.shippingAddress')}</h2>

            {hasSavedAddresses && (
              <div style={{ marginBottom: 16 }}>
                <Label htmlFor="caspian-checkout-saved-address">{t('checkout.address.useSaved')}</Label>
                <Select
                  id="caspian-checkout-saved-address"
                  value={selectedAddressId}
                  onChange={(e) => handleAddressPick(e.target.value)}
                  options={savedAddressOptions}
                />
              </div>
            )}

            {(selectedAddressId === 'new' || !hasSavedAddresses) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="caspian-checkout-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <FieldLabel htmlFor="caspian-checkout-first-name" required>
                      {t('checkout.firstName')}
                    </FieldLabel>
                    <Input
                      id="caspian-checkout-first-name"
                      autoComplete="given-name"
                      enterKeyHint="next"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="caspian-checkout-last-name">{t('checkout.lastName')}</FieldLabel>
                    <Input
                      id="caspian-checkout-last-name"
                      autoComplete="family-name"
                      enterKeyHint="next"
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="caspian-checkout-address" required>
                    {t('checkout.streetAddress')}
                  </FieldLabel>
                  <Input
                    id="caspian-checkout-address"
                    autoComplete="address-line1"
                    enterKeyHint="next"
                    required
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="caspian-checkout-apartment">{t('checkout.apartment')}</FieldLabel>
                  <Input
                    id="caspian-checkout-apartment"
                    autoComplete="address-line2"
                    enterKeyHint="next"
                    value={form.apartment}
                    onChange={(e) => setForm((f) => ({ ...f, apartment: e.target.value }))}
                  />
                </div>
                <div className="caspian-checkout-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <FieldLabel htmlFor="caspian-checkout-city" required>
                      {t('checkout.city')}
                    </FieldLabel>
                    <Input
                      id="caspian-checkout-city"
                      autoComplete="address-level2"
                      enterKeyHint="next"
                      required
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="caspian-checkout-country" required>
                      {t('checkout.country')}
                    </FieldLabel>
                    <Select
                      id="caspian-checkout-country"
                      autoComplete="country"
                      required
                      style={{ width: '100%' }}
                      value={form.countryCode}
                      onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
                      options={countryOptions}
                    />
                  </div>
                </div>
                <div className="caspian-checkout-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <FieldLabel htmlFor="caspian-checkout-postal-code" required>
                      {t('checkout.postalCode')}
                    </FieldLabel>
                    <Input
                      id="caspian-checkout-postal-code"
                      autoComplete="postal-code"
                      inputMode={postalIsNumeric ? 'numeric' : 'text'}
                      enterKeyHint="next"
                      required
                      value={form.postalCode}
                      onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="caspian-checkout-phone">{t('checkout.phone')}</FieldLabel>
                    <Input
                      id="caspian-checkout-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      enterKeyHint="done"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="caspian-checkout-notes">{t('checkout.orderNotes')}</FieldLabel>
                  <Textarea
                    id="caspian-checkout-notes"
                    rows={3}
                    maxLength={ORDER_NOTES_MAX}
                    placeholder={t('checkout.orderNotesPlaceholder')}
                    value={form.orderNotes}
                    onChange={(e) => setForm((f) => ({ ...f, orderNotes: e.target.value }))}
                  />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{t('checkout.requiredHint')}</p>
                {user && !user.isAnonymous && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#666' }}>
                    <input
                      type="checkbox"
                      checked={form.saveAddressToProfile}
                      onChange={(e) => setForm((f) => ({ ...f, saveAddressToProfile: e.target.checked }))}
                    />
                    {t('checkout.address.saveToProfile')}
                  </label>
                )}
              </div>
            )}
          </section>

          {/* --- Shipping Method --- */}
          <section style={cardStyle}>
            <h2 style={h2Style}>{t('checkout.shippingMethod')}</h2>
            {!form.countryCode ? (
              <p style={{ color: '#888', fontSize: 14, margin: 0 }}>{t('checkout.shippingMethodPickCountry')}</p>
            ) : rates === null ? (
              <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton style={{ height: 52 }} />
                <Skeleton style={{ height: 52 }} />
              </div>
            ) : rates.length === 0 ? (
              <p style={{ color: '#b91c1c', fontSize: 14, margin: 0 }}>
                {t('checkout.shippingMethodNone')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rates.map((r) => {
                  const active = selectedRate?.installId === r.installId;
                  return (
                    <label
                      key={r.installId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        minHeight: 56,
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 16px',
                        border: active
                          ? '2px solid var(--caspian-primary, #111)'
                          : '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="radio"
                          checked={active}
                          onChange={() => setSelectedRate(r)}
                          name="shipping-method"
                        />
                        <span>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
                          {r.estimatedDays && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                              {t('checkout.shippingEta', {
                                min: r.estimatedDays.min,
                                max: r.estimatedDays.max,
                              })}
                            </div>
                          )}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          marginLeft: 'auto',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.price > 0 ? formatPrice(r.price) : t('checkout.rate.free')}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </form>

        {/* --- Order Summary --- */}
        <aside className="caspian-checkout-summary" style={{ position: 'sticky', top: 16 }}>
          <section style={cardStyle}>
            <h2 style={h2Style}>{t('checkout.orderSummary')}</h2>

            {summaryBody}

            <Button
              type="submit"
              form={CHECKOUT_FORM_ID}
              size="lg"
              style={{ width: '100%', marginTop: 20 }}
              loading={loading}
              disabled={submitDisabled}
            >
              {loading ? t('checkout.redirecting') : t('checkout.continueToPayment')}
            </Button>
            {error && (
              <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginTop: 8 }}>
                {error}
              </p>
            )}

            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 11,
                color: '#888',
                marginTop: 12,
                marginBottom: 0,
                letterSpacing: '0.04em',
              }}
            >
              {t('checkout.secureLine')}
              {providerName ? ` · ${providerName}` : ''}
            </p>
          </section>

          <div style={{ marginTop: 12 }}>
            <Link href={cartHref}>
              <span style={{ fontSize: 13, color: '#666' }}>← {t('checkout.returnToCart')}</span>
            </Link>
          </div>
        </aside>
      </div>

      <div className="caspian-sticky-cta">
        <div className="caspian-sticky-cta__price">
          <strong>{formatPrice(total)}</strong>
          <span>{t('checkout.totalLine')}</span>
        </div>
        <Button
          type="submit"
          form={CHECKOUT_FORM_ID}
          size="lg"
          loading={loading}
          disabled={submitDisabled}
        >
          {loading ? t('checkout.redirecting') : t('checkout.continueToPayment')}
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required && (
        <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: 3 }}>
          *
        </span>
      )}
    </Label>
  );
}

function CheckoutSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={className}
      aria-busy="true"
      style={{ maxWidth: 1200, margin: '0 auto', padding: '24px clamp(16px, 4vw, 24px) 64px' }}
    >
      <Skeleton style={{ height: 12, width: 140, marginBottom: 16 }} />
      <Skeleton style={{ height: 36, width: 320, marginBottom: 32 }} />
      <div
        className="caspian-checkout-layout"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 400px', gap: 32 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton style={{ height: 160 }} />
          <Skeleton style={{ height: 320 }} />
          <Skeleton style={{ height: 140 }} />
        </div>
        <Skeleton style={{ height: 420 }} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 14,
        marginBottom: 8,
        color: '#333',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 'clamp(16px, 4vw, 24px)',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.05)',
};
const h2Style: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  margin: 0,
  marginBottom: 16,
};

/**
 * Fallback country list used before the admin configures
 * `SiteSettings.supportedCountries`. Full ISO 3166-1 alpha-2 set — a real
 * storefront will narrow this with `supportedCountries`, but a fresh install
 * should still let a shopper pick any country rather than fail the form.
 */
const DEFAULT_COUNTRIES: SupportedCountry[] = ALL_COUNTRIES.map((c) => ({
  code: c.code,
  name: c.name,
}));
