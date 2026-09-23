'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { InventorySettings, Product, TaxConfig } from '../types';
import { getRelatedProducts } from '../services/product-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { ProductGrid } from './product-grid';
import { isProductOutOfStock } from '../utils/inventory';
import { cn } from '../utils/cn';

export interface RelatedProductsProps {
  /** The product being viewed. Its `category` drives the lookup; it is never listed itself. */
  product: Pick<Product, 'id' | 'category'>;
  /** Maximum number of cards. Default: 4. */
  limit?: number;
  /** Heading override. Default: `t('product.related.title')`. */
  title?: string;
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  /** Forwarded to the cards so stock badges render. */
  inventory?: InventorySettings;
  /** Forwarded to the cards so the price-display suffix renders. */
  taxConfig?: TaxConfig;
  className?: string;
  style?: CSSProperties;
  headingStyle?: CSSProperties;
}

/**
 * "You may also like" row for the product detail page: other active products
 * in the same category, rendered through `<ProductGrid>` so the active
 * template's card variant applies. Renders nothing while loading, on error,
 * or when the category has no other products — the PDP should never grow an
 * empty section.
 */
export function RelatedProducts({
  product,
  limit = 4,
  title,
  getProductHref,
  formatPrice,
  inventory,
  taxConfig,
  className,
  style,
  headingStyle,
}: RelatedProductsProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [related, setRelated] = useState<Product[]>([]);
  const { id, category } = product;

  useEffect(() => {
    setRelated([]);
    if (!category || limit <= 0) return undefined;
    let alive = true;
    getRelatedProducts(db, category, id, limit)
      .then((list) => {
        if (alive) setRelated(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load related products:', error);
      });
    return () => {
      alive = false;
    };
  }, [db, category, id, limit]);

  // Same rule as the shop grid: a merchant who hides sold-out products does
  // not want them recommended either.
  const visible =
    inventory?.trackStock && inventory.outOfStockVisibility === 'hide'
      ? related.filter((p) => !isProductOutOfStock(p, inventory))
      : related;

  if (visible.length === 0) return null;

  return (
    <section className={cn('caspian-related-products', className)} style={{ marginTop: 64, ...style }}>
      <h2
        style={{
          fontFamily: 'var(--caspian-font-headline, inherit)',
          fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
          fontWeight: 700,
          margin: '0 0 24px',
          ...headingStyle,
        }}
      >
        {title ?? t('product.related.title')}
      </h2>
      <ProductGrid
        products={visible}
        getProductHref={getProductHref}
        formatPrice={formatPrice}
        inventory={inventory}
        taxConfig={taxConfig}
      />
    </section>
  );
}
