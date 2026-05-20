'use client';

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
 * The pull-quote is pure presentation (no Firestore reads); the copy is
 * static here. A future version may pull it from
 * `scriptSettings.editorialQuote` so admins can edit without forking the
 * template, but Phase 3's scope keeps it baked in.
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
  return (
    <main className={className}>
      <Hero hero={hero} />
      {afterHero}

      {!hideFeaturedCategories && <FeaturedCategoriesSection />}
      {afterFeaturedCategories}

      {/* Editorial pull-quote — slow, magazine-style typography break. */}
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
            We sell fewer pieces than most shops in our space, because we add a piece only when
            we&apos;ve used it ourselves and a maker has the capacity to produce it well.
          </blockquote>
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
            — From the journal
          </p>
        </div>
      </section>

      {!hideTrendingProducts && (
        <TrendingProductsSection getProductHref={getProductHref} formatPrice={formatPrice} />
      )}
      {afterTrendingProducts}

      {!hideNewsletter && <NewsletterSignup />}
      {afterNewsletter}
    </main>
  );
}
