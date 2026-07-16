import { COLLECTIONS_GRID_SECTION } from './sections/collections-grid-section';
import { EDITORIAL_SPLIT_SECTION } from './sections/editorial-split-section';
import { FEATURED_PRODUCTS_SECTION } from './sections/featured-products-section';
import { HERO_SECTION } from './sections/hero-section';
import { STORY_PANEL_SECTION } from './sections/story-panel-section';
import { TRUST_STRIP_SECTION } from './sections/trust-strip-section';
import { HEADING_WIDGET } from './widgets/heading-widget';
import { TEXT_WIDGET } from './widgets/text-widget';
import { IMAGE_WIDGET } from './widgets/image-widget';
import { BUTTON_WIDGET } from './widgets/button-widget';
import { SPACER_WIDGET } from './widgets/spacer-widget';
import { DIVIDER_WIDGET } from './widgets/divider-widget';
import { EMBED_WIDGET } from './widgets/embed-widget';
import { CONTAINER_BLOCK } from './layout/container-block';
import { COLUMNS_BLOCK } from './layout/columns-block';
import { COLUMN_BLOCK } from './layout/column-block';
import type { BlockCategory, BlockType, SectionType } from './types';

/**
 * Static block catalog. The v9.3 page builder shipped six content-rich
 * *sections*; the v9.4 builder adds atomic *widgets* (and, later, *layout*
 * containers) under the same contract. Every entry — section or widget — is
 * keyed by its `type`. The renderer and the editor both resolve a
 * `PageBlock.type` through `getBlockType`.
 *
 * To add a block: create a file under `sections/` or `widgets/`, export its
 * `BlockType`, register it here, and (for premade homepage sections only) add
 * it to `HOME_SECTION_ORDER` so it appears in the default homepage seed.
 * Widgets are inserted on demand from the editor's insert panel, never seeded.
 */
export const BLOCK_CATALOG: Record<string, BlockType> = {
  // Premade sections (category: 'section', the v9.3 set).
  [HERO_SECTION.type]: HERO_SECTION,
  [TRUST_STRIP_SECTION.type]: TRUST_STRIP_SECTION,
  [COLLECTIONS_GRID_SECTION.type]: COLLECTIONS_GRID_SECTION,
  [EDITORIAL_SPLIT_SECTION.type]: EDITORIAL_SPLIT_SECTION,
  [FEATURED_PRODUCTS_SECTION.type]: FEATURED_PRODUCTS_SECTION,
  [STORY_PANEL_SECTION.type]: STORY_PANEL_SECTION,
  // Atomic widgets (category: 'widget', v9.4 builder).
  [HEADING_WIDGET.type]: HEADING_WIDGET,
  [TEXT_WIDGET.type]: TEXT_WIDGET,
  [IMAGE_WIDGET.type]: IMAGE_WIDGET,
  [BUTTON_WIDGET.type]: BUTTON_WIDGET,
  [SPACER_WIDGET.type]: SPACER_WIDGET,
  [DIVIDER_WIDGET.type]: DIVIDER_WIDGET,
  [EMBED_WIDGET.type]: EMBED_WIDGET,
  // Layout containers (category: 'layout', v9.4 Phase 2 — hold nested children).
  [CONTAINER_BLOCK.type]: CONTAINER_BLOCK,
  [COLUMNS_BLOCK.type]: COLUMNS_BLOCK,
  [COLUMN_BLOCK.type]: COLUMN_BLOCK,
};

/** Back-compat alias for the v9.3 export name. */
export const SECTION_CATALOG = BLOCK_CATALOG;

/** Default homepage section order — also the seed order for a fresh install. */
export const HOME_SECTION_ORDER: string[] = [
  HERO_SECTION.type,
  TRUST_STRIP_SECTION.type,
  COLLECTIONS_GRID_SECTION.type,
  EDITORIAL_SPLIT_SECTION.type,
  FEATURED_PRODUCTS_SECTION.type,
  STORY_PANEL_SECTION.type,
];

/** A block's catalog category, defaulting to `'section'` when unset (v9.3 entries). */
export function blockCategoryOf(entry: BlockType): BlockCategory {
  return entry.category ?? 'section';
}

export function getBlockType(type: string): BlockType | null {
  return BLOCK_CATALOG[type] ?? null;
}

export function listBlockTypes(): BlockType[] {
  return Object.values(BLOCK_CATALOG);
}

/** Blocks of a given catalog category (used by the editor's insert panel). */
export function listBlockTypesByCategory(category: BlockCategory): BlockType[] {
  return listBlockTypes().filter((e) => blockCategoryOf(e) === category);
}

// --- v9.3 names, preserved so existing imports keep working ---

export function getSectionType(type: string): SectionType | null {
  return getBlockType(type);
}

export function listSectionTypes(): SectionType[] {
  return listBlockTypes();
}
