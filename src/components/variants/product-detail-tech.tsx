'use client';

import type { CSSProperties } from 'react';
import { Button } from '../../ui/button';
import { HtmlContent } from '../../ui/html-content';
import { Badge, Skeleton } from '../../ui/misc';
import { ProductGallery } from '../product-gallery';
import { QuantitySelector, SizeSelector } from '../product-selectors';
import { ProductReviews } from '../reviews/product-reviews';
import type { ProductDetailPageProps } from '../product-detail-page';
import { useProductDetailState } from './use-product-detail-state';

/**
 * Tech / spec-sheet PDP variant — used by the `electronics-tech` template.
 * Inverts the default layout (info column LEFT, gallery RIGHT) to keep
 * specs and CTA pinned to the user's reading direction, and renders the
 * Details and Reviews sections inline (no tabs collapse) since tech
 * buyers scan everything before deciding.
 *
 * Monospace eyebrow with a faked SKU (slug-upper) for the product-page
 * spec-sheet feel. Reviews land inline under details. Quick-take blurb
 * appears under price, full description below the fold.
 */
export function ProductDetailTech(props: ProductDetailPageProps) {
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
    handleAddToCart,
    derived,
    t,
  } = state;

  if (loading) {
    return (
      <div className={className} style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}>
        <div style={gridStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton style={{ height: 14, width: '30%' }} />
            <Skeleton style={{ height: 24, width: '80%' }} />
            <Skeleton style={{ height: 18, width: '40%' }} />
            <Skeleton style={{ height: 40, width: '50%' }} />
          </div>
          <Skeleton style={{ aspectRatio: '4 / 5' }} />
        </div>
      </div>
    );
  }

  if (!product) {
    return <p style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('product.notFound')}</p>;
  }

  const sku = (product.slug ?? product.id).toUpperCase().replace(/-/g, '_');

  return (
    <div
      className={className}
      data-pdp-variant="tech"
      style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}
    >
      <div style={gridStyle}>
        <div className="caspian-pdp-tech-info" style={{ display: 'flex', flexDirection: 'column', position: 'sticky', top: 24, alignSelf: 'start' }}>
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--caspian-accent, #22c55e)',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            // {brandName} · {sku.slice(0, 16)}
          </p>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: '-0.015em',
              margin: '10px 0 6px',
            }}
          >
            {product.name}
          </h1>
          <div style={{ display: 'flex', gap: 6, margin: '4px 0 18px' }}>
            {product.isNew && <Badge>{t('storefront.badges.new')}</Badge>}
            {product.limited && <Badge variant="destructive">{t('storefront.badges.limited')}</Badge>}
          </div>

          {totalReviews > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
              {t('product.reviewsSummary', { avg: avg.toFixed(1), count: totalReviews })}
            </p>
          )}

          {blurb && (
            <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, margin: '0 0 18px', fontSize: 14 }}>{blurb}</p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              padding: '14px 0',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 18,
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{formatPrice(product.price)}</p>
            <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'uppercase' }}>
              · In stock · 12mo warranty
            </p>
          </div>

          {derived.inventoryActive && derived.allOut && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                background: 'rgba(220,38,38,0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(220,38,38,0.3)',
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
            {t('product.addToCart')} →
          </Button>
        </div>
        <ProductGallery images={product.images} />
      </div>

      {(derived.hasDetails || derived.hasLongDescription) && (
        <section
          className="caspian-pdp-tech-details"
          style={{
            marginTop: 56,
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'var(--caspian-accent, #22c55e)',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            // Specifications
          </p>
          {derived.hasDetails && (
            <HtmlContent html={product.details} style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }} />
          )}
          {derived.hasLongDescription && (
            <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginTop: derived.hasDetails ? 20 : 0 }}>
              {product.description}
            </p>
          )}
        </section>
      )}

      {!hideReviews && (
        <section
          className="caspian-pdp-tech-reviews"
          style={{
            marginTop: 48,
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              color: 'var(--caspian-accent, #22c55e)',
              textTransform: 'uppercase',
              margin: '0 0 14px',
            }}
          >
            // Reviews
          </p>
          <ProductReviews
            productId={product.id}
            mode="reviews-only"
            onSummaryChange={({ average, total }) => {
              setAvg(average);
              setTotalReviews(total);
            }}
          />
        </section>
      )}
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 450px) minmax(0, 1fr)',
  gap: 48,
  alignItems: 'start',
};
