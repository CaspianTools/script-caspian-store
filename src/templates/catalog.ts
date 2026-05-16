/**
 * Registry of every storefront template the script ships. Adding a new
 * template means: create a folder under `templates/<id>/`, default-export
 * its [TemplateDefinition](./types.ts), and register it here.
 *
 * Order in this object drives display order in the `/admin/templates`
 * grid and the setup-wizard tile row.
 */

import type { TemplateDefinition } from './types';
import { fashionMinimalTemplate } from './templates/fashion-minimal';
import { electronicsTechTemplate } from './templates/electronics-tech';
import { homeGoodsTemplate } from './templates/home-goods';

export const TEMPLATE_CATALOG: Record<string, TemplateDefinition> = {
  [fashionMinimalTemplate.id]: fashionMinimalTemplate,
  [electronicsTechTemplate.id]: electronicsTechTemplate,
  [homeGoodsTemplate.id]: homeGoodsTemplate,
};

/**
 * Ordered list — use this in UI surfaces (cards, tiles) so display order
 * is deterministic and matches the registration order above.
 */
export const TEMPLATE_LIST: TemplateDefinition[] = [
  fashionMinimalTemplate,
  electronicsTechTemplate,
  homeGoodsTemplate,
];

/**
 * Get a template by id. Returns `undefined` for unknown ids — callers
 * should handle the missing case (e.g. user picked a deprecated template
 * id from an old admin link).
 */
export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATE_CATALOG[id];
}
