'use client';

import type { ProductCardProps } from '../product-card';
import { useCaspianLink, useCaspianImage } from '../../provider/caspian-store-provider';
import { useBrandName } from '../../hooks/use-brands';
import { useT } from '../../i18n/locale-context';
import { useScriptSettings } from '../../context/script-settings-context';
import { Badge } from '../../ui/misc';
import { cn } from '../../utils/cn';
import { resolveStockBadge } from '../../utils/inventory';
import { renderPriceSuffix } from '../../utils/tax';
import { WishlistButton } from '../wishlist-button';
import { QuickAddToCartButton } from '../quick-add-to-cart-button';

/**
 * Compact / tech product card — used by the `electronics-tech` template.
 * Square 1:1 image on a dark plinth, monospace brand/sku-ish eyebrow,
 * tight stat-strip below with name + price split horizontally. Hover
 * slides an accent line in under the name and lifts the card slightly.
 *
 * Quick-add stays visible; tech buyers move fast and quick-add is part
 * of the "feels like a product spec sheet" identity. Hover micro-
 * interactions live in
 * [electronics-tech/index.ts](../../templates/templates/electronics-tech/index.ts)
 * 's `css` field.
 */
export function ProductCardCompact({
  product,
  getProductHref = (id) => `/product/${id}`,
  className,
  formatPrice = (p) => `$${p.toFixed(2)}`,
  inventory,
  taxConfig,
}: ProductCardProps) {
  const Link = useCaspianLink();
  const Image = useCaspianImage();
  const t = useT();
  const brandName = useBrandName(product.brand);
  const { settings } = useScriptSettings();
  const img = product.images?.[0];
  const stockBadge = inventory ? resolveStockBadge(product, inventory) : null;
  const priceSuffix = renderPriceSuffix(taxConfig);
  const showWishlistIcon =
    (settings.productCard?.showWishlistIcon ?? true) && settings.features.wishlist;
  const showQuickAddIcon = settings.productCard?.showQuickAddIcon ?? true;

  return (
    <Link
      href={getProductHref(product.slug ?? product.id)}
      className={cn('caspian-product-card', 'caspian-product-card-compact', className)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          color: 'inherit',
          textDecoration: 'none',
          padding: 12,
          borderRadius: 'var(--caspian-radius, 6px)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'border-color 200ms ease, transform 200ms ease, background 200ms ease',
        }}
      >
        <div
          className="caspian-product-card-compact-image"
          style={{
            position: 'relative',
            aspectRatio: '1 / 1',
            background: '#111',
            overflow: 'hidden',
            borderRadius: 'calc(var(--caspian-radius, 6px) - 2px)',
          }}
        >
          {img ? (
            <Image src={img.url} alt={img.alt || product.name} fill />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#444',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {t('storefront.noImage')}
            </div>
          )}
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
            {product.isNew && <Badge>{t('storefront.badges.new')}</Badge>}
            {product.limited && <Badge variant="destructive">{t('storefront.badges.limited')}</Badge>}
            {stockBadge === 'out-of-stock' && <Badge variant="destructive">Out</Badge>}
          </div>
          {showWishlistIcon && (
            <div style={{ position: 'absolute', top: 6, right: 6 }}>
              <WishlistButton productId={product.id} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <p
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--caspian-accent, #22c55e)',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {brandName}
          </p>
          <p
            className="caspian-product-card-compact-name"
            style={{
              fontSize: 14,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.3,
              position: 'relative',
              paddingBottom: 6,
            }}
          >
            {product.name}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 2,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              {formatPrice(product.price)}
              {priceSuffix && (
                <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.55)', fontSize: 11, marginLeft: 6 }}>
                  {priceSuffix}
                </span>
              )}
            </p>
            {showQuickAddIcon && <QuickAddToCartButton product={product} />}
          </div>
        </div>
      </div>
    </Link>
  );
}
