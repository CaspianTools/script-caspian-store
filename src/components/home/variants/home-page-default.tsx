'use client';

import { Hero } from '../hero';
import { FeaturedCategoriesSection } from '../featured-categories-section';
import { TrendingProductsSection } from '../trending-products-section';
import { NewsletterSignup } from '../newsletter-signup';
import type { HomePageProps } from '../home-page';

/**
 * Default homepage layout — the section composition shipped from v1.2
 * through v8.x and used by the `fashion-minimal` template (and by any
 * install with no template active).
 *
 * Flow: **Hero → Featured Categories → Trending Products → Newsletter**.
 *
 * The slot-injection props (`afterHero`, `afterFeaturedCategories`, ...)
 * are preserved so consumers who were already injecting custom blocks
 * keep their composition working unchanged.
 *
 * Extracted from `home-page.tsx` in v9.0.0-alpha.3 so the outer
 * `<HomePage>` can dispatch to one of three variants via
 * `useTemplateComponent('HomePage', HomePageDefault)`.
 */
export function HomePageDefault({
  hero,
  hideFeaturedCategories,
  hideTrendingProducts,
  hideNewsletter,
  afterHero,
  afterFeaturedCategories,
  afterTrendingProducts,
  afterNewsletter,
  getProductHref,
  formatPrice,
  className,
}: HomePageProps) {
  return (
    <main className={className}>
      <Hero hero={hero} />
      {afterHero}
      {!hideFeaturedCategories && <FeaturedCategoriesSection />}
      {afterFeaturedCategories}
      {!hideTrendingProducts && (
        <TrendingProductsSection getProductHref={getProductHref} formatPrice={formatPrice} />
      )}
      {afterTrendingProducts}
      {!hideNewsletter && <NewsletterSignup />}
      {afterNewsletter}
    </main>
  );
}
