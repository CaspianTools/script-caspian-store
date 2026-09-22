'use client';

import { useScriptSettings } from '../../../context/script-settings-context';
import { useT } from '../../../i18n/locale-context';
import { Hero } from '../hero';
import { FeaturedCategoriesSection } from '../featured-categories-section';
import { TrendingProductsSection } from '../trending-products-section';
import { NewsletterSignup } from '../newsletter-signup';
import type { HomePageProps } from '../home-page';

/**
 * Editorial homepage layout — used by the `home-goods` template.
 * Threads an editorial pull-quote section between featured categories
 * and trending products, treating the storefront more like a magazine
 * than a catalog:
 *
 *   **Hero → Featured Categories → Editorial Pull-Quote → Trending Products → Newsletter**.
 *
 * The pull-quote reads `ScriptSettings.copy.quote` (falling back to the
 * brand description) with `copy.quoteAttribution` (falling back to the
 * brand name) underneath; with nothing to quote the section is omitted.
 */
export function HomePageEditorial({
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
  const t = useT();
  const quote = settings.copy?.quote?.trim() || settings.brandDescription?.trim();
  const attribution =
    settings.copy?.quoteAttribution?.trim() ||
    (settings.brandName?.trim()
      ? t('home.quote.attributionFallback', { brand: settings.brandName.trim() })
      : '');
  return (
    <main className={className}>
      <Hero hero={hero} />
      {afterHero}

      {!hideFeaturedCategories && <FeaturedCategoriesSection />}
      {afterFeaturedCategories}

      {quote && (
        <section
          className="caspian-home-editorial-quote"
          style={{
            background: 'var(--caspian-background, #fdfaf4)',
            padding: 'clamp(60px, 10vw, 120px) clamp(24px, 6vw, 80px)',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <span
              aria-hidden
              style={{
                fontFamily: 'var(--caspian-font-headline, var(--caspian-font-family, inherit))',
                fontSize: 'clamp(3rem, 8vw, 6rem)',
                color: 'var(--caspian-accent, #a07a4c)',
                lineHeight: 0.8,
                display: 'block',
                marginBottom: 12,
              }}
            >
              &ldquo;
            </span>
            <blockquote
              style={{
                fontFamily: 'var(--caspian-font-headline, var(--caspian-font-family, inherit))',
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                lineHeight: 1.3,
                fontWeight: 400,
                fontStyle: 'italic',
                margin: 0,
                color: 'var(--caspian-primary, #7c5d3f)',
              }}
            >
              {quote}
            </blockquote>
            {attribution && (
              <p
                style={{
                  marginTop: 20,
                  fontSize: 12,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--caspian-primary, #7c5d3f)',
                  opacity: 0.6,
                }}
              >
                {attribution}
              </p>
            )}
          </div>
        </section>
      )}

      {!hideTrendingProducts && (
        <TrendingProductsSection getProductHref={getProductHref} formatPrice={formatPrice} />
      )}
      {afterTrendingProducts}

      {!hideNewsletter && <NewsletterSignup />}
      {afterNewsletter}
    </main>
  );
}
