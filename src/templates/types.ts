/**
 * Storefront template system (v8.23.0).
 *
 * A **template** is a strict superset of a `ThemeTokens` preset: it bundles
 * the theme along with sample products, categories, hero content, pages,
 * and (optionally) journal articles. Applying a template seeds an empty
 * Firestore so a brand-new install renders a complete storefront on day
 * one instead of an empty grid.
 *
 * Image references are Unsplash CDN URLs hand-picked per template for
 * visual coherence — see `IMAGE_URL_HELP` for the URL shape. Templates
 * never bundle binary images; the npm tarball stays lean and Unsplash's
 * CDN handles first-paint imagery.
 *
 * Apply semantics: see `applyTemplate()` in [apply-template.ts](./apply-template.ts).
 */

import type {
  FeatureFlags,
  HeroTokens,
  JournalArticle,
  PageContent,
  Product,
  ProductCategoryDoc,
  ThemeTokens,
} from '../types';

/**
 * Vertical / industry the template targets. Drives the badge shown in the
 * `/admin/templates` grid and the setup-wizard step.
 */
export type TemplateVertical = 'fashion' | 'electronics' | 'home-goods';

/**
 * Slimmed-down shapes used inside template definitions. Templates write
 * to Firestore through [apply-template.ts](./apply-template.ts), which
 * fills in `id`, `createdAt`, `updatedAt`, etc. — fields a template
 * author should never have to set by hand.
 */
export type TemplateProduct = Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & {
  /** Stable id used as the Firestore doc id. */
  id: string;
};
export type TemplateCategory = Omit<ProductCategoryDoc, 'createdAt'>;
export type TemplatePage = Omit<PageContent, 'updatedAt'>;
export type TemplateJournal = Omit<JournalArticle, 'createdAt'>;

/**
 * Tiny preview metadata shown in the `/admin/templates` grid card and the
 * setup-wizard tile. Renders without needing to load the full template.
 */
export interface TemplatePreview {
  /** 4 hex colors used in the wordmark + chip preview, in order: bg, foreground, accent1, accent2. */
  swatch: [string, string, string, string];
  /** Single representative Unsplash URL shown as the card thumbnail. */
  heroImageUrl: string;
}

/**
 * Optional branding defaults the template suggests at apply time. The
 * admin can override any of these in the post-apply settings page; we
 * only write them when the corresponding field in `settings/site` is
 * still empty (in merge mode) or always (in replace mode).
 */
export interface TemplateBrandingDefaults {
  logoUrl?: string;
  faviconUrl?: string;
  brandDescription?: string;
}

/**
 * A complete template definition. One of these lives in
 * `src/templates/templates/<id>/index.ts` and is registered in
 * [catalog.ts](./catalog.ts).
 */
export interface TemplateDefinition {
  /** URL-safe id used as the Firestore key and in the catalog map. */
  id: string;
  /** Display name shown in the picker. */
  name: string;
  /** Short tagline shown under the name in the catalog card. */
  description: string;
  /** Vertical badge — drives the chip color and the i18n label. */
  vertical: TemplateVertical;
  /** Template version. Bump when the bundled content changes; surfaced in `/admin/about` later. */
  version: string;
  /** Theme tokens applied to `scriptSettings/site.theme` on apply. */
  theme: ThemeTokens;
  /** Hero content written to `scriptSettings/site.hero`. */
  hero: HeroTokens;
  /** Feature flag preset written to `scriptSettings/site.features`. Merged with existing flags in merge mode. */
  features: Partial<FeatureFlags>;
  /** Optional branding hints written to `settings/site` (logoUrl etc.). */
  branding?: TemplateBrandingDefaults;
  /** Sample categories. Written to `productCategories/{id}`. */
  categories: TemplateCategory[];
  /** Sample products. Written to `products/{id}`. */
  products: TemplateProduct[];
  /** Editable page content (about / privacy / terms / shipping-returns / size-guide). Written to `pageContents/{id}`. */
  pages: TemplatePage[];
  /** Optional editorial articles. Written to `journal/{id}`. */
  journal?: TemplateJournal[];
  /** Metadata for the catalog grid card. */
  preview: TemplatePreview;
}

/**
 * Result returned by `applyTemplate()`. Counts are what was *written*
 * (in merge mode this can be 0 for collections that already had content;
 * in replace mode it equals the template's bundled count).
 */
export interface ApplyTemplateResult {
  ok: true;
  templateId: string;
  mode: ApplyTemplateMode;
  written: {
    categories: number;
    products: number;
    pages: number;
    journal: number;
    settings: boolean;
  };
  skipped: {
    categories: number;
    products: number;
    pages: number;
    journal: number;
  };
}

/**
 * `merge` — keep existing docs, only write docs whose id is unused.
 *           Safe to re-apply.
 * `replace` — delete the template-owned collections first, then write.
 *             Destructive; UI confirms before invoking.
 */
export type ApplyTemplateMode = 'merge' | 'replace';

export interface ApplyTemplateOptions {
  mode?: ApplyTemplateMode;
  /**
   * When true, returns the result *without* writing to Firestore. Used by
   * the admin UI to show a diff preview before confirming.
   */
  dryRun?: boolean;
}

/**
 * Helper used inside template `<id>/preview.ts` files to keep the
 * Unsplash URL shape consistent. Pass a photo id (the slug after
 * `/photos/` in a Unsplash URL) and a width; the helper returns the
 * canonical CDN URL with format autoconversion and quality clamp.
 *
 * License: Unsplash terms grant free use for any purpose including
 * commercial, no attribution required.
 */
export function unsplashUrl(photoId: string, width = 1600): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

/**
 * Documentation constant for template authors / consumer-side reviewers.
 * Exported so the admin "About template" tooltip can pull from a single
 * source of truth.
 */
export const IMAGE_URL_HELP =
  'Templates reference Unsplash hosted images via `images.unsplash.com/photo-<id>` URLs. License: free for any use including commercial, no attribution required. Admins can replace any sample image after applying.';
