'use client';

import type { InventorySettings, Product, TaxConfig } from '../types';
import { useTemplateComponent } from '../provider/template-provider';
import { ProductCardStandard } from './variants/product-card-standard';

export interface ProductCardProps {
  product: Product;
  /** Build the URL for clicking the card. Default: `/product/{id}`. */
  getProductHref?: (productId: string) => string;
  className?: string;
  /** Formatter for price display. Default: `$price.toFixed(2)`. */
  formatPrice?: (price: number) => string;
  /**
   * Merchant inventory settings. When omitted (or `trackStock: false`), no
   * stock badge renders — preserving pre-v2.9 behavior. Wire from
   * `SiteSettings.inventory` upstream. Added in v2.9.
   */
  inventory?: InventorySettings;
  /**
   * Tax display config. When set, the card renders the configured
   * `priceDisplaySuffix` after the price (e.g. "incl. VAT"). Added in v2.12.
   */
  taxConfig?: TaxConfig;
}

/**
 * Product card — dispatched through `useTemplateComponent('ProductCard', …)`
 * so the active storefront template can register its own variant.
 *
 *   - **Default** / `fashion-minimal` → [`ProductCardStandard`](./variants/product-card-standard.tsx)
 *   - `electronics-tech` → [`ProductCardCompact`](./variants/product-card-compact.tsx)
 *   - `home-goods` → [`ProductCardEditorial`](./variants/product-card-editorial.tsx)
 *
 * v9.0.0-alpha.3 — Phase 3 of the theme rearchitecture. The wrapper
 * forwards every prop; consumers see no API change. Pre-v9 callers of
 * `<ProductCard>` continue to render the standard implementation when
 * no template is active.
 */
export function ProductCard(props: ProductCardProps) {
  const Component = useTemplateComponent('ProductCard', ProductCardStandard);
  return <Component {...props} />;
}
