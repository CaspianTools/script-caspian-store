'use client';

import type { CSSProperties } from 'react';
import { Button } from '../../ui/button';
import { HtmlContent } from '../../ui/html-content';
import { Badge, Separator, Skeleton } from '../../ui/misc';
import { ProductGallery } from '../product-gallery';
import { QuantitySelector, SizeSelector } from '../product-selectors';
import { ProductReviews } from '../reviews/product-reviews';
import type { ProductDetailPageProps } from '../product-detail-page';
import { useProductDetailState } from './use-product-detail-state';

/**
 * Default PDP variant — the v8.x layout extracted into its own file.
 * Two-column grid (gallery on the left, info column on the right) with
 * a tab block below (Details / Reviews / Questions). Used by the
 * default storefront and the `fashion-minimal` template.
 *
 * v9.0.0-alpha.4 — extracted so the outer `<ProductDetailPage>` can
 * dispatch to one of three variants via
 * `useTemplateComponent('ProductDetailPage', ProductDetailDefault)`.
 */
export function ProductDetailDefault(props: ProductDetailPageProps) {
  const { formatPrice = (p) => `$${p.toFixed(2)}`, hideReviews, className } = props;
  const state = useProductDetailState(props);
  const {
    product,
    loading,
    brandName,
    blurb,
    selectedSize,
    setSelectedSize,
    quantity,
    setQuantity,
    avg,
    totalReviews,
    setAvg,
    setTotalReviews,
    activeTab,
    setActiveTab,
    handleAddToCart,
    derived,
    t,
  } = state;

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

  return (
    <div
      className={className}
      data-pdp-variant="default"
      style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}
    >
      <div style={gridStyle}>
        <ProductGallery images={product.images} />
        <div className="caspian-pdp-default-info" style={{ display: 'flex', flexDirection: 'column' }}>
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

          {blurb && <p style={{ color: '#555', lineHeight: 1.6, margin: '16px 0' }}>{blurb}</p>}

          {derived.inventoryActive && derived.allOut && (
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

          {derived.hasSizes && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('product.size')}</p>
              <SizeSelector
                sizes={product.sizes!}
                value={selectedSize}
                onChange={setSelectedSize}
                outOfStock={derived.outOfStockSizes}
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

      {(!hideReviews || derived.detailsTabHasContent) && (
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
              {derived.hasDetails && (
                <HtmlContent html={product.details} style={{ color: '#333', lineHeight: 1.6 }} />
              )}
              {derived.hasLongDescription && (
                <p style={{ color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: derived.hasDetails ? 20 : 0 }}>
                  {product.description}
                </p>
              )}
              {!derived.detailsTabHasContent && (
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

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 450px)',
  gap: 48,
  alignItems: 'start',
};
