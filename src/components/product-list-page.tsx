'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InventorySettings, Product, ProductCategoryDoc, TaxConfig } from '../types';
import { getProducts, type ProductFilters } from '../services/product-service';
import { getSiteSettings } from '../services/site-settings-service';
import { listActiveCategories } from '../services/category-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { ProductGrid } from './product-grid';
import {
  ShopFilterSidebar,
  EMPTY_SHOP_FILTERS,
  countActiveShopFilters,
  type ShopFilterState,
  type TaxonomyFacet,
} from './shop-filter-sidebar';
import { ShopFilterDrawer } from './shop-filter-drawer';
import { resolveEnabledTaxonomies, TAXONOMY_BY_ID } from '../taxonomies/catalog';
import { useTaxonomyTermsByType } from '../hooks/use-taxonomy-terms';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { cn } from '../utils/cn';

export interface ProductListPageProps {
  /**
   * Server-side narrowing applied at the Firestore query layer (e.g. when
   * mounted under `/shop/[category]`). The interactive filter sidebar is
   * additive on top of this set — it never widens beyond what `filters`
   * returns.
   */
  filters?: ProductFilters;
  max?: number;
  title?: string;
  subtitle?: string;
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  emptyMessage?: string;
  className?: string;
  /**
   * Override the inventory settings read from `SiteSettings.inventory`.
   * When omitted, the page fetches site settings on mount and uses them to
   * apply the hide-out-of-stock filter and stock badging. Added in v2.9.
   */
  inventory?: InventorySettings;
  /**
   * Override the tax display config read from `SiteSettings.taxConfig`.
   * When omitted, fetched alongside inventory on mount. Added in v2.12.
   */
  taxConfig?: TaxConfig;
  /**
   * Hide the interactive filter sidebar. Useful for embedding the listing in
   * tighter layouts (sidebars, drawers) where filters don't fit. Added in v8.1.
   */
  hideFilters?: boolean;
}

/**
 * Drop-in product listing page. Fetches from Firestore on mount and renders a
 * left filter sidebar + responsive product grid. For a listing wired to your
 * own data source, use `<ProductGrid products={...}>` directly.
 */
