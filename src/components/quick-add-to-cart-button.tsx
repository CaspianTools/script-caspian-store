'use client';

import { useState } from 'react';
import type { InventorySettings, Product } from '../types';
import { useCart } from '../context/cart-context';
import { useCaspianNavigation } from '../provider/caspian-store-provider';
import { useToast } from '../ui/toast';
import { useT } from '../i18n/locale-context';
import { isProductOutOfStock, isSizeOutOfStock } from '../utils/inventory';
import { cn } from '../utils/cn';

export interface QuickAddToCartButtonProps {
  product: Product;
  className?: string;
  size?: number;
  ariaLabel?: string;
  /**
   * Merchant inventory settings. When `trackStock` is on, an out-of-stock
   * product (or its only size) is refused instead of silently added.
   */
  inventory?: InventorySettings;
  /**
   * Where to send the shopper when the product needs a choice quick-add
   * cannot make for them (more than one size). Default `/product/{slug ?? id}`.
   */
  productHref?: string;
}

export function QuickAddToCartButton({
  product,
  className,
  size = 20,
  ariaLabel,
  inventory,
  productHref,
}: QuickAddToCartButtonProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const nav = useCaspianNavigation();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const sizes = product.sizes ?? [];
    const tracked = inventory?.trackStock === true;
    if (tracked && isProductOutOfStock(product, inventory)) {
      toast({ title: t('storefront.stock.outOfStock'), variant: 'destructive' });
      return;
    }
    // Quick-add cannot pick a size on the shopper's behalf; the PDP can.
    if (sizes.length > 1) {
      nav.push(productHref ?? `/product/${product.slug ?? product.id}`);
      return;
    }
    const selectedSize = sizes[0];
    if (tracked && selectedSize && isSizeOutOfStock(product.stock, selectedSize, inventory)) {
      toast({ title: t('storefront.stock.outOfStock'), variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      await Promise.resolve(addToCart(product, 1, selectedSize));
      toast({ title: t('cart.added'), description: product.name, variant: 'success' });
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
        width: Math.max(40, size + 16),
        height: Math.max(40, size + 16),
        borderRadius: '50%',
        border: 0,
        background: 'rgba(255,255,255,0.85)',
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
