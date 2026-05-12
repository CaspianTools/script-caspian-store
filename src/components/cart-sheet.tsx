'use client';

import { useEffect } from 'react';
import type { CartItem } from '../types';
import { useCart } from '../context/cart-context';
import { useCaspianImage, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { cn } from '../utils/cn';

export interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getProductHref?: (productId: string) => string;
  checkoutHref?: string;
  formatPrice?: (price: number) => string;
  className?: string;
}

export function CartSheet({
  open,
  onOpenChange,
  getProductHref = (id) => `/product/${id}`,
  checkoutHref = '/checkout',
  formatPrice = (p) => `$${p.toFixed(2)}`,
  className,
}: CartSheetProps) {
  const { items, subtotal, updateQuantity, removeFromCart } = useCart();
  const Link = useCaspianLink();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 900,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
    >
      <aside
        className={cn('caspian-cart-sheet', className)}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('cart.title', { count: items.length })}</h2>
          <button
            type="button"
            aria-label={t('cart.close')}
            onClick={() => onOpenChange(false)}
            style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>{t('cart.empty')}</p>
          ) : (
            items.map((item) => (
              <CartRow
                key={`${item.product.id}-${item.selectedSize ?? ''}-${item.selectedColor ?? ''}`}
                item={item}
                getProductHref={getProductHref}
                formatPrice={formatPrice}
                onUpdate={(n) => updateQuantity(item.product.id, n, item.selectedSize)}
                onRemove={() => removeFromCart(item.product.id, item.selectedSize)}
              />
            ))
          )}
        </div>

        {items.length > 0 && (
          <footer style={{ borderTop: '1px solid #eee', paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontWeight: 600 }}>
              <span>{t('cart.subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Button
              size="lg"
              style={{ width: '100%' }}
              onClick={() => {
                onOpenChange(false);
                // Use adapter for SPA navigation.
                if (typeof window !== 'undefined') window.location.assign(checkoutHref);
              }}
            >
              {t('cart.checkout')}
            </Button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Link href="/cart" onClick={() => onOpenChange(false)}>
                {t('cart.viewFullCart')}
              </Link>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}

function CartRow({
  item,
  getProductHref,
  formatPrice,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  getProductHref: (id: string) => string;
  formatPrice: (n: number) => string;
  onUpdate: (n: number) => void;
  onRemove: () => void;
}) {
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const t = useT();
  const img = item.product.images?.[0];
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Link href={getProductHref(item.product.slug ?? item.product.id)}>
        <div
          style={{
            position: 'relative',
            width: 72,
            height: 96,
            background: '#f5f5f5',
            borderRadius: 'var(--caspian-radius, 6px)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {img ? <Image src={img.url} alt={img.alt || item.product.name} fill /> : null}
        </div>
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={getProductHref(item.product.slug ?? item.product.id)}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0, lineHeight: 1.3 }}>{item.product.name}</p>
        </Link>
        {(item.selectedSize || item.selectedColor) && (
          <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
            {[item.selectedSize && `${t('cart.sizePrefix')} ${item.selectedSize}`, item.selectedColor]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 0' }}>{formatPrice(item.product.price)}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onUpdate(Math.max(1, Number(e.target.value) || 1))}
            style={{
              width: 56,
              padding: '4px 8px',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: 0,
              color: '#b91c1c',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {t('cart.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}
