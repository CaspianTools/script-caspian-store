'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { Order, OrderStatus } from '../types';
import { listAllOrders, updateOrderStatus } from '../services/order-service';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { Badge, Skeleton } from '../ui/misc';
import { Select } from '../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

type OrderView = 'table' | 'board';

export interface AdminOrdersListProps {
  getOrderHref?: (orderId: string) => string;
  formatPrice?: (n: number) => string;
  className?: string;
  /** Which view to render first — the table list or the Kanban board. Defaults to `'table'`. Added in v8.11. */
  defaultView?: OrderView;
}

// Ordered left-to-right for the board's pipeline and used as the filter list.
// `on-hold` (manual-payment orders awaiting confirmation) was missing before v8.11.
const STATUS_OPTIONS: OrderStatus[] = [
  'pending',
  'on-hold',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

// Column accent per status. Keeps the board scannable without hard-coding
// brand colors — these are status semantics, not theme.
const STATUS_ACCENT: Record<OrderStatus, string> = {
  pending: '#a16207',
  'on-hold': '#b45309',
  paid: '#15803d',
  processing: '#1d4ed8',
  shipped: '#7c3aed',
  delivered: '#0f766e',
  cancelled: '#b91c1c',
};

export function AdminOrdersList({
  getOrderHref = (id) => `/admin/orders/${id}`,
  formatPrice = (n) => `$${n.toFixed(2)}`,
  className,
  defaultView = 'table',
}: AdminOrdersListProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [view, setView] = useState<OrderView>(defaultView);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listAllOrders(db);
        if (alive) setOrders(data);
      } catch (error) {
        console.error('[caspian-store] Failed to load orders:', error);
        toast({ title: 'Failed to load orders', variant: 'destructive' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, toast]);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  // Optimistically move an order to a new status, rolling back on write failure.
  const moveOrder = async (order: Order, status: OrderStatus) => {
    if (order.status === status) return;
    const previous = order.status;
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await updateOrderStatus(db, order.id, status);
      toast({ title: `#${order.id.slice(0, 10)} → ${status}` });
    } catch (error) {
      console.error('[caspian-store] Failed to update status:', error);
      setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
      toast({ title: 'Status update failed', variant: 'destructive' });
    }
  };

  return (
    <div className={className}>
      <header
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Orders</h1>
          <p style={{ color: '#666', marginTop: 4 }}>{orders.length} total</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </header>

      {view === 'table' && (
        <div style={{ marginBottom: 12 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
            options={[
              { value: 'all', label: 'All statuses' },
              ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 40 }} />
          <Skeleton style={{ height: 40 }} />
        </div>
      ) : view === 'board' ? (
        <OrdersBoard
          orders={orders}
          getOrderHref={getOrderHref}
          formatPrice={formatPrice}
          onMove={moveOrder}
        />
      ) : filtered.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No orders match the current filter.</p>
      ) : (
        <OrdersTable orders={filtered} getOrderHref={getOrderHref} formatPrice={formatPrice} />
      )}
    </div>
  );
}

function OrdersTable({
  orders,
  getOrderHref,
  formatPrice,
}: {
  orders: Order[];
  getOrderHref: (id: string) => string;
  formatPrice: (n: number) => string;
}) {
  const Link = useCaspianLink();
  return (
    <Table>
      <THead>
        <TR>
          <TH>Order</TH>
          <TH>Customer</TH>
          <TH>Date</TH>
          <TH>Items</TH>
          <TH>Total</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <TBody>
        {orders.map((o) => {
          const placed = o.createdAt?.toDate ? o.createdAt.toDate() : null;
          const count = o.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <TR key={o.id}>
              <TD>
                <Link href={getOrderHref(o.id)}>
                  <span style={{ fontWeight: 500 }}>#{o.id.slice(0, 10)}</span>
                </Link>
              </TD>
              <TD style={{ color: '#666' }}>{o.userEmail || '—'}</TD>
              <TD style={{ color: '#888', fontSize: 13 }}>{placed?.toLocaleDateString() ?? '—'}</TD>
              <TD>{count}</TD>
              <TD>{formatPrice(o.total)}</TD>
              <TD>
                <Badge variant="secondary">{o.status}</Badge>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function OrdersBoard({
  orders,
  getOrderHref,
  formatPrice,
  onMove,
}: {
  orders: Order[];
  getOrderHref: (id: string) => string;
  formatPrice: (n: number) => string;
  onMove: (order: Order, status: OrderStatus) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, Order[]>(STATUS_OPTIONS.map((s) => [s, []]));
    for (const o of orders) map.get(o.status)?.push(o);
    return map;
  }, [orders]);

  const handleDrop = (e: DragEvent<HTMLDivElement>, status: OrderStatus) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain');
    const order = orders.find((o) => o.id === id);
    if (order) onMove(order, status);
  };

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {STATUS_OPTIONS.map((status) => {
        const columnOrders = byStatus.get(status) ?? [];
        const isOver = dragOver === status;
        const accent = STATUS_ACCENT[status];
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOver !== status) setDragOver(status);
            }}
            onDragLeave={(e) => {
              // Ignore leaves into child nodes; only clear when leaving the column.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOver((s) => (s === status ? null : s));
              }
            }}
            onDrop={(e) => handleDrop(e, status)}
            style={{
              width: 264,
              flexShrink: 0,
              background: isOver ? 'rgba(0,0,0,0.04)' : '#fafafa',
              border: `1px solid ${isOver ? accent : '#eee'}`,
              borderRadius: 'var(--caspian-radius, 8px)',
              padding: 10,
              transition: 'border-color 120ms, background 120ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '2px 4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {status}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{columnOrders.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
              {columnOrders.length === 0 ? (
                <p style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: '16px 0', margin: 0 }}>
                  {isOver ? 'Drop here' : 'No orders'}
                </p>
              ) : (
                columnOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    href={getOrderHref(o.id)}
                    formatPrice={formatPrice}
                    dragging={draggingId === o.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', o.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(o.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOver(null);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({
  order,
  href,
  formatPrice,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  order: Order;
  href: string;
  formatPrice: (n: number) => string;
  dragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const Link = useCaspianLink();
  const placed = order.createdAt?.toDate ? order.createdAt.toDate() : null;
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 6px)',
        padding: 10,
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <Link href={href}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>#{order.id.slice(0, 10)}</span>
      </Link>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 12,
          color: '#666',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {order.userEmail || '—'}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#888' }}>
        <span>{placed?.toLocaleDateString() ?? '—'}</span>
        <span>
          {count} item{count === 1 ? '' : 's'} · <strong style={{ color: '#444' }}>{formatPrice(order.total)}</strong>
        </span>
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: OrderView; onChange: (v: OrderView) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Orders view"
      style={{
        display: 'inline-flex',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: 'var(--caspian-radius, 6px)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {(['table', 'board'] as const).map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              border: 0,
              cursor: 'pointer',
              background: active ? 'var(--caspian-primary, #111)' : '#fff',
              color: active ? 'var(--caspian-primary-foreground, #fff)' : 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
