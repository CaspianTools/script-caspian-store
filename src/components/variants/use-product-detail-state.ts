'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CartBehavior, InventorySettings, Product } from '../../types';
import { getProductBySlugOrId } from '../../services/product-service';
import { getSiteSettings } from '../../services/site-settings-service';
import { isProductOutOfStock, isSizeOutOfStock } from '../../utils/inventory';
import { useCaspianFirebase, useCaspianNavigation } from '../../provider/caspian-store-provider';
import { useCart } from '../../context/cart-context';
import { useBrandName } from '../../hooks/use-brands';
import { useT } from '../../i18n/locale-context';
import { useToast } from '../../ui/toast';
import type { ProductDetailPageProps } from '../product-detail-page';

export type ProductDetailTabKey = 'details' | 'reviews' | 'questions';

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

/**
 * Shared state + side-effects for every `<ProductDetailPage>` variant
 * (default / tech / editorial). Variants accept `ProductDetailPageProps`,
 * call this hook, and use the returned values to render their layout.
 *
 * v9.0.0-alpha.4 — extracting this avoids triplicating ~200 lines of
 * state management when the only thing variants actually differ on is
 * JSX layout + typography. New fields on the state shape automatically
 * flow to every variant without per-variant edits.
 */
export function useProductDetailState({
  productSlugOrId,
  productId,
  product: externalProduct,
  cartBehavior: cartBehaviorOverride,
  cartHref = '/cart',
  inventory: inventoryOverride,
  onNotFound,
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
  const [activeTab, setActiveTab] = useState<ProductDetailTabKey>('details');
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

  const derived = useMemo(() => {
    if (!product) {
      return {
        hasSizes: false,
        hasDetails: false,
        hasLongDescription: false,
        detailsTabHasContent: false,
        inventoryActive: false,
        outOfStockSizes: [] as string[],
        allOut: false,
      };
    }
    const hasSizes = !!(product.sizes && product.sizes.length > 0);
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
    return {
      hasSizes,
      hasDetails,
      hasLongDescription,
      detailsTabHasContent,
      inventoryActive,
      outOfStockSizes,
      allOut,
    };
  }, [product, blurb, inventory]);

  const handleAddToCart = () => {
    if (!product) return;
    if (derived.allOut) {
      toast({ title: 'Out of stock', variant: 'destructive' });
      return;
    }
    if (derived.hasSizes && !selectedSize) {
      toast({ title: t('product.selectSize'), variant: 'destructive' });
      return;
    }
    if (
      derived.inventoryActive &&
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

  return {
    product,
    loading,
    brandName,
    blurb,
    selectedSize,
    setSelectedSize,
    quantity,
    setQuantity,
    avg,
    setAvg,
    totalReviews,
    setTotalReviews,
    activeTab,
    setActiveTab,
    handleAddToCart,
    inventory,
    cartBehavior,
    derived,
    t,
  };
}
