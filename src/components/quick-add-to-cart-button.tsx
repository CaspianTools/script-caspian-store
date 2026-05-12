'use client';

import { useState } from 'react';
import type { Product } from '../types';
import { useCart } from '../context/cart-context';
import { useToast } from '../ui/toast';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';

export interface QuickAddToCartButtonProps {
  product: Product;
  className?: string;
  size?: number;
  ariaLabel?: string;
}

export function QuickAddToCartButton({
  product,
  className,
  size = 20,
  ariaLabel,
}: QuickAddToCartButtonProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      addToCart(product, 1, product.sizes?.[0]);
      toast({ title: t('cart.added') });
    } catch (error) {
      console.error('[caspian-store] Quick add failed:', error);
      toast({ title: t('cart.addFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? t('cart.aria.quickAdd')}
      onClick={handleClick}
      disabled={busy}
      className={cn('caspian-quick-add-btn', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 16,
        height: size + 16,
        borderRadius: '50%',
        border: 0,
        background: 'transparent',
        cursor: busy ? 'wait' : 'pointer',
        color: '#666',
        transition: 'transform 0.1s',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    </button>
  );
}
