'use client';

import { useEffect, useState } from 'react';
import type { Product } from '../../types';
import { getProducts } from '../../services/product-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { ProductGrid } from '../product-grid';
import { cn } from '../../utils/cn';

export interface TrendingProductsSectionProps {
  label?: string;
  title?: string;
  /** How many trending products to surface. Default: 4. */
  limit?: number;
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  className?: string;
}

export function TrendingProductsSection({
  label,
  title,
  limit = 4,
  getProductHref,
  formatPrice,
  className,
}: TrendingProductsSectionProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getProducts(db, undefined, limit)
      .then((list) => {
        if (alive) setProducts(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load trending products:', error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, limit]);

  return (
    <section
      className={cn('caspian-trending-products', className)}
      style={{ padding: 'clamp(40px, 8vw, 64px) clamp(16px, 4vw, 24px)', background: 'rgba(0,0,0,0.02)' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#888',
              fontFamily: 'var(--caspian-font-headline, inherit)',
            }}
          >
            {label ?? t('home.trending.label')}
          </p>
          <h2
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            {title ?? t('home.trending.title')}
          </h2>
        </header>
        <ProductGrid
          className="caspian-snap-row"
          products={products}
          loading={loading}
          getProductHref={getProductHref}
          formatPrice={formatPrice}
        />
      </div>
    </section>
  );
}