export function ProductListPage({
  filters,
  max,
  title,
  subtitle,
  getProductHref,
  formatPrice,
  emptyMessage,
  className,
  inventory: inventoryOverride,
  taxConfig: taxConfigOverride,
  hideFilters,
}: ProductListPageProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventorySettings | undefined>(inventoryOverride);
  const [taxConfig, setTaxConfig] = useState<TaxConfig | undefined>(taxConfigOverride);
  const [categories, setCategories] = useState<ProductCategoryDoc[]>([]);
  const [enabledAttrIds, setEnabledAttrIds] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<ShopFilterState>(EMPTY_SHOP_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listActiveCategories(db)
      .then((list) => {
        if (alive) setCategories(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load categories:', error);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  // Enabled attribute taxonomies (every enabled generic taxonomy except sizes)
  // drive the storefront filter facets.
  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (!alive) return;
        const enabled = resolveEnabledTaxonomies(s?.enabledTaxonomies);
        setEnabledAttrIds(
          enabled.filter((id) => {
            const def = TAXONOMY_BY_ID[id];
            return def ? def.kind === 'generic' && id !== 'sizes' : false;
          }),
        );
      })
      .catch(() => {
        /* no taxonomy facets */
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const { byType: attrTermsByType } = useTaxonomyTermsByType(enabledAttrIds);

  useEffect(() => {
    if (inventoryOverride !== undefined && taxConfigOverride !== undefined) {
      setInventory(inventoryOverride);
      setTaxConfig(taxConfigOverride);
      return undefined;
    }
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (!alive) return;
        if (inventoryOverride === undefined) setInventory(s?.inventory);
        if (taxConfigOverride === undefined) setTaxConfig(s?.taxConfig);
      })
      .catch(() => {
        /* fall through — no inventory/tax wiring */
      });
    return () => {
      alive = false;
    };
  }, [db, inventoryOverride, taxConfigOverride]);

  const effectiveFilters = useMemo<ProductFilters | undefined>(() => {
    const hideOutOfStock =
      inventory?.trackStock && inventory.outOfStockVisibility === 'hide'
        ? { outOfStockThreshold: inventory.outOfStockThreshold }
        : undefined;
    if (!hideOutOfStock) return filters;
    return { ...(filters ?? {}), hideOutOfStock };
  }, [filters, inventory]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getProducts(db, effectiveFilters, max);
        if (alive) setProducts(data);
      } catch (error) {
        console.error('[caspian-store] Failed to load products:', error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, effectiveFilters, max]);

  const categoryLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return [...set].sort((a, b) =>
      (categoryLabels.get(a) ?? a).localeCompare(categoryLabels.get(b) ?? b),
    );
  }, [products, categoryLabels]);

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const s of p.sizes ?? []) set.add(s);
    return [...set].sort();
  }, [products]);

  const availableTaxonomies = useMemo<TaxonomyFacet[]>(() => {
    return enabledAttrIds
      .map((id): TaxonomyFacet => {
        const def = TAXONOMY_BY_ID[id];
        const nameById = new Map((attrTermsByType[id] ?? []).map((tm) => [tm.id, tm.name]));
        // Only surface term ids that actually appear on the loaded products.
        const present = new Set<string>();
        for (const p of products) for (const tid of p.taxonomies?.[id] ?? []) present.add(tid);
        const terms = [...present]
          .map((tid) => ({ id: tid, name: nameById.get(tid) ?? tid }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return { id, label: def ? t(def.labelKey) : id, terms };
      })
      .filter((facet) => facet.terms.length > 0);
  }, [enabledAttrIds, attrTermsByType, products, t]);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterState.category && p.category !== filterState.category) return false;
      const min = filterState.minPrice === '' ? null : Number(filterState.minPrice);
      const max = filterState.maxPrice === '' ? null : Number(filterState.maxPrice);
      if (min !== null && !Number.isNaN(min) && p.price < min) return false;
      if (max !== null && !Number.isNaN(max) && p.price > max) return false;
      if (filterState.sizes.size > 0) {
        if (!p.sizes?.some((s) => filterState.sizes.has(s))) return false;
      }
      if (filterState.isNew && !p.isNew) return false;
      if (filterState.limited && !p.limited) return false;
      for (const [taxId, set] of Object.entries(filterState.taxonomies)) {
        if (set.size === 0) continue;
        const assigned = p.taxonomies?.[taxId];
        if (!assigned || !assigned.some((tid) => set.has(tid))) return false;
      }
      return true;
    });
  }, [products, filterState]);

  const grid = (
    <ProductGrid
      products={visibleProducts}
      loading={loading}
      getProductHref={getProductHref}
      formatPrice={formatPrice}
      emptyMessage={emptyMessage}
      inventory={inventory}
      taxConfig={taxConfig}
    />
  );

  return (
    <div className={className}>
      {(title || subtitle) && (
        <header style={{ marginBottom: 24 }}>
          {title && <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{title}</h1>}
          {subtitle && <p style={{ color: '#666', marginTop: 4 }}>{subtitle}</p>}
        </header>
      )}
      {hideFilters ? (
        grid
      ) : (
        <>
          <MobileFilterToolbar
            activeCount={countActiveShopFilters(filterState)}
            resultCount={loading ? undefined : visibleProducts.length}
            onOpen={() => setMobileFiltersOpen(true)}
          />
          <div className={cn('caspian-shop-grid')}>
            <ShopFilterSidebar
              state={filterState}
              onChange={setFilterState}
              availableCategories={availableCategories}
              categoryLabels={categoryLabels}
              availableSizes={availableSizes}
              availableTaxonomies={availableTaxonomies}
              resultCount={loading ? undefined : visibleProducts.length}
            />
            <div style={{ minWidth: 0 }}>{grid}</div>
          </div>
          <ShopFilterDrawer
            open={mobileFiltersOpen}
            onOpenChange={setMobileFiltersOpen}
            state={filterState}
            onChange={setFilterState}
            availableCategories={availableCategories}
            categoryLabels={categoryLabels}
            availableSizes={availableSizes}
            availableTaxonomies={availableTaxonomies}
            resultCount={loading ? undefined : visibleProducts.length}
          />
        </>
      )}
    </div>
  );
}

function MobileFilterToolbar({
  activeCount,
  resultCount,
  onOpen,
}: {
  activeCount: number;
  resultCount: number | undefined;
  onOpen: () => void;
}) {
  const t = useT();
  return (
    <div
      className="caspian-shop-mobile-toolbar"
      style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={onOpen}>
        <span aria-hidden="true" style={{ marginRight: 6 }}>☰</span>
        {activeCount > 0
          ? t('shop.filters.openMobileWithCount', { count: activeCount })
          : t('shop.filters.openMobile')}
      </Button>
      {typeof resultCount === 'number' && (
        <span style={{ fontSize: 13, color: '#666' }}>
          {t('shop.filters.resultCount', { count: resultCount })}
        </span>
      )}
    </div>
  );
}
