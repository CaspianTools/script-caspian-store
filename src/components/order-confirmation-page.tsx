'use client';

import { useEffect, useRef, useState } from 'react';
import type { Order } from '../types';
import { getOrderById, getOrderByStripeSession, isStripeSessionId } from '../services/order-service';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { useScriptSettings } from '../context/script-settings-context';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useFormatCurrency, useLocale, useT } from '../i18n/locale-context';
import { Skeleton, Separator, Badge } from '../ui/misc';
import { cn } from '../utils/cn';

const MAX_POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 1500;

export interface OrderConfirmationPageProps {
  /**
   * The order to show: either the order document id (manual-payment flows
   * redirect with it) or a Stripe Checkout session id (`cs_…`, the success
   * URL's `session_id`). A session id is resolved to the order the webhook
   * wrote for it, since orders are keyed by `H{timestamp}`, not session id.
   */
  orderId: string;
  continueHref?: string;
  formatPrice?: (n: number) => string;
  className?: string;
}

export function OrderConfirmationPage({
  orderId,
  continueHref = '/',
  formatPrice: formatPriceProp,
  className,
}: OrderConfirmationPageProps) {
  const { db } = useCaspianFirebase();
  const Link = useCaspianLink();
  const t = useT();
  const locale = useLocale();
  const { settings } = useScriptSettings();
  const { clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const currencyFormat = useFormatCurrency(settings.defaultCurrency);
  const formatPrice = formatPriceProp ?? ((n: number) => currencyFormat.format(n));
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const clearedFor = useRef<string | null>(null);

  // The webhook creates the order document asynchronously — we may need to
  // poll briefly after returning from the payment provider. The attempt
  // counter lives inside the effect: React state would be read through a
  // stale closure and never stop the loop.
  useEffect(() => {
    const bySession = isStripeSessionId(orderId);
    // A session lookup queries by owner, so it needs the signed-in uid; auth
    // restores asynchronously after the redirect back from Stripe.
    if (bySession && authLoading) return;
    let alive = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const o = bySession
          ? uid
            ? await getOrderByStripeSession(db, uid, orderId)
            : null
          : await getOrderById(db, orderId);
        if (!alive) return;
        if (o) {
          setOrder(o);
          setLoading(false);
        } else if (attempts < MAX_POLL_ATTEMPTS) {
          attempts += 1;
          timer = setTimeout(load, POLL_INTERVAL_MS);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('[caspian-store] Failed to load order:', error);
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [db, orderId, uid, authLoading]);

  // The checkout hook leaves the cart intact so a cancelled hosted payment
  // returns to a full cart; the order document existing is the signal that
  // the purchase went through. Guarded per order id so a re-render (or
  // StrictMode's double effect) clears once.
  useEffect(() => {
    if (!order || clearedFor.current === order.id) return;
    clearedFor.current = order.id;
    clearCart();
  }, [order, clearCart]);

  if (loading) {
    return (
      <div className={className} style={{ padding: 24 }}>
        <Skeleton style={{ height: 28, width: 240 }} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 14, width: '60%' }} />
          <Skeleton style={{ height: 14, width: '40%' }} />
          <Skeleton style={{ height: 14, width: '50%' }} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={className} style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {t('orderConfirmation.stillProcessing.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 8 }}>
          {t('orderConfirmation.stillProcessing.subtitle')}
        </p>
        <p style={{ color: '#888', fontSize: 13, marginTop: 16 }}>
          {t('orderConfirmation.orderIdLabel', { id: orderId })}
        </p>
      </div>
    );
  }

  const placedAt = order.createdAt?.toDate ? order.createdAt.toDate() : null;

  return (
    <div
      className={cn('caspian-page-gutter', className)}
      style={{ maxWidth: 760, margin: '0 auto', padding: '32px clamp(16px, 4vw, 24px) 64px' }}
    >
      <header style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(24px, 6vw, 28px)', fontWeight: 700, margin: 0 }}>
          {t('orderConfirmation.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 6 }}>
          {t('orderConfirmation.emailConfirmation', {
            email: order.userEmail || t('orderConfirmation.defaultEmail'),
          })}
        </p>
        <p
          style={{
            color: '#888',
            fontSize: 13,
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {t('orderConfirmation.orderLine', { id: order.id.slice(0, 10) })}
          <Badge variant="secondary">{order.status}</Badge>
          {placedAt && ` · ${placedAt.toLocaleDateString(locale)}`}
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{t('orderConfirmation.items')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>{item.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                  {item.selectedSize && `${t('cart.sizePrefix')} ${item.selectedSize} · `}
                  {t('checkout.qtyShort')} {item.quantity}
                </p>
              </div>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <Separator />
        <SummaryRow label={t('cart.subtotal')} value={formatPrice(order.subtotal)} />
        {order.shippingCost > 0 && (
          <SummaryRow label={t('orderConfirmation.shipping')} value={formatPrice(order.shippingCost)} />
        )}
        {order.discount > 0 && (
          <SummaryRow label={t('orderConfirmation.discount')} value={`−${formatPrice(order.discount)}`} />
        )}
        {typeof order.tax === 'number' && order.tax > 0 && (
          <SummaryRow label={t('orderConfirmation.tax')} value={formatPrice(order.tax)} />
        )}
        <SummaryRow label={t('orderConfirmation.total')} value={formatPrice(order.total)} strong />
      </section>

      {(order.payment?.method || order.shippingInfo?.shippingMethod) && (
        <section style={{ ...sectionStyle, marginTop: 16 }}>
          <h2 style={h2Style}>{t('orderConfirmation.details')}</h2>
          {order.payment?.method && (
            <SummaryRow
              label={t('orderConfirmation.paymentMethod')}
              value={t(`orderConfirmation.paymentMethod.${order.payment.method}`)}
            />
          )}
          {order.shippingInfo?.shippingMethod && (
            <SummaryRow
              label={t('orderConfirmation.shippingMethod')}
              value={order.shippingInfo.shippingMethod}
            />
          )}
        </section>
      )}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link href={continueHref}>{t('orderConfirmation.continueShopping')}</Link>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        fontSize: strong ? 16 : 14,
        fontWeight: strong ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  padding: 'clamp(16px, 4vw, 20px)',
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
};
const h2Style: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 12 };
