'use client';

import { useEffect, useState } from 'react';
import type {
  InventorySettings,
  Product,
  ProductCollectionDoc,
  TaxConfig,
} from '../types';
import { getProductCollectionBySlug } from '../services/product-collection-service';
import { getProductsByIds } from '../services/product-service';
import { getSiteSettings } from '../services/site-settings-service';
import { useCaspianFirebase, useCaspianImage, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ProductGrid } from './product-grid';
import { EmptyState } from './empty-state';
import { cn } from '../utils/cn';

export interface CollectionDetailPageProps {
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

  const [collection, setCollection] = useState<ProductCollectionDoc | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
    setCollection(undefined);
    setProducts([]);
    (async () => {
      setLoading(true);
      try {
        const col = await getProductCollectionBySlug(db, slug);
        if (!alive) return;
        setCollection(col);
        if (!col || col.productIds.length === 0) {
          setProducts([]);
          return;
        }
        const list = await getProductsByIds(db, col.productIds);
        if (!alive) return;
        const order = new Map(col.productIds.map((id, i) => [id, i]));
        list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        setProducts(list);
      } catch (error) {
        console.error('[caspian-store] Failed to load collection:', error);
        if (alive) setCollection(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, slug]);

  if (collection === null) {
    return (
      <div className={cn('caspian-collection-detail-page', className)}>
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
    <div className={cn('caspian-collection-detail-page', className)}>
      <header style={{ marginBottom: 40, textAlign: 'center' }}>
        {collection?.imageUrl && (
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
            <Image src={collection.imageUrl} alt={collection.name} fill />
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
          {collection?.name ?? ''}
        </h1>
        {collection?.description && (
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
            {collection.description}
          </p>
        )}
      </header>

      {!loading && products.length === 0 ? (
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
          products={products}
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
