'use client';

import { useEffect, useState } from 'react';
import { useCart } from '../../context/cart-context';
import { useScriptSettings } from '../../context/script-settings-context';
import { useWishlist } from '../../context/wishlist-context';
import { useFormatCurrency, useT } from '../../i18n/locale-context';
import {
  useCaspianFirebase,
  useCaspianImage,
  useCaspianLink,
  useCaspianNavigation,
} from '../../provider/caspian-store-provider';
import { getSiteSettings } from '../../services/site-settings-service';
import type { InventorySettings, Product } from '../../types';
import { Button } from '../../ui/button';
import { useToast } from '../../ui/toast';
import { isProductOutOfStock, isSizeOutOfStock } from '../../utils/inventory';
import { EmptyState } from '../empty-state';

export interface WishlistGridProps {
  /** Product-page URL builder. Default: `/product/{id}`. */
  getProductHref?: (productSlugOrId: string) => string;
  /** Browse-products destination for the empty-state CTA. Default: `/shop`. */
  browseHref?: string;
  /** Currency formatter. Default: the store currency via `Intl.NumberFormat`. */
  formatPrice?: (price: number) => string;
  /** Override `SiteSettings.inventory`. When omitted, fetched on mount. */
  inventory?: InventorySettings;
  className?: string;
}

/**
 * Renders the saved-products grid plus its loading and empty states. Reads
 * everything from <WishlistProvider> + <CartProvider>; works for both anon
 * and signed-in users (the context handles storage branching).
 *
 * Mounted by both <WishlistPanel> (account chrome) and <WishlistPage>
 * (standalone /wishlist).
 */
export function WishlistGrid({
  getProductHref = (id) => `/product/${id}`,
  browseHref = '/shop',
  formatPrice: formatPriceProp,
  inventory: inventoryOverride,
  className,
}: WishlistGridProps) {
  const t = useT();
  const Link = useCaspianLink();
  const Image = useCaspianImage();
  const nav = useCaspianNavigation();
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const { settings } = useScriptSettings();
  const currency = useFormatCurrency(settings.defaultCurrency);
  const formatPrice = formatPriceProp ?? ((p: number) => currency.format(p));
  const { wishlist, products, loading, remove } = useWishlist();
  const { addToCart } = useCart();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventorySettings | undefined>(inventoryOverride);

  useEffect(() => {
    if (inventoryOverride !== undefined) {
      setInventory(inventoryOverride);
      return undefined;
    }
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (alive) setInventory(s?.inventory);
      })
      .catch(() => {
        /* no stock gating without settings */
      });
    return () => {
      alive = false;
    };
  }, [db, inventoryOverride]);

  const items: Product[] = wishlist
    .map((id) => products[id])
    .filter((p): p is Product => Boolean(p));

  const handleRemove = async (productId: string) => {
    setBusyId(productId);
    try {
      await remove(productId);
      toast({ title: t('wishlist.removed') });
    } catch (error) {
      console.error('[caspian-store] Remove from wishlist failed:', error);
      toast({ title: t('wishlist.failed'), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleAddToCart = (product: Product) => {
    const sizes = product.sizes ?? [];
    const tracked = inventory?.trackStock === true;
    if (tracked && isProductOutOfStock(product, inventory)) {
      toast({ title: t('storefront.stock.outOfStock'), variant: 'destructive' });
      return;
    }
    // A sized product needs a choice the grid cannot make; send them to the PDP.
    if (sizes.length > 1) {
      nav.push(getProductHref(product.slug ?? product.id));
      return;
    }
    const selectedSize = sizes[0];
    if (tracked && selectedSize && isSizeOutOfStock(product.stock, selectedSize, inventory)) {
      toast({ title: t('storefront.stock.outOfStock'), variant: 'destructive' });
      return;
    }
    addToCart(product, 1, selectedSize);
    toast({ title: t('product.addedToCart'), description: product.name, variant: 'success' });
  };

  // Loading: only show when we have IDs but no hydrated products yet.
  if (loading && items.length === 0 && wishlist.length > 0) {
    return (
      <p className={className} style={{ color: '#888', fontSize: 14, padding: '16px 0', margin: 0 }}>
        {t('common.loading')}
      </p>
    );
  }

  if (wishlist.length === 0) {
    return (
      <EmptyState
        className={className}
        title={t('wishlist.panel.empty')}
        action={
          <Link href={browseHref} style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm">
              {t('wishlist.panel.emptyCta')}
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <ul
      className={className}
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {items.map((product) => {
        const img = product.images?.[0];
        const busy = busyId === product.id;
        return (
          <li
            key={product.id}
            style={{
              border: '1px solid #eee',
              borderRadius: 'var(--caspian-radius, 8px)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: '#fff',
            }}
          >
            <Link
              href={getProductHref(product.slug ?? product.id)}
              style={{
                display: 'block',
                position: 'relative',
                aspectRatio: '1 / 1',
                overflow: 'hidden',
                borderRadius: 'var(--caspian-radius, 6px)',
                background: '#f5f5f5',
              }}
            >
              {img ? <Image src={img.url} alt={img.alt || product.name} fill /> : null}
            </Link>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link
                href={getProductHref(product.slug ?? product.id)}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {product.name}
              </Link>
              <span style={{ fontSize: 14, color: '#333' }}>{formatPrice(product.price)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <Button
                size="sm"
                onClick={() => handleAddToCart(product)}
                style={{ flex: 1 }}
                disabled={busy}
              >
                {t('wishlist.panel.addToCart')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(product.id)}
                disabled={busy}
              >
                {t('wishlist.panel.remove')}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
