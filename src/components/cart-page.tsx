'use client';

import { useState } from 'react';
import type { CartItem } from '../types';
import { useCart } from '../context/cart-context';
import { useCaspianImage, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';

export interface CartPageProps {
  /** Link factory for product titles + thumbnails. Default: `/product/{id}`. */
  getProductHref?: (productId: string) => string;
  /** Where the "Proceed to checkout" button navigates. Default: `/checkout`. */
  checkoutHref?: string;
  /** Where "Continue Shopping" navigates. Default: `/products`. */
  continueHref?: string;
  /** Price formatter. Default: `$x.xx`. */
  formatPrice?: (n: number) => string;
  className?: string;
}

/**
 * Full-page shopping-cart review at `/cart`. Two-column layout: left is a
 * stack of item cards (thumbnail + name + variant + quantity pill + price +
 * remove), right is a sticky order summary with promo-code input and a
 * Proceed-to-checkout CTA. Mount it in your consumer app under `/cart`.
 *
 * The `<CartSheet>` drawer is preserved for quick peeks — clicking the cart
 * icon can still open the drawer; the drawer's "View full cart" link points
 * here.
 */
export function CartPage({
  getProductHref = (id) => `/product/${id}`,
  checkoutHref = '/checkout',
  continueHref = '/products',
  formatPrice = (n) => `$${n.toFixed(2)}`,
  className,
}: CartPageProps) {
  const { items, subtotal, updateQuantity, removeFromCart } = useCart();
  const Link = useCaspianLink();
  const t = useT();

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    // Storefront-side promo validation happens at checkout against the
    // `promoCodes` collection. On this page we only stash the code so it
    // shows as "applied" and carries into checkout.
    setAppliedPromo(code);
    setPromoInput('');
  };

  const clearPromo = () => {
    setAppliedPromo(null);
  };

  if (items.length === 0) {
    return (
      <div className={className} style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{t('cart.page.title')}</h1>
        <div
          style={{
            marginTop: 40,
            padding: 48,
            textAlign: 'center',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ color: '#666', fontSize: 16, margin: '0 0 24px' }}>{t('cart.empty')}</p>
          <Link href={continueHref}>
            <span
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: 'var(--caspian-primary, #111)',
                color: 'var(--caspian-primary-foreground, #fff)',
                borderRadius: 'var(--caspian-radius, 8px)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t('cart.page.continueShopping')}
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
          {t('cart.page.title')}
        </h1>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map((item) => (
            <CartItemCard
              key={`${item.product.id}-${item.selectedSize ?? ''}-${item.selectedColor ?? ''}`}
              item={item}
              getProductHref={getProductHref}
              formatPrice={formatPrice}
              onUpdate={(n) => updateQuantity(item.product.id, n, item.selectedSize)}
              onRemove={() => removeFromCart(item.product.id, item.selectedSize)}
              t={t}
            />
          ))}

          <div style={{ paddingTop: 12 }}>
            <Link href={continueHref}>
              <span style={{ fontSize: 14, color: '#333' }}>
                ← {t('cart.page.continueShopping')}
              </span>
            </Link>
          </div>
        </section>

        <aside style={{ position: 'sticky', top: 24 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.05)',
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              {t('cart.page.orderSummary')}
            </h2>

            <div
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 12 }}
            >
              <span>{t('cart.subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                color: '#666',
                marginBottom: 20,
              }}
            >
              <span>{t('cart.page.shipping')}</span>
              <span>{t('cart.page.shippingCalculated')}</span>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 16, marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                <span>{t('cart.page.total')}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#666',
                  marginBottom: 8,
                }}
              >
                {t('cart.page.promoCode')}
              </label>
              {appliedPromo ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.04)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span>
                    <strong>{appliedPromo}</strong> · {t('cart.page.promoAppliedAtCheckout')}
                  </span>
                  <button
                    type="button"
                    onClick={clearPromo}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: '#555',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder={t('cart.page.promoPlaceholder')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                      background: '#fafafa',
                    }}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={!promoInput.trim()}
                    style={{
                      padding: '10px 16px',
                      background: 'rgba(0,0,0,0.05)',
                      color: '#111',
                      border: 0,
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: promoInput.trim() ? 'pointer' : 'not-allowed',
                      opacity: promoInput.trim() ? 1 : 0.5,
                    }}
                  >
                    {t('cart.page.apply')}
                  </button>
                </div>
              )}
            </div>

            <Link href={appliedPromo ? `${checkoutHref}?promo=${encodeURIComponent(appliedPromo)}` : checkoutHref}>
              <Button size="lg" style={{ width: '100%' }}>
                {t('cart.page.proceedToCheckout')}
              </Button>
            </Link>

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
              }}
            >
              <LockIcon /> {t('cart.page.secureCheckout')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CartItemCard({
  item,
  getProductHref,
  formatPrice,
  onUpdate,
  onRemove,
  t,
}: {
  item: CartItem;
  getProductHref: (id: string) => string;
  formatPrice: (n: number) => string;
  onUpdate: (n: number) => void;
  onRemove: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const img = item.product.images?.[0];
  const variantLine = [item.selectedColor, item.selectedSize].filter(Boolean).join(' / ');

  return (
    <article
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '120px minmax(0, 1fr) auto',
        gap: 20,
        padding: 20,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <Link href={getProductHref(item.product.slug ?? item.product.id)}>
        <div
          style={{
            position: 'relative',
            width: 120,
            height: 120,
            background: '#f5f5f5',
            borderRadius: 8,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {img ? <Image src={img.url} alt={img.alt || item.product.name} fill /> : null}
        </div>
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <Link href={getProductHref(item.product.slug ?? item.product.id)}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111' }}>
            {item.product.name}
          </h3>
        </Link>
        {variantLine && (
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{variantLine}</p>
        )}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 999,
            width: 'fit-content',
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => onUpdate(Math.max(1, item.quantity - 1))}
            aria-label={t('cart.page.decreaseQty')}
            style={qtyBtnStyle}
          >
            −
          </button>
          <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>{item.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdate(item.quantity + 1)}
            aria-label={t('cart.page.increaseQty')}
            style={qtyBtnStyle}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 600 }}>
        {formatPrice(item.product.price * item.quantity)}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={t('cart.remove')}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 0,
          borderRadius: 4,
          color: '#888',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </article>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 0,
  fontSize: 14,
  cursor: 'pointer',
  color: '#333',
  padding: 0,
};

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2.5" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1" />
      <path
        d="M4 5V3.5a2 2 0 0 1 4 0V5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
