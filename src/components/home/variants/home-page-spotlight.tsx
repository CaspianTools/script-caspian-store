'use client';

import { useScriptSettings } from '../../../context/script-settings-context';
import { Hero } from '../hero';
import { FeaturedCategoriesSection } from '../featured-categories-section';
import { TrendingProductsSection } from '../trending-products-section';
import { NewsletterSignup } from '../newsletter-signup';
import type { HomePageProps } from '../home-page';

/**
 * Spotlight homepage layout — used by the `electronics-tech` template.
 * Tech buyers want the catalog visible immediately, so the section flow
 * is reordered to lead with products instead of categories:
 *
 *   **Hero → Trending Products → Featured Categories → Newsletter**.
 *
 * Adds a slim spec-strip below the hero showing the merchant's
 * `ScriptSettings.copy.tagline` (falling back to the brand description);
 * omitted when neither is set. Slot-injection props are preserved but reordered to match
 * the new flow — `afterFeaturedCategories` now fires AFTER the (later)
 * categories block, which is the user-expected semantic.
 */
export function HomePageSpotlight({
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
  const { settings } = useScriptSettings();
  const tagline = settings.copy?.tagline?.trim() || settings.brandDescription?.trim();
  return (
    <main className={className}>
      <Hero hero={hero} />

      {tagline && (
        <section
          className="caspian-home-spotlight-spec-strip"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'center',
            gap: 28,
            flexWrap: 'wrap',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
          }}
        >
          <span>// {tagline}</span>
        </section>
      )}
      {afterHero}

      {!hideTrendingProducts && (
        <TrendingProductsSection getProductHref={getProductHref} formatPrice={formatPrice} />
      )}
      {afterTrendingProducts}

      {!hideFeaturedCategories && <FeaturedCategoriesSection />}
      {afterFeaturedCategories}

      {!hideNewsletter && <NewsletterSignup />}
      {afterNewsletter}
    </main>
  );
}
