'use client';

import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useCaspianFirebase, useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useScriptSettings } from '../context/script-settings-context';
import { useFormatCurrency, useLocale, useT } from '../i18n/locale-context';
import { Badge } from '../ui/misc';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/input';

interface GuestOrderResponse {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number | null;
  currency: string | null;
  promoCode: string | null;
  items: Array<{
    name: string;
    brand: string;
    price: number;
    quantity: number;
    selectedSize: string | null;
    selectedColor: string | null;
    imageUrl: string;
  }>;
  shippingInfo: {
    name: string;
    address: string;
    city: string;
    zip: string;
    country: string;
    shippingMethod: string;
  } | null;
  createdAt: string | null;
}

export interface GuestOrderLookupPageProps {
  formatPrice?: (n: number) => string;
  className?: string;
}

/**
 * WooCommerce-style guest order tracking — the `[woocommerce_order_tracking]`
 * shortcode equivalent. Two-field form (order number + billing email),
 * delegates to the `getGuestOrder` Cloud Function in `functions-admin`.
 *
 * Pre-fills both fields from `?id=...&email=...` query params so the
 * "Track your order" link in the confirmation email lands directly on the
 * order without a re-entry step.
 *
 * Returns 404 for both missing-order and email-mismatch so the endpoint
 * can't be used to enumerate which order ids exist for an email — the UI
 * shows the same "we couldn't find that order" message in both cases.
 *
 * Added in v9.1 alongside guest checkout.
 */
export function GuestOrderLookupPage({
  formatPrice: formatPriceProp,
  className,
}: GuestOrderLookupPageProps) {
  const { functions } = useCaspianFirebase();
  const Link = useCaspianLink();
  const nav = useCaspianNavigation();
  const t = useT();
  const locale = useLocale();
  const { settings } = useScriptSettings();
  const currencyFormat = useFormatCurrency(settings.defaultCurrency);
  const formatPrice = formatPriceProp ?? ((n: number) => currencyFormat.format(n));

  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<GuestOrderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoLoad, setAutoLoad] = useState(false);

  // Pre-fill from query params — confirmation emails link directly here.
  useEffect(() => {
    const qpId = nav.searchParams?.get('id') ?? '';
    const qpEmail = nav.searchParams?.get('email') ?? '';
    if (qpId) setOrderId(qpId);
    if (qpEmail) setEmail(qpEmail);
    if (qpId && qpEmail) setAutoLoad(true);
  }, [nav.searchParams]);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orderId.trim() || !email.trim()) return;
    setLoading(true);
    setErr(null);
    setOrder(null);
    try {
      const callable = httpsCallable<
        { orderId: string; email: string },
        GuestOrderResponse
      >(functions, 'getGuestOrder');
      const result = await callable({ orderId: orderId.trim(), email: email.trim() });
      setOrder(result.data);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message.includes('not-found')
            ? t('guestOrder.notFound')
            : error.message
          : t('guestOrder.lookupFailed');
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when the page is opened via the email deep link.
  useEffect(() => {
    if (autoLoad) {
      setAutoLoad(false);
      void handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return (
    <div className={className} style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 64px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{t('guestOrder.title')}</h1>
        <p style={{ color: '#666', marginTop: 6 }}>{t('guestOrder.subtitle')}</p>
      </header>

      <form
        onSubmit={handleLookup}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 20,
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <div className="caspian-guest-order-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label htmlFor="caspian-guest-order-id">{t('guestOrder.orderNumber')}</Label>
            <Input
              id="caspian-guest-order-id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="caspian-guest-order-email">{t('guestOrder.email')}</Label>
            <Input
              id="caspian-guest-order-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Button type="submit" loading={loading} disabled={!orderId.trim() || !email.trim()}>
            {t('guestOrder.submit')}
          </Button>
        </div>
        {err && <p style={{ color: '#b91c1c', fontSize: 13, margin: 0 }}>{err}</p>}
      </form>

      {order && (
        <section
          style={{
            padding: 24,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
          }}
        >
          <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {t('guestOrder.orderHeading', { id: order.id.slice(0, 10) })}
            </h2>
            <Badge variant="secondary">{order.status}</Badge>
          </header>

          {order.createdAt && (
            <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
              {t('guestOrder.placedOn', { date: new Date(order.createdAt).toLocaleDateString(locale) })}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {order.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>{it.name}</p>
                  {(it.selectedSize || it.selectedColor) && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                      {[it.selectedColor, it.selectedSize].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                    {t('checkout.qtyShort')} {it.quantity}
                  </p>
                </div>
                <span style={{ fontWeight: 600 }}>{formatPrice(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12, fontSize: 14 }}>
            <SummaryRow label={t('cart.subtotal')} value={formatPrice(order.subtotal)} />
            <SummaryRow label={t('orderConfirmation.shipping')} value={formatPrice(order.shippingCost)} />
            {order.discount > 0 && (
              <SummaryRow label={t('orderConfirmation.discount')} value={`−${formatPrice(order.discount)}`} />
            )}
            {order.tax !== null && order.tax > 0 && (
              <SummaryRow label={t('orderConfirmation.tax')} value={formatPrice(order.tax)} />
            )}
            <SummaryRow
              label={<strong>{t('orderConfirmation.total')}</strong>}
              value={<strong>{formatPrice(order.total)}</strong>}
            />
          </div>

          {order.shippingInfo && (
            <div style={{ marginTop: 20, padding: 14, background: 'rgba(0,0,0,0.03)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('guestOrder.shippingTo')}</div>
              <div>{order.shippingInfo.name}</div>
              <div>{order.shippingInfo.address}</div>
              <div>
                {order.shippingInfo.city}, {order.shippingInfo.zip} {order.shippingInfo.country}
              </div>
              {order.shippingInfo.shippingMethod && (
                <div style={{ marginTop: 6, color: '#666' }}>
                  {t('orderConfirmation.shippingMethod')}: {order.shippingInfo.shippingMethod}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#666' }}>
        {t('guestOrder.haveAccount')} <Link href="/login">{t('guestOrder.signIn')}</Link>{' '}
        {t('guestOrder.seeAllOrders')}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
      }}
    >
      <span style={{ color: '#666' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
