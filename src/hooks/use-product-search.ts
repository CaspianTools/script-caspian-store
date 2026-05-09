'use client';

import { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../services/product-service';
import { listActiveBrands } from '../services/brand-service';
import { listActiveCategories } from '../services/category-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import type { Product } from '../types';

export interface UseProductSearchOptions {
  /** When false, the catalog is not fetched. Flip to true on first dialog open. */
  enabled?: boolean;
  /** Cap on how many products to load into the client-side filter. Default 500. */
  max?: number;
}

export interface UseProductSearchResult {
  matches: Product[];
  loading: boolean;
  loaded: boolean;
}

/**
 * Lazy product catalog + client-side filter shared by the header search popup
 * and any other search surface. Fetches once on first `enabled = true`, caches
 * for the lifetime of the hook, then narrows by name + brand + category
 * (lowercase substring) — same algorithm as `SearchResultsPage`.
 */
export function useProductSearch(
  query: string,
  opts?: UseProductSearchOptions,
): UseProductSearchResult {
  const { db } = useCaspianFirebase();
  const enabled = opts?.enabled ?? true;
  const max = opts?.max ?? 500;
  const [products, setProducts] = useState<Product[]>([]);
  const [brandLabels, setBrandLabels] = useState<Map<string, string>>(new Map());
  const [categoryLabels, setCategoryLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      getProducts(db, undefined, max),
      listActiveBrands(db),
      listActiveCategories(db),
    ])
      .then(([prods, brands, cats]) => {
        if (!alive) return;
        setProducts(prods);
        setBrandLabels(new Map(brands.map((b) => [b.id, b.name])));
        setCategoryLabels(new Map(cats.map((c) => [c.id, c.name])));
        setLoaded(true);
      })
      .catch((err) => {
        console.error('[caspian-store] useProductSearch load failed:', err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, enabled, loaded, max]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Product[];
    return products.filter((p) => {
      const brandLabel = brandLabels.get(p.brand) ?? p.brand;
      const categoryLabel = categoryLabels.get(p.category) ?? p.category;
      return `${p.name} ${brandLabel} ${categoryLabel}`.toLowerCase().includes(q);
    });
  }, [products, brandLabels, categoryLabels, query]);

  return { matches, loading, loaded };
}
