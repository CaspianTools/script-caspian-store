'use client';

import { useEffect, useState } from 'react';
import type { Order } from '../types';
import { getOrderById } from '../services/order-service';
import { useAuth } from '../context/auth-context';
import { useScriptSettings } from '../context/script-settings-context';
import { useCaspianFirebase, useCaspianImage, useCaspianLink } from '../provider/caspian-store-provider';
import { useFormatCurrency, useLocale, useT } from '../i18n/locale-context';
import { Skeleton, Separator, Badge } from '../ui/misc';
import { cn } from '../utils/cn';
import { OrderStatusTimeline } from './order-status-timeline';

export interface OrderDetailPageProps {
  orderId: string;
  /** Where "Back to orders" points. Default: the account page's orders section. */
  backHref?: string;
  formatPrice?: (n: number) => string;
  className?: string;
}

/**
 * A shopper's view of one of their orders at `/orders/:id` — the page
 * `<OrderHistoryList>` links every row to. Status timeline, items, totals
 * (with the promo code that earned the discount), delivery address and
 * payment method. Firestore rules only let the owner (or an admin) read an
 * order, so anyone else sees "not found" rather than a permission error.
 */
export function OrderDetailPage({
  orderId,
  backHref = '/account?section=orders',
  formatPrice: formatPriceProp,
  className,
}: OrderDetailPageProps) {
  const { db } = useCaspianFirebase();
  const Link = useCaspianLink();
  const Image = useCaspianImage();
  const t = useT();
  const locale = useLocale();
  const { settings } = useScriptSettings();
  const { user, loading: authLoading } = useAuth();
  const currencyFormat = useFormatCurrency(settings.defaultCurrency);
  const formatPrice = formatPriceProp ?? ((n: number) => currencyFormat.format(n));
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = user?.uid ?? null;
  useEffect(() => {
    if (authLoading) return undefined;
    if (!uid) {
      setOrder(null);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    getOrderById(db, orderId)
      .then((o) => {
        if (alive) setOrder(o);
      })
      .catch(() => {
        // Permission denied (not the owner) reads the same as a missing order.
        if (alive) setOrder(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, orderId, uid, authLoading]);

  const wrapStyle: React.CSSProperties = {
    maxWidth: 760,
    margin: '0 auto',
    padding: '32px clamp(16px, 4vw, 24px) 64px',
  };

  if (loading) {
    return (
      <div className={cn('caspian-page-gutter', className)} style={wrapStyle}>
        <Skeleton style={{ height: 28, width: 240 }} />
        <Skeleton style={{ height: 40, width: '100%', marginTop: 24 }} />
        <Skeleton style={{ height: 160, width: '100%', marginTop: 16 }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className={cn('caspian-page-gutter', className)} style={{ ...wrapStyle, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('orderDetail.notFound')}</h1>
        <p style={{ color: '#666', marginTop: 8 }}>
          {uid ? t('orderDetail.notFoundHint') : t('orderHistory.signInHint')}
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href={uid ? backHref : '/login'}>{uid ? t('orderDetail.back') : t('orderDetail.signIn')}</Link>
        </p>
      </div>
    );
  }

  const placedAt = order.createdAt?.toDate ? order.createdAt.toDate() : null;
  const ship = order.shippingInfo;

  return (
    <div className={cn('caspian-page-gutter', className)} style={wrapStyle}>
      <p style={{ margin: '0 0 16px', fontSize: 14 }}>
        <Link href={backHref}>← {t('orderDetail.back')}</Link>
      </p>
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 'clamp(22px, 5vw, 26px)',
            fontWeight: 700,
            margin: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {t('orderDetail.title', { id: order.id })}
          <Badge variant="secondary">{t(`order.status.${order.status}`)}</Badge>
        </h1>
        {placedAt && (
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            {t('orderDetail.placedOn', { date: placedAt.toLocaleDateString(locale) })}
          </p>
        )}
      </header>

      <section style={{ ...sectionStyle, marginBottom: 16 }}>
        <OrderStatusTimeline status={order.status} />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>{t('orderConfirmation.items')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: 14, alignItems: 'center' }}>
              {item.imageUrl && (
                <span
                  style={{
                    position: 'relative',
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    overflow: 'hidden',
                    borderRadius: 'var(--caspian-radius, 6px)',
                    background: 'rgba(0,0,0,0.04)',
                  }}
                >
                  <Image src={item.imageUrl} alt={item.name} fill />
                </span>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>{item.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                  {item.selectedColor && `${t('product.color')}: ${item.selectedColor} · `}
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
          <SummaryRow
            label={
              order.promoCode
                ? t('orderDetail.discountWithCode', { code: order.promoCode })
                : t('orderConfirmation.discount')
            }
            value={`−${formatPrice(order.discount)}`}
          />
        )}
        {typeof order.tax === 'number' && order.tax > 0 && (
          <SummaryRow label={t('orderConfirmation.tax')} value={formatPrice(order.tax)} />
        )}
        <SummaryRow label={t('orderConfirmation.total')} value={formatPrice(order.total)} strong />
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        {ship?.address && (
          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('orderDetail.deliverTo')}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {ship.name}
              <br />
              {ship.address}
              <br />
              {[ship.zip, ship.city].filter(Boolean).join(' ')}
              {ship.country && (
                <>
                  <br />
                  {ship.country}
                </>
              )}
            </p>
            {ship.orderNotes && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#666' }}>
                <strong>{t('orderDetail.notes')}:</strong> {ship.orderNotes}
              </p>
            )}
          </section>
        )}
        {(order.payment?.method || ship?.shippingMethod) && (
          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('orderConfirmation.details')}</h2>
            {order.payment?.method && (
              <SummaryRow
                label={t('orderConfirmation.paymentMethod')}
                value={t(`orderConfirmation.paymentMethod.${order.payment.method}`)}
              />
            )}
            {ship?.shippingMethod && (
              <SummaryRow label={t('orderConfirmation.shippingMethod')} value={ship.shippingMethod} />
            )}
          </section>
        )}
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
        gap: 12,
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
