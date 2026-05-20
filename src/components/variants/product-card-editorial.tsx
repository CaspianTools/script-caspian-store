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

/**
 * Editorial product card — used by the `home-goods` template. 4:5
 * portrait image with no rounded corners, serif name below in larger
 * type, price as eyebrow. Hover scales the image and reveals a faint
 * "View product →" affordance at the bottom.
 *
 * No quick-add icon by design — the editorial look favors a clean
 * single-action card. The wishlist icon remains because saving to a
 * lookbook is on-brand. Hover micro-interactions live in
 * [home-goods/index.ts](../../templates/templates/home-goods/index.ts)'s
 * `css` field; the class hooks below match those selectors.
 */
export function ProductCardEditorial({
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

  return (
    <Link
      href={getProductHref(product.slug ?? product.id)}
      className={cn('caspian-product-card', 'caspian-product-card-editorial', className)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <div
          className="caspian-product-card-editorial-image"
          style={{
            position: 'relative',
            aspectRatio: '4 / 5',
            background: 'rgba(0,0,0,0.04)',
            overflow: 'hidden',
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
                color: '#999',
                fontSize: 13,
              }}
            >
              {t('storefront.noImage')}
            </div>
          )}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4 }}>
            {product.isNew && <Badge variant="outline">{t('storefront.badges.new')}</Badge>}
            {product.limited && <Badge variant="outline">{t('storefront.badges.limited')}</Badge>}
            {stockBadge === 'out-of-stock' && <Badge variant="outline">Out of stock</Badge>}
          </div>
          {showWishlistIcon && (
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <WishlistButton productId={product.id} />
            </div>
          )}
          <div
            className="caspian-product-card-editorial-cta"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '12px 14px',
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#fff',
              background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))',
              textAlign: 'center',
              opacity: 0,
              transition: 'opacity 250ms ease',
              pointerEvents: 'none',
            }}
          >
            View product →
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 2px' }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'rgba(0,0,0,0.55)',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {brandName}
          </p>
          <p
            style={{
              fontFamily: 'var(--caspian-font-headline, var(--caspian-font-family, inherit))',
              fontSize: 18,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.25,
              letterSpacing: '-0.005em',
            }}
          >
            {product.name}
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, margin: '4px 0 0', color: 'rgba(0,0,0,0.7)' }}>
            {formatPrice(product.price)}
            {priceSuffix && (
              <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.45)', fontSize: 11, marginLeft: 6 }}>
                {priceSuffix}
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
