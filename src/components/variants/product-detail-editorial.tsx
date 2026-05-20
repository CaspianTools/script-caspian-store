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
 * Editorial PDP variant — used by the `home-goods` template. Magazine-
 * style flow: gallery first (still 4:5 portrait), then info column
 * below the fold with serif typography, then a Story / Details section
 * that scrolls vertically rather than tabbed. Treats the product page
 * like a feature spread, not a transactional form.
 *
 * Reviews land below the editorial block in a quiet column so the page
 * still converts but the storytelling is the lead.
 */
export function ProductDetailEditorial(props: ProductDetailPageProps) {
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
      <div className={className} style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 0' }}>
        <Skeleton style={{ aspectRatio: '4 / 5', maxWidth: 600, margin: '0 auto' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 540, margin: '32px auto 0' }}>
          <Skeleton style={{ height: 14, width: '30%' }} />
          <Skeleton style={{ height: 28, width: '80%' }} />
          <Skeleton style={{ height: 18, width: '40%' }} />
          <Skeleton style={{ height: 40, width: '50%' }} />
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
      data-pdp-variant="editorial"
      style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 0' }}
    >
      <div className="caspian-pdp-editorial-gallery" style={{ maxWidth: 720, margin: '0 auto' }}>
        <ProductGallery images={product.images} />
      </div>

      <div
        className="caspian-pdp-editorial-info"
        style={{
          maxWidth: 600,
          margin: '48px auto 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {product.isNew && <Badge variant="outline">{t('storefront.badges.new')}</Badge>}
          {product.limited && <Badge variant="outline">{t('storefront.badges.limited')}</Badge>}
        </div>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.2em',
            color: 'var(--caspian-primary, #7c5d3f)',
            opacity: 0.7,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          {brandName}
        </p>
        <h1
          style={{
            fontFamily: 'var(--caspian-font-headline, var(--caspian-font-family, inherit))',
            fontSize: 'clamp(2rem, 4.5vw, 3rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            margin: '12px 0 16px',
            color: 'var(--caspian-primary, #7c5d3f)',
          }}
        >
          {product.name}
        </h1>

        {totalReviews > 0 && (
          <p style={{ color: 'var(--caspian-primary, #7c5d3f)', opacity: 0.6, fontSize: 13, marginTop: 0, marginBottom: 8 }}>
            {t('product.reviewsSummary', { avg: avg.toFixed(1), count: totalReviews })}
          </p>
        )}

        <p
          style={{
            fontSize: 22,
            fontWeight: 500,
            margin: '12px 0 24px',
            color: 'var(--caspian-primary, #7c5d3f)',
          }}
        >
          {formatPrice(product.price)}
        </p>

        {blurb && (
          <p
            style={{
              color: 'var(--caspian-primary, #7c5d3f)',
              opacity: 0.78,
              lineHeight: 1.7,
              fontSize: 16,
              margin: '0 0 28px',
              maxWidth: 480,
            }}
          >
            {blurb}
          </p>
        )}

        {derived.inventoryActive && derived.allOut && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.08)',
              color: '#7c1d1d',
              borderRadius: 'var(--caspian-radius, 6px)',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Out of stock — get in touch to be notified
          </div>
        )}

        <div style={purchaseRow}>
          {derived.hasSizes && (
            <div>
              <p style={selectorLabel}>{t('product.size')}</p>
              <SizeSelector
                sizes={product.sizes!}
                value={selectedSize}
                onChange={setSelectedSize}
                outOfStock={derived.outOfStockSizes}
              />
            </div>
          )}
          <div>
            <p style={selectorLabel}>{t('product.quantity')}</p>
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>
        </div>

        <Button size="lg" onClick={handleAddToCart}>
          {t('product.addToCart')}
        </Button>
      </div>

      {(derived.hasDetails || derived.hasLongDescription) && (
        <section
          className="caspian-pdp-editorial-story"
          style={{
            marginTop: 80,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.24em',
              color: 'var(--caspian-primary, #7c5d3f)',
              opacity: 0.6,
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: '0 0 18px',
            }}
          >
            Story &amp; Details
          </p>
          {derived.hasLongDescription && (
            <p
              style={{
                color: 'var(--caspian-primary, #7c5d3f)',
                opacity: 0.85,
                lineHeight: 1.75,
                whiteSpace: 'pre-wrap',
                fontSize: 16,
                margin: 0,
              }}
            >
              {product.description}
            </p>
          )}
          {derived.hasDetails && (
            <div style={{ marginTop: derived.hasLongDescription ? 28 : 0 }}>
              <HtmlContent
                html={product.details}
                style={{ color: 'var(--caspian-primary, #7c5d3f)', opacity: 0.8, lineHeight: 1.7 }}
              />
            </div>
          )}
        </section>
      )}

      {!hideReviews && (
        <section
          className="caspian-pdp-editorial-reviews"
          style={{
            marginTop: 72,
            paddingTop: 36,
            borderTop: '1px solid rgba(124, 93, 63, 0.18)',
            maxWidth: 720,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.24em',
              color: 'var(--caspian-primary, #7c5d3f)',
              opacity: 0.6,
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: '0 0 24px',
            }}
          >
            From buyers
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

const purchaseRow: CSSProperties = {
  display: 'flex',
  gap: 28,
  justifyContent: 'center',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: 24,
};

const selectorLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.18em',
  color: 'var(--caspian-primary, #7c5d3f)',
  opacity: 0.65,
  margin: '0 0 8px',
  textTransform: 'uppercase',
  textAlign: 'center',
};
