import type { ReactNode } from 'react';

/**
 * Taxonomy catalog contract. Mirrors the plugin-catalog pattern
 * (shipping/payments/email) — a static list of common product taxonomies a
 * store can enable. Each entry is either the bespoke Brands page (`kind:
 * 'brands'`, backed by `productBrands`) or a generic flat term list (`kind:
 * 'generic'`, backed by the shared `taxonomyTerms` collection keyed by `id`).
 *
 * Engine-safe: imports only icons from `src/ui` — no admin-page imports, so it's
 * importable by the admin Settings page, the Taxonomies shell, and the setup
 * wizard alike. The shell does the `kind → Component` mapping locally.
 */

export type TaxonomyKind = 'brands' | 'generic';

export type TaxonomyGroupId = 'merchandising' | 'attributes' | 'audience' | 'careOrigin';

export interface TaxonomyDef {
  /** Stable id — also the `type` value on `taxonomyTerms` docs and the URL slug. */
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: ReactNode;
  group: TaxonomyGroupId;
  /** Enabled out of the box when the store has never set `enabledTaxonomies`. */
  defaultEnabled: boolean;
  kind: TaxonomyKind;
}

export interface TaxonomyGroupDef {
  id: TaxonomyGroupId;
  labelKey: string;
}
