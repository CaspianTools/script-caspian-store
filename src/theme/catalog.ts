/**
 * Theme catalog barrel.
 *
 * Each theme lives in its own folder under `src/theme/themes/<id>/index.ts` so
 * that modifications to one preset are localized — both in version control
 * (one file changed in the diff) and in the Appearance admin UX (only the
 * touched theme's card shows the "Updated" pill, via per-theme `version`
 * strings + the `useThemeUpdateTracker` hook).
 *
 * To add a new preset: create `src/theme/themes/<my-theme>/index.ts` exporting
 * a `CatalogTheme` default, then add the import + array entry below. The order
 * of `THEME_CATALOG` is the order shown to admins in the grid.
 */
import type { CatalogTheme, ThemeCategory } from './types';

import luivante from './themes/luivante';
import cleanWhite from './themes/clean-white';
import minimalDark from './themes/minimal-dark';
import boutique from './themes/boutique';
import editorial from './themes/editorial';
import neonShop from './themes/neon-shop';
import pastelStudio from './themes/pastel-studio';
import academy from './themes/academy';
import kitchenTable from './themes/kitchen-table';
import forumBlue from './themes/forum-blue';
import runway from './themes/runway';

export type { CatalogTheme, ThemeCategory, ThemeThumbnail } from './types';
export { THEME_CATEGORY_LABELS } from './types';

export const THEME_CATALOG: readonly CatalogTheme[] = [
  luivante,
  cleanWhite,
  minimalDark,
  boutique,
  editorial,
  neonShop,
  pastelStudio,
  academy,
  kitchenTable,
  forumBlue,
  runway,
];

export function findCatalogTheme(id: string): CatalogTheme | undefined {
  return THEME_CATALOG.find((t) => t.id === id);
}

export function countThemesByCategory(): Record<ThemeCategory, number> {
  const counts: Record<ThemeCategory, number> = {
    all: THEME_CATALOG.length,
    corporate: 0,
    shop: 0,
    creative: 0,
    portfolio: 0,
    education: 0,
    'health-beauty': 0,
    events: 0,
    food: 0,
    marketing: 0,
    minimal: 0,
  };
  for (const theme of THEME_CATALOG) {
    for (const cat of theme.categories) counts[cat] += 1;
  }
  return counts;
}
