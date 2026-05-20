'use client';

import type { ReactNode } from 'react';
import { useTemplateComponent } from '../../provider/template-provider';
import type { HeroProps } from './hero';
import { HomePageDefault } from './variants/home-page-default';

export interface HomePageProps {
  /** Override hero content (otherwise read from script settings). */
  hero?: HeroProps['hero'];
  /** Hide individual sections if you want to compose differently. */
  hideFeaturedCategories?: boolean;
  hideTrendingProducts?: boolean;
  hideNewsletter?: boolean;
  /** Slots to inject custom blocks between built-in sections. */
  afterHero?: ReactNode;
  afterFeaturedCategories?: ReactNode;
  afterTrendingProducts?: ReactNode;
  afterNewsletter?: ReactNode;
  /** Passed through to the product grid. */
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  className?: string;
}

/**
 * Drop-in homepage — dispatched through
 * `useTemplateComponent('HomePage', …)` so the active storefront template
 * can register its own section composition.
 *
 *   - **Default** / `fashion-minimal` → [`HomePageDefault`](./variants/home-page-default.tsx)
 *     (Hero → FeaturedCategories → TrendingProducts → Newsletter)
 *   - `electronics-tech` → [`HomePageSpotlight`](./variants/home-page-spotlight.tsx)
 *     (Hero → spec-strip → TrendingProducts → FeaturedCategories → Newsletter)
 *   - `home-goods` → [`HomePageEditorial`](./variants/home-page-editorial.tsx)
 *     (Hero → FeaturedCategories → editorial pull-quote → TrendingProducts → Newsletter)
 *
 * v9.0.0-alpha.3 — Phase 3 of the theme rearchitecture. The wrapper
 * forwards every prop; consumers see no API change. The slot-injection
 * props (`afterHero`, `afterFeaturedCategories`, ...) are honored by all
 * three variants — but note that the *semantic position* of each slot
 * follows that variant's section order, not the default order. If you
 * depend on a slot landing at a specific visual position, render your
 * own composition using the individual section exports.
 */
export function HomePage(props: HomePageProps) {
  const Component = useTemplateComponent('HomePage', HomePageDefault);
  return <Component {...props} />;
}
