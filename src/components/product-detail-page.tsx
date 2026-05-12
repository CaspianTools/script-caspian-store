'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CartBehavior, InventorySettings, Product } from '../types';
import { getProductBySlugOrId } from '../services/product-service';
import { getSiteSettings } from '../services/site-settings-service';
import { isProductOutOfStock, isSizeOutOfStock } from '../utils/inventory';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useCart } from '../context/cart-context';
import { useBrandName } from '../hooks/use-brands';
import { useT } from '../i18n/locale-context';
import { useToast } from '../ui/toast';
import { Button } from '../ui/button';
import { HtmlContent } from '../ui/html-content';
import { Badge, Separator, Skeleton } from '../ui/misc';
import { ProductGallery } from './product-gallery';
import { QuantitySelector, SizeSelector } from './product-selectors';
import { ProductReviews } from './reviews/product-reviews';

export interface ProductDetailPageProps {
  /**
   * Either pass an identifier (we'll fetch) or a pre-fetched product. The
   * identifier may be either a SEO-friendly slug (`black-leather-jacket`) or
   * a Firestore document id — the page resolves both transparently so old
   * id-based URLs keep working after upgrading to v8.3.
   */
  productSlugOrId?: string;
  /** @deprecated since v8.3 — use `productSlugOrId`. Kept for one minor cycle. */
  productId?: string;
  product?: Product;
  /** Optional formatter for price display. Default: `$x.xx`. */
  formatPrice?: (price: number) => string;
  /** Hide the Reviews & Questions tabs. */
  hideReviews?: boolean;
  /**
   * Override the cart-behavior read from `SiteSettings.cartBehavior`. Useful
   * for tests or bespoke layouts. Added in v2.7.
   */
  cartBehavior?: CartBehavior;
  /**
   * Path to navigate to when `cartBehavior.redirectToCartAfterAdd` is true.
   * Default `/cart`. Added in v2.7.
   */
  cartHref?: string;
  /**
   * Override inventory settings (otherwise fetched from `SiteSettings.inventory`).
   * Drives per-size disabled state and the global out-of-stock banner. Added in v2.9.
   */
  inventory?: InventorySettings;
  onNotFound?: () => void;
  className?: string;
}

type TabKey = 'details' | 'reviews' | 'questions';

/**
 * Truncate long descriptions for the hero-column blurb when `shortDescription`
 * isn't set. Breaks on the first paragraph boundary, then falls back to a
 * character cap. Not perfect — admins should fill `shortDescription` for
 * full control — but produces sensible output on legacy products.
 */
function defaultBlurb(description: string): string {
  const firstPara = description.split(/\n\s*\n/, 1)[0]?.trim() ?? '';
  if (firstPara.length > 0 && firstPara.length <= 280) return firstPara;
  const clipped = description.slice(0, 240).trim();
  return clipped.length < description.length ? `${clipped}…` : clipped;
}

