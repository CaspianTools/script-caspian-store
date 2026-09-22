'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Product, ProductBrandDoc, ProductCategoryDoc } from '../types';
import { getProducts } from '../services/product-service';
import { listActiveBrands } from '../services/brand-service';
import { listActiveCategories } from '../services/category-service';
import { useCaspianFirebase, useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ProductGrid } from './product-grid';
import { EmptyState } from './empty-state';

export interface SearchResultsPageProps {
  /** Query string. If omitted, read `?q=` from the navigation adapter's
   * reactive `searchParams` (falling back to `window.location.search`). */
  query?: string;
  /** Max products to load into the client-side filter. Default 500. */
  max?: number;
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  className?: string;
}

/**
 * Storefront search results. Loads the active-product catalog and filters
 * client-side by name / brand / category containing the query. Fine for
 * small-to-medium catalogs — wire a proper search backend (Algolia, Typesense)
 * via a consumer replacement of this component for large stores.
 */
export function SearchResultsPage({
  query: queryProp,
  max = 500,
  getProductHref,
  formatPrice,
  className,
}: SearchResultsPageProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const Link = useCaspianLink();
  const navigation = useCaspianNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategoryDoc[]>([]);
  const [brands, setBrands] = useState<ProductBrandDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Force a re-render on client-side URL changes even when the consumer's
  // adapter doesn't expose a reactive `searchParams`. The library emits
  // `caspian:locationchange` after wrapping any navigation.push/replace call
  // (see useCaspianNavigation in the provider); popstate covers back/forward.
  const [, bumpUrlTick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => bumpUrlTick();
    window.addEventListener('popstate', onChange);
    window.addEventListener('caspian:locationchange', onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('caspian:locationchange', onChange);
    };
  }, []);

  const queryState =
    typeof queryProp === 'string'
      ? queryProp
      : navigation.searchParams?.get('q') ??
        (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('q') ?? ''
          : '');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getProducts(db, undefined, max);
        if (alive) setProducts(data);
      } catch (error) {
        console.error('[caspian-store] Failed to load products for search:', error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, max]);

  useEffect(() => {
    let alive = true;
    Promise.all([listActiveCategories(db), listActiveBrands(db)])
      .then(([catList, brandList]) => {
        if (!alive) return;
        setCategories(catList);
        setBrands(brandList);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load taxonomy for search:', error);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const categoryLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const brandLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brands) map.set(b.id, b.name);
    return map;
  }, [brands]);

  const matches = useMemo(() => {
    const q = queryState.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const categoryLabel = categoryLabels.get(p.category) ?? p.category;
      const brandLabel = brandLabels.get(p.brand) ?? p.brand;
      const hay = `${p.name} ${brandLabel} ${categoryLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, queryState, categoryLabels, brandLabels]);

  return (
    <div className={className} style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          {queryState ? t('search.resultsFor', { query: queryState }) : t('search.title')}
        </h1>
        {!loading && queryState && (
          <p style={{ color: '#666', marginTop: 4 }}>
            {t('search.resultCount', { count: matches.length })}
          </p>
        )}
      </header>
      {!loading && matches.length === 0 ? (
        <EmptyState
          title={queryState ? t('search.noResults') : t('search.emptyQuery')}
          action={
            <Link href="/shop" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm">
                {t('storefront.browseAll')}
              </Button>
            </Link>
          }
        />
      ) : (
        <ProductGrid
          products={matches}
          loading={loading}
          getProductHref={getProductHref}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}
