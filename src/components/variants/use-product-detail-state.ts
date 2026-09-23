'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CartBehavior, InventorySettings, Product, ProductImage, TaxConfig } from '../../types';
import { getProductBySlugOrId } from '../../services/product-service';
import { getSiteSettings } from '../../services/site-settings-service';
import { getApprovedReviewsForProduct } from '../../services/review-service';
import { computeSummary } from '../reviews/product-reviews';
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
  hideReviews,
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
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [avg, setAvg] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [activeTab, setActiveTab] = useState<ProductDetailTabKey>('details');
  const [cartBehavior, setCartBehavior] = useState<CartBehavior | undefined>(cartBehaviorOverride);
  const [inventory, setInventory] = useState<InventorySettings | undefined>(inventoryOverride);
  // Only read for the related-products cards' price suffix; skipped along
  // with the settings fetch when both overrides are supplied.
  const [taxConfig, setTaxConfig] = useState<TaxConfig | undefined>();
  const sizeSelectorRef = useRef<HTMLDivElement | null>(null);

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
        setTaxConfig(s?.taxConfig);
      })
      .catch(() => {
        /* fall through to defaults */
      });
    return () => {
      alive = false;
    };
  }, [db, cartBehaviorOverride, inventoryOverride]);

  // Per-product UI state must not survive a product change: `<CaspianRoot>`
  // keys the page on the slug, but a consumer mounting this variant directly
  // and swapping `productSlugOrId` gets the same reset here.
  useEffect(() => {
    setSelectedSize(undefined);
    setSelectedColor(undefined);
    setQuantity(1);
    setActiveTab('details');
    setAvg(0);
    setTotalReviews(0);
  }, [lookupKey, externalProduct]);

  useEffect(() => {
    if (externalProduct) {
      setProduct(externalProduct);
      setLoading(false);
      if (externalProduct.sizes && externalProduct.sizes.length > 0) {
        setSelectedSize(externalProduct.sizes[0]);
      }
      setSelectedColor(externalProduct.colorVariants?.[0]?.name);
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
          setSelectedColor(p.colorVariants?.[0]?.name);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, lookupKey, externalProduct, onNotFound]);

  // The review summary line sits above the fold on every variant, but the
  // default variant only mounts <ProductReviews> once the Reviews tab is
  // opened — so on first paint the summary was always empty. Load it here.
  const loadedProductId = product?.id;
  useEffect(() => {
    if (!loadedProductId || hideReviews) return undefined;
    let alive = true;
    getApprovedReviewsForProduct(db, loadedProductId, 'recent')
      .then((reviews) => {
        if (!alive) return;
        const summary = computeSummary(reviews);
        setAvg(summary.average);
        setTotalReviews(summary.total);
      })
      .catch(() => {
        /* the Reviews tab reports its own failure; the summary line just stays hidden */
      });
    return () => {
      alive = false;
    };
  }, [db, loadedProductId, hideReviews]);

  const brandName = useBrandName(product?.brand);

  const blurb = useMemo(() => {
    if (!product) return '';
    return product.shortDescription?.trim() || defaultBlurb(product.description ?? '');
  }, [product]);

  const derived = useMemo(() => {
    if (!product) {
      return {
        hasSizes: false,
        hasColors: false,
        hasDetails: false,
        hasLongDescription: false,
        detailsTabHasContent: false,
        inventoryActive: false,
        outOfStockSizes: [] as string[],
        allOut: false,
      };
    }
    const hasSizes = !!(product.sizes && product.sizes.length > 0);
    const hasColors = !!(product.colorVariants && product.colorVariants.length > 0);
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
      hasColors,
      hasDetails,
      hasLongDescription,
      detailsTabHasContent,
      inventoryActive,
      outOfStockSizes,
      allOut,
    };
  }, [product, blurb, inventory]);

  // The chosen colour's image leads the gallery; the product's own images
  // follow (minus a duplicate of the variant image). Variants are keyed on
  // the gallery by colour so switching colour resets it to that image.
  const galleryImages = useMemo<ProductImage[]>(() => {
    const images = product?.images ?? [];
    const variant = product?.colorVariants?.find((v) => v.name === selectedColor);
    if (!variant?.imageUrl) return images;
    return [
      { id: `color-${variant.name}`, url: variant.imageUrl, alt: variant.name, hint: '' },
      ...images.filter((img) => img.url !== variant.imageUrl),
    ];
  }, [product, selectedColor]);

  const handleAddToCart = () => {
    if (!product) return;
    if (derived.allOut) {
      toast({ title: t('storefront.stock.outOfStock'), variant: 'destructive' });
      return;
    }
    if (derived.hasSizes && !selectedSize) {
      toast({ title: t('product.selectSize'), variant: 'destructive' });
      return;
    }
    if (derived.hasColors && !selectedColor) {
      toast({ title: t('product.selectColor'), variant: 'destructive' });
      return;
    }
    if (
      derived.inventoryActive &&
      selectedSize &&
      isSizeOutOfStock(product.stock, selectedSize, inventory)
    ) {
      toast({ title: t('product.sizeOutOfStock'), variant: 'destructive' });
      return;
    }
    addToCart(product, quantity, selectedSize, derived.hasColors ? selectedColor : undefined);
    toast({ title: t('product.addedToCart'), description: product.name, variant: 'success' });
    setQuantity(1);
    if (cartBehavior?.redirectToCartAfterAdd) {
      nav.push(cartHref);
    }
  };

  // The phone sticky bar sits far from the size selector, so a missing size
  // brings the shopper to it instead of failing with a toast they can't act on.
  const handleStickyAddToCart = () => {
    if (derived.hasSizes && !selectedSize && sizeSelectorRef.current) {
      sizeSelectorRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      sizeSelectorRef.current.focus({ preventScroll: true });
      return;
    }
    handleAddToCart();
  };

  const stickyHint = !product
    ? ''
    : derived.hasSizes && !selectedSize
      ? t('product.selectSize')
      : derived.inventoryActive && derived.allOut
        ? t('storefront.stock.outOfStock')
        : selectedSize
          ? t('product.stickyCta.sizeHint', { size: selectedSize })
          : derived.inventoryActive
            ? t('storefront.stock.inStock')
            : '';

  return {
    product,
    loading,
    brandName,
    blurb,
    selectedSize,
    setSelectedSize,
    selectedColor,
    setSelectedColor,
    galleryImages,
    sizeSelectorRef,
    handleStickyAddToCart,
    stickyHint,
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
    taxConfig,
    cartBehavior,
    derived,
    t,
  };
}