export function ProductDetailPage({
  productSlugOrId,
  productId,
  product: externalProduct,
  formatPrice = (p) => `$${p.toFixed(2)}`,
  hideReviews,
  cartBehavior: cartBehaviorOverride,
  cartHref = '/cart',
  inventory: inventoryOverride,
  onNotFound,
  className,
}: ProductDetailPageProps) {
  const lookupKey = productSlugOrId ?? productId;
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const t = useT();
  const [product, setProduct] = useState<Product | null>(externalProduct ?? null);
  const [loading, setLoading] = useState(!externalProduct);
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [avg, setAvg] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [cartBehavior, setCartBehavior] = useState<CartBehavior | undefined>(cartBehaviorOverride);
  const [inventory, setInventory] = useState<InventorySettings | undefined>(inventoryOverride);

  useEffect(() => {
    if (cartBehaviorOverride !== undefined && inventoryOverride !== undefined) {
      setCartBehavior(cartBehaviorOverride);
      setInventory(inventoryOverride);
      return undefined;
    }
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (!alive) return;
        if (cartBehaviorOverride === undefined) setCartBehavior(s?.cartBehavior);
        if (inventoryOverride === undefined) setInventory(s?.inventory);
      })
      .catch(() => {
        /* fall through to defaults */
      });
    return () => {
      alive = false;
    };
  }, [db, cartBehaviorOverride, inventoryOverride]);

  useEffect(() => {
    if (externalProduct) {
      setProduct(externalProduct);
      setLoading(false);
      return;
    }
    if (!lookupKey) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = await getProductBySlugOrId(db, lookupKey);
        if (!alive) return;
        if (!p) {
          onNotFound?.();
          setProduct(null);
        } else {
          setProduct(p);
          if (p.sizes && p.sizes.length > 0) setSelectedSize(p.sizes[0]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, lookupKey, externalProduct, onNotFound]);

  const brandName = useBrandName(product?.brand);

  const blurb = useMemo(() => {
    if (!product) return '';
    return product.shortDescription?.trim() || defaultBlurb(product.description ?? '');
  }, [product]);

  if (loading) {
    return (
      <div className={className} style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={gridStyle}>
          <Skeleton style={{ aspectRatio: '4 / 5' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton style={{ height: 14, width: '30%' }} />
            <Skeleton style={{ height: 24, width: '80%' }} />
            <Skeleton style={{ height: 18, width: '40%' }} />
            <Skeleton style={{ height: 40, width: '50%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <p style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('product.notFound')}</p>;
  }

  const hasSizes = product.sizes && product.sizes.length > 0;
  const hasDetails = Boolean(product.details && product.details.trim());
  const hasLongDescription = Boolean(
    product.description && product.description.trim() && product.description.trim() !== blurb,
  );
  const detailsTabHasContent = hasDetails || hasLongDescription;
  const inventoryActive = inventory?.trackStock === true;
  const outOfStockSizes =
    inventoryActive && product.sizes
      ? product.sizes.filter((s) => isSizeOutOfStock(product.stock, s, inventory))
      : [];
  const allOut = inventoryActive && isProductOutOfStock(product, inventory);

  const handleAddToCart = () => {
    if (allOut) {
      toast({ title: 'Out of stock', variant: 'destructive' });
      return;
    }
    if (hasSizes && !selectedSize) {
      toast({ title: t('product.selectSize'), variant: 'destructive' });
      return;
    }
    if (
      inventoryActive &&
      selectedSize &&
      isSizeOutOfStock(product.stock, selectedSize, inventory)
    ) {
      toast({ title: 'This size is out of stock', variant: 'destructive' });
      return;
    }
    addToCart(product, quantity, selectedSize);
    toast({ title: t('product.addedToCart'), description: product.name });
    setQuantity(1);
    if (cartBehavior?.redirectToCartAfterAdd) {
      nav.push(cartHref);
    }
  };

  return (
    <div className={className} style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}>
      <div style={gridStyle}>
        <ProductGallery images={product.images} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {product.isNew && <Badge variant="secondary">{t('storefront.badges.new')}</Badge>}
            {product.limited && <Badge variant="destructive">{t('storefront.badges.limited')}</Badge>}
          </div>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', margin: 0 }}>
            {brandName}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '4px 0 12px' }}>{product.name}</h1>

          {totalReviews > 0 && (
            <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
              {t('product.reviewsSummary', { avg: avg.toFixed(1), count: totalReviews })}
            </p>
          )}

          <p style={{ fontSize: 28, fontWeight: 700, margin: '16px 0' }}>{formatPrice(product.price)}</p>

          <Separator />

          {blurb && (
            <p style={{ color: '#555', lineHeight: 1.6, margin: '16px 0' }}>{blurb}</p>
          )}

          {inventoryActive && allOut && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 'var(--caspian-radius, 6px)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Out of stock
            </div>
          )}

          {hasSizes && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('product.size')}</p>
              <SizeSelector
                sizes={product.sizes!}
                value={selectedSize}
                onChange={setSelectedSize}
                outOfStock={outOfStockSizes}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('product.quantity')}</p>
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>

          <Button size="lg" onClick={handleAddToCart}>
            {t('product.addToCart')}
          </Button>
        </div>
      </div>

      {(!hideReviews || detailsTabHasContent) && (
        <div style={{ marginTop: 48 }}>
          <Separator />
          <nav
            role="tablist"
            aria-label={t('product.tabs.ariaLabel')}
            style={{
              display: 'flex',
              gap: 32,
              justifyContent: 'center',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              marginBottom: 24,
            }}
          >
            <TabButton
              label={t('product.tabs.details')}
              active={activeTab === 'details'}
              onClick={() => setActiveTab('details')}
            />
            {!hideReviews && (
              <>
                <TabButton
                  label={t('product.tabs.reviews')}
                  active={activeTab === 'reviews'}
                  onClick={() => setActiveTab('reviews')}
                />
                <TabButton
                  label={t('product.tabs.questions')}
                  active={activeTab === 'questions'}
                  onClick={() => setActiveTab('questions')}
                />
              </>
            )}
          </nav>

          {activeTab === 'details' && (
            <section>
              {hasDetails && (
                <HtmlContent html={product.details} style={{ color: '#333', lineHeight: 1.6 }} />
              )}
              {hasLongDescription && (
                <p style={{ color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: hasDetails ? 20 : 0 }}>
                  {product.description}
                </p>
              )}
              {!detailsTabHasContent && (
                <p style={{ color: '#999', textAlign: 'center', padding: '32px 0', margin: 0 }}>
                  {t('product.tabs.detailsEmpty')}
                </p>
              )}
            </section>
          )}

          {activeTab === 'reviews' && !hideReviews && (
            <ProductReviews
              productId={product.id}
              mode="reviews-only"
              onSummaryChange={({ average, total }) => {
                setAvg(average);
                setTotalReviews(total);
              }}
            />
          )}

          {activeTab === 'questions' && !hideReviews && (
            <ProductReviews productId={product.id} mode="questions-only" />
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 0,
        padding: '12px 4px',
        marginBottom: -1,
        fontSize: 15,
        fontWeight: active ? 600 : 400,
        color: active ? '#111' : '#777',
        cursor: 'pointer',
        borderBottom: active ? '2px solid var(--caspian-primary, #111)' : '2px solid transparent',
        transition: 'color 0.1s',
      }}
    >
      {label}
    </button>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 450px)',
  gap: 48,
  alignItems: 'start',
};
