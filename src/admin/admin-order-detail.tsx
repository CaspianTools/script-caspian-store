'use client';

import { useEffect, useState } from 'react';
import type { Order, OrderStatus } from '../types';
import { getOrderById, updateOrderStatus } from '../services/order-service';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Select } from '../ui/select';
import { Skeleton, Separator, Badge } from '../ui/misc';
import { useToast } from '../ui/toast';
import { ORDER_STATUSES } from './order-statuses';

export interface AdminOrderDetailProps {
  orderId: string;
  formatPrice?: (n: number) => string;
  /** Where the back link points. Default: `/admin/orders`. */
  ordersHref?: string;
  className?: string;
}

export function AdminOrderDetail({
  orderId,
  formatPrice = (n) => `$${n.toFixed(2)}`,
  ordersHref = '/admin/orders',
  className,
}: AdminOrderDetailProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const Link = useCaspianLink();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await getOrderById(db, orderId);
        if (alive) setOrder(o);
      } catch (error) {
        console.error('[caspian-store] Failed to load order:', error);
        if (alive) toast({ title: t('admin.loadFailed'), variant: 'destructive' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, orderId]);

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setSavingStatus(true);
    try {
      await updateOrderStatus(db, order.id, status);
      setOrder({ ...order, status });
      toast({ title: `Status set to ${status}` });
    } catch (error) {
      console.error('[caspian-store] Failed to update status:', error);
      toast({ title: 'Status update failed', variant: 'destructive' });
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 24, width: 260 }} />
        <Skeleton style={{ height: 14, width: '60%' }} />
        <Skeleton style={{ height: 14, width: '40%' }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className={className}>
        <Link href={ordersHref} style={backLinkStyle}>
          ← {t('admin.orders.backToOrders')}
        </Link>
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>Order not found.</p>
      </div>
    );
  }

  const placed = order.createdAt?.toDate ? order.createdAt.toDate() : null;
  const orderNotes = order.shippingInfo?.orderNotes?.trim();

  return (
    <div className={className}>
      <Link href={ordersHref} style={backLinkStyle}>
        ← {t('admin.orders.backToOrders')}
      </Link>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Order #{order.id.slice(0, 10)}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          {order.userEmail || '—'}
          {placed && ` · ${placed.toLocaleString()}`}
        </p>
      </header>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge variant="secondary">{order.status}</Badge>
          <span style={{ fontSize: 13, color: '#666' }}>Change:</span>
          <Select
            disabled={savingStatus}
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Items</h2>
        {order.items.map((item, i) => (
          <div
            key={i}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{item.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                {item.selectedSize && `Size ${item.selectedSize} · `}Qty {item.quantity} · {formatPrice(item.price)}
              </p>
            </div>
            <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity)}</span>
          </div>
        ))}
        <Separator />
        <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
        {order.shippingCost > 0 && <SummaryRow label="Shipping" value={formatPrice(order.shippingCost)} />}
        {(order.tax ?? 0) > 0 && <SummaryRow label="Tax" value={formatPrice(order.tax ?? 0)} />}
        {order.discount > 0 && (
          <SummaryRow
            label={order.promoCode ? `Discount (${order.promoCode})` : 'Discount'}
            value={`−${formatPrice(order.discount)}`}
          />
        )}
        <SummaryRow label="Total" value={formatPrice(order.total)} strong />
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Payment</h2>
        <SummaryRow label="Method" value={order.payment?.method ?? 'stripe'} />
        {order.payment?.last4 && (
          <SummaryRow
            label="Card"
            value={`${order.payment.brand ? `${order.payment.brand} ` : ''}•••• ${order.payment.last4}`}
          />
        )}
        {order.promoCode && <SummaryRow label="Promo code" value={order.promoCode} />}
      </section>

      {order.shippingInfo && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Shipping</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            {order.shippingInfo.name}
            <br />
            {order.shippingInfo.address}
            <br />
            {order.shippingInfo.city} {order.shippingInfo.zip}
            <br />
            {order.shippingInfo.country}
          </p>
          {order.shippingInfo.shippingMethod && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#666' }}>
              Method: {order.shippingInfo.shippingMethod}
            </p>
          )}
          {orderNotes && (
            <p style={{ margin: '8px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#666' }}>Order notes: </span>
              {orderNotes}
            </p>
          )}
        </section>
      )}
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

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: 12,
  fontSize: 13,
  color: '#666',
  textDecoration: 'none',
};
const sectionStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
  marginBottom: 16,
};
const h2Style: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 12 };
