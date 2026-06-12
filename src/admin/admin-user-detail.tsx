'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import type { ContactSubmission, Order, OrderStatus, Product, CartItemRef, UserProfile } from '../types';
import { getUserById } from '../services/user-service';
import { getOrdersByUser } from '../services/order-service';
import { loadUserCart } from '../services/cart-service';
import { getProductsByIds } from '../services/product-service';
import { getContactsByUser } from '../services/contact-service';
import { reportServiceError } from '../services/error-log-service';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useAuth } from '../context/auth-context';
import { useT } from '../i18n/locale-context';
import { useToast } from '../ui/toast';
import { Badge, Skeleton, Avatar } from '../ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// Statuses that count as a completed purchase for the lifetime-spend total.
const PURCHASED_STATUSES: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered'];

interface CartLine extends CartItemRef {
  product: Product | null;
}

export interface AdminUserDetailProps {
  userId: string;
  formatPrice?: (n: number) => string;
  className?: string;
}

/**
 * Per-user detail view (admin). Loads the profile, order history, live cart,
 * wishlist, and contact messages for one account and lays them out as tabbed
 * read-only cards, with an inline promote/demote control and contact
 * quick-actions. Cart + wishlist product ids are resolved in a single batched
 * lookup; the live cart read requires the admin-read carts rule (see
 * firestore.rules). Messages are matched by stored `userId` and by email.
 */
