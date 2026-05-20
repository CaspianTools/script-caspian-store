'use client';

import type { CartBehavior, InventorySettings, Product } from '../types';
import { useTemplateComponent } from '../provider/template-provider';
import { ProductDetailDefault } from './variants/product-detail-default';

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

/**
 * Product detail page — dispatched through
 * `useTemplateComponent('ProductDetailPage', …)` so the active storefront
 * template can register its own layout.
 *
 *   - **Default** / `fashion-minimal` → [`ProductDetailDefault`](./variants/product-detail-default.tsx)
 *     (gallery left, info right, tabs below)
 *   - `electronics-tech` → [`ProductDetailTech`](./variants/product-detail-tech.tsx)
 *     (info LEFT with sticky spec-sheet, gallery right, details + reviews
 *     scroll inline)
 *   - `home-goods` → [`ProductDetailEditorial`](./variants/product-detail-editorial.tsx)
 *     (gallery full-width centred, info column below, magazine-style
 *     story section)
 *
 * v9.0.0-alpha.4 — Phase 4 of the theme rearchitecture. State is shared
 * across variants via `useProductDetailState()`; the variants are pure
 * JSX wrappers. Consumers see no API change.
 */
export function ProductDetailPage(props: ProductDetailPageProps) {
  const Component = useTemplateComponent('ProductDetailPage', ProductDetailDefault);
  return <Component {...props} />;
}
