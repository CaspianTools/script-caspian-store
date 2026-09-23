'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InventorySettings, Product, TaxConfig } from '../types';
import { getProductCollectionBySlug } from '../services/product-collection-service';
import { listActiveCategories } from '../services/category-service';
import { getProducts, getProductsByIds } from '../services/product-service';
import { getSiteSettings } from '../services/site-settings-service';
import { useCaspianFirebase, useCaspianImage, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { ProductGrid } from './product-grid';
import { EmptyState } from './empty-state';
import { isProductOutOfStock } from '../utils/inventory';
import { cn } from '../utils/cn';

type CollectionSort = 'featured' | 'priceAsc' | 'priceDesc' | 'newest';

/** What the slug resolved to: a curated collection, or a category fallback. */
interface CollectionSource {
  kind: 'collection' | 'category';
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface CollectionDetailPageProps {
  /**
   * Curated-collection slug. When no active collection has it, the page falls
   * back to the active product category whose slug (or document id) matches
   * and lists that category's products; only then does it render not-found.
   */
  slug: string;
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  notFoundMessage?: string;
  emptyMessage?: string;
  className?: string;
  /** Override `SiteSettings.inventory`. When omitted, fetched on mount. */
  inventory?: InventorySettings;
  /** Override `SiteSettings.taxConfig`. When omitted, fetched on mount. */
  taxConfig?: TaxConfig;
}

export function CollectionDetailPage({
  slug,
  getProductHref,
  formatPrice,
  notFoundMessage,
  emptyMessage,
  className,
  inventory: inventoryOverride,
  taxConfig: taxConfigOverride,
}: CollectionDetailPageProps) {
  const { db } = useCaspianFirebase();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const t = useT();

  const [source, setSource] = useState<CollectionSource | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<CollectionSort>('featured');
  const [inventory, setInventory] = useState<InventorySettings | undefined>(inventoryOverride);
  const [taxConfig, setTaxConfig] = useState<TaxConfig | undefined>(taxConfigOverride);

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

  useEffect(() => {
    let alive = true;
    // Clear the previous collection so a slug change never shows the old
    // header over the new grid while the fetch is in flight.
    setSource(undefined);
    setProducts([]);
    setSort('featured');
    (async () => {
      setLoading(true);
      try {
        const col = await getProductCollectionBySlug(db, slug);
        if (!alive) return;
        if (col) {
          setSource({
            kind: 'collection',
            name: col.name,
            description: col.description,
            imageUrl: col.imageUrl,
          });
          if (col.productIds.length === 0) return;
          const list = await getProductsByIds(db, col.productIds);
          if (!alive) return;
          const order = new Map(col.productIds.map((id, i) => [id, i]));
          list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
          setProducts(list);
          return;
        }
        // No curated collection — `/collections/<category-slug>` is a natural
        // URL to try, so resolve it against the categories before giving up.
        const categories = await listActiveCategories(db);
        if (!alive) return;
        const category = categories.find((c) => c.slug === slug || c.id === slug);
        if (!category) {
          setSource(null);
          return;
        }
        setSource({
          kind: 'category',
          name: category.name,
          description: category.description,
          imageUrl: category.imageUrl,
        });
        const list = await getProducts(db, { category: category.id });
        if (alive) setProducts(list);
      } catch (error) {
        console.error('[caspian-store] Failed to load collection:', error);
        if (alive) setSource(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, slug]);

  const sortedProducts = useMemo(() => {
    // A curated collection is hand-picked, so sold-out items stay; a category
    // listing follows the shop grid's hide-sold-out rule.
    const visible =
      source?.kind === 'category' &&
      inventory?.trackStock &&
      inventory.outOfStockVisibility === 'hide'
        ? products.filter((p) => !isProductOutOfStock(p, inventory))
        : products;
    if (sort === 'featured') return visible;
    const list = [...visible];
    switch (sort) {
      case 'priceAsc':
        return list.sort((a, b) => a.price - b.price);
      case 'priceDesc':
        return list.sort((a, b) => b.price - a.price);
      case 'newest':
        return list.sort(
          (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
        );
    }
  }, [products, sort, source, inventory]);

  if (source === null) {
    return (
      <div className={cn('caspian-collection-detail-page', 'caspian-page-gutter', className)}>
        <EmptyState
          title={notFoundMessage ?? t('collectionDetail.notFound')}
          action={
            <Link href="/collections" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm">
                {t('collectionDetail.backToCollections')}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={cn('caspian-collection-detail-page', 'caspian-page-gutter', className)}>
      <header style={{ marginBottom: 40, textAlign: 'center' }}>
        {source?.imageUrl && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '5 / 2',
              overflow: 'hidden',
              borderRadius: 'var(--caspian-radius, 8px)',
              background: '#f5f5f5',
              marginBottom: 28,
            }}
          >
            <Image src={source.imageUrl} alt={source.name} fill />
          </div>
        )}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {source?.name ?? ''}
        </h1>
        {source?.description && (
          <p
            style={{
              color: '#666',
              marginTop: 12,
              marginLeft: 'auto',
              marginRight: 'auto',
              maxWidth: 640,
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            {source.description}
          </p>
        )}
      </header>

      {!loading && sortedProducts.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Select
            aria-label={t('shop.sort.label')}
            value={sort}
            onChange={(e) => setSort(e.target.value as CollectionSort)}
            options={[
              { value: 'featured', label: t('shop.sort.featured') },
              { value: 'priceAsc', label: t('shop.sort.priceAsc') },
              { value: 'priceDesc', label: t('shop.sort.priceDesc') },
              { value: 'newest', label: t('shop.sort.newest') },
            ]}
          />
        </div>
      )}

      {!loading && sortedProducts.length === 0 ? (
        <EmptyState
          title={emptyMessage ?? t('collectionDetail.emptyProducts')}
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
          products={sortedProducts}
          loading={loading}
          getProductHref={getProductHref}
          formatPrice={formatPrice}
          inventory={inventory}
          taxConfig={taxConfig}
        />
      )}
    </div>
  );
}
