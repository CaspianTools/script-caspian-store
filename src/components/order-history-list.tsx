'use client';

import { useEffect, useState } from 'react';
import type { Order } from '../types';
import { getOrdersByUser } from '../services/order-service';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useScriptSettings } from '../context/script-settings-context';
import { useFormatCurrency, useLocale, useT } from '../i18n/locale-context';
import { Skeleton, Badge } from '../ui/misc';

export interface OrderHistoryListProps {
  getOrderHref?: (orderId: string) => string;
  formatPrice?: (n: number) => string;
  max?: number;
  emptyMessage?: string;
  className?: string;
}

export function OrderHistoryList({
  getOrderHref = (id) => `/orders/${id}`,
  formatPrice: formatPriceProp,
  max = 50,
  emptyMessage,
  className,
}: OrderHistoryListProps) {
  const { user, loading: authLoading } = useAuth();
  const { db } = useCaspianFirebase();
  const Link = useCaspianLink();
  const t = useT();
  const locale = useLocale();
  const { settings } = useScriptSettings();
  const currencyFormat = useFormatCurrency(settings.defaultCurrency);
  const formatPrice = formatPriceProp ?? ((n: number) => currencyFormat.format(n));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const data = await getOrdersByUser(db, user.uid, max);
        if (alive) setOrders(data);
      } catch (err) {
        console.error('[caspian-store] Failed to load order history:', err);
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, user, max]);

  if (authLoading || loading) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton style={{ height: 56, width: '100%' }} />
        <Skeleton style={{ height: 56, width: '100%' }} />
        <Skeleton style={{ height: 56, width: '100%' }} />
      </div>
    );
  }

  if (!user) {
    return <p className={className} style={{ color: '#888' }}>{t('orderHistory.signInHint')}</p>;
  }

  if (failed) {
    return (
      <p className={className} role="alert" style={{ color: '#b91c1c' }}>
        {t('orderHistory.loadFailed')}
      </p>
    );
  }

  if (orders.length === 0) {
    return <p className={className} style={{ color: '#888' }}>{emptyMessage ?? t('orderHistory.empty')}</p>;
  }

  return (
    <ul className={className} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {orders.map((order) => {
        const placed = order.createdAt?.toDate ? order.createdAt.toDate() : null;
        const count = order.items.reduce((n, i) => n + i.quantity, 0);
        return (
          <li key={order.id}>
            <Link href={getOrderHref(order.id)}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  border: '1px solid #eee',
                  borderRadius: 'var(--caspian-radius, 6px)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                    {t('orderHistory.orderPrefix')}{order.id.slice(0, 10)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                    {placed?.toLocaleDateString(locale)} · {t('orderHistory.itemsCount', { count })}
                  </p>
                </div>
                <Badge variant="secondary">{order.status}</Badge>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{formatPrice(order.total)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