export function AdminUserDetail({
  userId,
  formatPrice = (n) => `$${n.toFixed(2)}`,
  className,
}: AdminUserDetailProps) {
  const { db, functions } = useCaspianFirebase();
  const Link = useCaspianLink();
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [role, setRole] = useState<'admin' | 'customer'>('customer');
  const [roleBusy, setRoleBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const p = await getUserById(db, userId);
        if (!alive) return;
        if (!p) {
          setNotFound(true);
          return;
        }
        setProfile(p);
        setRole(p.role ?? 'customer');

        const [ordersList, cartRefs, messageList] = await Promise.all([
          getOrdersByUser(db, userId).catch((e) => {
            reportServiceError(db, 'admin-user-detail.orders', e);
            return [] as Order[];
          }),
          loadUserCart(db, userId).catch((e) => {
            reportServiceError(db, 'admin-user-detail.cart', e);
            return [] as CartItemRef[];
          }),
          getContactsByUser(db, { userId, email: p.email }).catch((e) => {
            reportServiceError(db, 'admin-user-detail.messages', e);
            return [] as ContactSubmission[];
          }),
        ]);
        if (!alive) return;
        setOrders(ordersList);
        setMessages(messageList);

        // Resolve cart + wishlist product ids in one batched lookup.
        const wishIds = p.wishlist ?? [];
        const allIds = Array.from(new Set([...cartRefs.map((c) => c.productId), ...wishIds]));
        const products = allIds.length
          ? await getProductsByIds(db, allIds).catch((e) => {
              reportServiceError(db, 'admin-user-detail.products', e);
              return [] as Product[];
            })
          : [];
        if (!alive) return;
        const byId = new Map(products.map((pr) => [pr.id, pr] as const));
        setCart(cartRefs.map((c) => ({ ...c, product: byId.get(c.productId) ?? null })));
        setWishlist(wishIds.map((id) => byId.get(id)).filter((x): x is Product => Boolean(x)));
      } catch (error) {
        reportServiceError(db, 'admin-user-detail.load', error);
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, userId]);

  const stats = useMemo(() => {
    const purchased = orders.filter((o) => PURCHASED_STATUSES.includes(o.status));
    const lifetimeSpend = purchased.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const lastOrder = tsToDate(orders[0]?.createdAt);
    return { orderCount: orders.length, lifetimeSpend, lastOrder };
  }, [orders]);

  const defaultAddress = useMemo(() => {
    const addrs = profile?.addresses ?? [];
    return addrs.find((a) => a.isDefault) ?? addrs[0] ?? null;
  }, [profile]);

  const isSelf = !!user && !!profile && profile.uid === user.uid;

  const runRoleChange = async (action: 'promote' | 'demote') => {
    if (!profile) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        action === 'promote'
          ? t('admin.users.action.confirmPromote')
          : t('admin.users.action.confirmDemote'),
      );
      if (!ok) return;
    }
    setRoleBusy(true);
    try {
      const name = action === 'promote' ? 'promoteUserToAdmin' : 'demoteAdminToCustomer';
      await httpsCallable(functions, name)({ uid: profile.uid });
      setRole(action === 'promote' ? 'admin' : 'customer');
      toast({ title: action === 'promote' ? 'Promoted to admin' : 'Removed admin role' });
    } catch (error) {
      reportServiceError(db, `admin-user-detail.${action}`, error);
      toast({ title: 'Action failed', variant: 'destructive' });
    } finally {
      setRoleBusy(false);
    }
  };

  const copy = async (text: string, doneLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: doneLabel });
    } catch {
      /* clipboard unavailable (insecure context, denied permission) */
    }
  };

  const formatDay = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 24, width: 260 }} />
        <Skeleton style={{ height: 14, width: '50%' }} />
        <Skeleton style={{ height: 120 }} />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className={className}>
        <Link href="/admin/users" style={backLinkStyle}>
          ← {t('admin.users.detail.back')}
        </Link>
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>
          {t('admin.users.detail.notFound')}
        </p>
      </div>
    );
  }

  const joined = tsToDate(profile.createdAt);
  const addresses = profile.addresses ?? [];

  return (
    <div className={className}>
      <Link href="/admin/users" style={backLinkStyle}>
        ← {t('admin.users.detail.back')}
      </Link>

      <header style={{ display: 'flex', gap: 16, alignItems: 'center', margin: '12px 0 16px' }}>
        <Avatar src={profile.photoURL} fallback={profile.displayName || profile.email} size={56} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {profile.displayName || profile.email}
          </h1>
          <p
            style={{
              color: '#666',
              margin: '4px 0 0',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              fontSize: 13,
            }}
          >
            <Badge variant={role === 'admin' ? 'secondary' : 'outline'}>
              {role === 'admin' ? t('admin.users.role.staff') : t('admin.users.role.customer')}
            </Badge>
            <span>{profile.email}</span>
            {profile.phone && <span>· {profile.phone}</span>}
          </p>
        </div>
      </header>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a style={actionBtnStyle} href={`mailto:${profile.email}`}>
            {t('admin.users.detail.emailAction')}
          </a>
          <button
            type="button"
            style={actionBtnStyle}
            onClick={() => copy(profile.email, t('admin.users.detail.copiedEmail'))}
          >
            {t('admin.users.detail.copyEmail')}
          </button>
          <button
            type="button"
            style={actionBtnStyle}
            onClick={() => copy(profile.uid, t('admin.users.detail.copiedUid'))}
          >
            {t('admin.users.detail.copyUid')}
          </button>
          {!isSelf &&
            (role === 'admin' ? (
              <button
                type="button"
                style={actionBtnStyle}
                disabled={roleBusy}
                onClick={() => runRoleChange('demote')}
              >
                {t('admin.users.action.demote')}
              </button>
            ) : (
              <button
                type="button"
                style={actionBtnStyle}
                disabled={roleBusy}
                onClick={() => runRoleChange('promote')}
              >
                {t('admin.users.action.promote')}
              </button>
            ))}
        </div>
      </section>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t('admin.users.detail.tab.details')}</TabsTrigger>
          <TabsTrigger value="orders">{t('admin.users.detail.tab.orders')}</TabsTrigger>
          <TabsTrigger value="cart">{t('admin.users.detail.tab.cart')}</TabsTrigger>
          <TabsTrigger value="wishlist">{t('admin.users.detail.tab.wishlist')}</TabsTrigger>
          <TabsTrigger value="addresses">{t('admin.users.detail.tab.addresses')}</TabsTrigger>
          <TabsTrigger value="messages">{t('admin.users.detail.tab.messages')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <section style={sectionStyle}>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <Stat label={t('admin.users.detail.joined')} value={joined ? formatDay(joined) : '—'} />
              <Stat label={t('admin.users.detail.country')} value={defaultAddress?.country || '—'} />
              <Stat label={t('admin.users.detail.orderCount')} value={String(stats.orderCount)} />
              <Stat
                label={t('admin.users.detail.lifetimeSpend')}
                value={formatPrice(stats.lifetimeSpend)}
              />
              <Stat
                label={t('admin.users.detail.lastOrder')}
                value={stats.lastOrder ? formatDay(stats.lastOrder) : '—'}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="orders">
          <section style={sectionStyle}>
            {orders.length === 0 ? (
              <p style={emptyStyle}>{t('admin.users.detail.ordersEmpty')}</p>
            ) : (
              orders.map((o) => {
                const placed = tsToDate(o.createdAt);
                return (
                  <div
                    key={o.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 600 }}>
                        #{o.id.slice(0, 10)}
                      </Link>
                      <Badge variant="secondary">{o.status}</Badge>
                      {placed && (
                        <span style={{ color: '#888', fontSize: 12 }}>
                          {placed.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 600 }}>{formatPrice(o.total)}</span>
                  </div>
                );
              })
            )}
          </section>
        </TabsContent>

        <TabsContent value="cart">
          <section style={sectionStyle}>
            {cart.length === 0 ? (
              <p style={emptyStyle}>{t('admin.users.detail.cartEmpty')}</p>
            ) : (
              cart.map((line, i) => {
                const price = line.product ? line.product.price : 0;
                return (
                  <div
                    key={`${line.productId}-${i}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}
                  >
                    <ProductThumb product={line.product} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>
                        {line.product?.name ?? t('admin.users.detail.productUnavailable')}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                        {line.selectedSize &&
                          `${t('admin.users.detail.size')} ${line.selectedSize} · `}
                        {line.selectedColor && `${line.selectedColor} · `}
                        {t('admin.users.detail.qty')} {line.quantity}
                      </p>
                    </div>
                    {line.product && (
                      <span style={{ fontWeight: 600 }}>{formatPrice(price * line.quantity)}</span>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </TabsContent>

        <TabsContent value="wishlist">
          <section style={sectionStyle}>
            {wishlist.length === 0 ? (
              <p style={emptyStyle}>{t('admin.users.detail.wishlistEmpty')}</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {wishlist.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/products/${p.id}/edit`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                  >
                    <ProductThumb product={p} />
                    <span>{p.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="addresses">
          <section style={sectionStyle}>
            {addresses.length === 0 ? (
              <p style={emptyStyle}>{t('admin.users.detail.addressesEmpty')}</p>
            ) : (
              addresses.map((a) => (
                <div key={a.id} style={{ fontSize: 14, padding: '6px 0' }}>
                  <strong>{a.name}</strong>
                  {a.isDefault && (
                    <span style={{ marginLeft: 8 }}>
                      <Badge variant="outline">{t('admin.users.detail.default')}</Badge>
                    </span>
                  )}
                  <div style={{ color: '#555' }}>
                    {a.address}, {a.city} {a.zip}, {a.country}
                  </div>
                </div>
              ))
            )}
          </section>
        </TabsContent>

        <TabsContent value="messages">
          <section style={sectionStyle}>
            {messages.length === 0 ? (
              <p style={emptyStyle}>{t('admin.users.detail.messagesEmpty')}</p>
            ) : (
              messages.map((m) => {
                const sent = tsToDate(m.createdAt);
                return (
                  <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 4,
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>
                        {m.subject || t('admin.users.detail.messageNoSubject')}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge variant="secondary">{t(`admin.contacts.status.${m.status}`)}</Badge>
                        {sent && (
                          <span style={{ color: '#888', fontSize: 12 }}>
                            {sent.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' }}>
                      {m.message}
                    </p>
                  </div>
                );
              })
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Safely convert a Firestore Timestamp (or missing value) to a Date. */
function tsToDate(ts: { toDate: () => Date } | undefined | null): Date | null {
  return ts ? ts.toDate() : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ProductThumb({ product }: { product: Product | null }) {
  const url = product?.images?.[0]?.url;
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 6,
        background: '#f2f2f2',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-block',
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </span>
  );
}

const sectionStyle: React.CSSProperties = {
  padding: 16,
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
  marginBottom: 16,
};
const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 'var(--caspian-radius, 6px)',
  background: '#fff',
  color: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};
const emptyStyle: React.CSSProperties = { color: '#888', margin: 0, fontSize: 14 };
const backLinkStyle: React.CSSProperties = { fontSize: 13, color: 'var(--a-muted, #666)' };
