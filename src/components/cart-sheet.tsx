'use client';

import { useEffect, useRef } from 'react';
import type { CartItem } from '../types';
import { useCart } from '../context/cart-context';
import { useCaspianImage, useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { XIcon } from '../ui/icons';
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
  const nav = useCaspianNavigation();
  const t = useT();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // Ref so the effect below keys on `open` only; the header passes an inline
  // setter that changes identity every render.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChangeRef.current(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="caspian-cart-sheet-overlay"
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
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('cart.title', { count: items.length })}
        className={cn('caspian-cart-sheet', className)}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('cart.title', { count: items.length })}</h2>
          <button
            ref={closeRef}
            type="button"
            className="caspian-dialog-close"
            aria-label={t('cart.close')}
            onClick={() => onOpenChange(false)}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 0,
              borderRadius: 999,
              color: '#666',
              cursor: 'pointer',
            }}
          >
            <XIcon size={18} />
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
                onUpdate={(n) => updateQuantity(item.product.id, n, item.selectedSize, item.selectedColor ?? '')}
                onRemove={() => removeFromCart(item.product.id, item.selectedSize, item.selectedColor ?? '')}
              />
            ))
          )}
        </div>

        {items.length > 0 && (
          <footer
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'inherit',
              borderTop: '1px solid #eee',
              paddingTop: 16,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              marginTop: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontWeight: 600 }}>
              <span>{t('cart.subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Button
              size="lg"
              style={{ width: '100%' }}
              onClick={() => {
                onOpenChange(false);
                nav.push(checkoutHref);
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

const stepperButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 0,
  color: 'inherit',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};

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
            width: 64,
            height: 80,
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
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.product.name}
          </p>
        </Link>
        {(item.selectedSize || item.selectedColor) && (
          <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
            {[item.selectedSize && `${t('cart.sizePrefix')} ${item.selectedSize}`, item.selectedColor]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p style={{ fontSize: 14, fontWeight: 600, margin: '4px 0 0' }}>{formatPrice(item.product.price)}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <div
            role="group"
            aria-label={t('cart.quantity')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 'var(--caspian-radius, 6px)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => onUpdate(item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label={t('cart.page.decreaseQty')}
              style={stepperButtonStyle}
            >
              −
            </button>
            <span
              aria-live="polite"
              aria-atomic="true"
              style={{ minWidth: 32, textAlign: 'center', fontSize: 14, fontWeight: 600 }}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdate(item.quantity + 1)}
              aria-label={t('cart.page.increaseQty')}
              style={stepperButtonStyle}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: 0,
              color: '#b91c1c',
              fontSize: 12,
              minHeight: 44,
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
