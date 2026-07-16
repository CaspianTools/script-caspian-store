import type { ComponentType, ReactNode } from 'react';
import type { SiteSettings } from '../types';

/**
 * Page-builder section catalog contract (v9.3). Mirrors the shipping / payment
 * / email plugin-catalog shape: a static `SECTION_CATALOG` keyed by section
 * `type`, each entry implementing this contract. The homepage inline editor
 * browses the catalog; the renderer resolves a saved `SectionInstance.type`
 * to its catalog entry and renders `entry.Component`.
 *
 * Adding a section type = add one file under `sections/` and register it in
 * `catalog.ts`. The side panel, add-section menu, show/hide, reorder, and
 * persistence are all catalog-driven, so nothing else needs to change.
 */

/**
 * The editor controls a field knows how to render. The v9.3 set
 * (`text|image|link|select`) is extended by the v9.4 builder with richer
 * controls used by widgets and the Style tab.
 */
export type SectionFieldType =
  | 'text'
  | 'image'
  | 'link'
  | 'select'
  | 'color'
  | 'number'
  | 'toggle'
  | 'richtext'
  | 'focal';

export interface SectionField {
  /** Key into `PageBlock.props`. */
  key: string;
  /** i18n key for the field label shown in the side panel. */
  labelKey: string;
  type: SectionFieldType;
  /**
   * `text` only — render a multi-line textarea in the panel (single line
   * otherwise). Inline canvas editing stores plain text either way.
   */
  multiline?: boolean;
  /**
   * `text` / `link` only — when true, the field is also editable directly on
   * the canvas via `<EditableText>`. Images are edited from the panel.
   */
  inline?: boolean;
  /** `image` only — Storage path prefix passed to `<ImageUploadField>`. */
  storagePath?: string;
  /** `select` only — option list. Labels are i18n keys. */
  options?: { value: string; labelKey: string }[];
  /** `number` only — input bounds / step. */
  min?: number;
  max?: number;
  step?: number;
  /** Optional i18n key for placeholder / help text in the panel. */
  placeholderKey?: string;
}

/** Block-field aliases under the v9.4 "block" vocabulary. */
export type BlockField = SectionField;
export type BlockFieldType = SectionFieldType;

/**
 * Insert-panel grouping for a catalog entry. `section` = the v9.3 premade,
 * content-rich sections; `layout` = structural containers/columns that hold
 * children (Phase 2+); `widget` = atomic content blocks (heading, text,
 * image, button…).
 */
export type BlockCategory = 'section' | 'layout' | 'widget';

export interface SectionVariant {
  id: string;
  /** i18n key for the variant's display name. */
  labelKey: string;
}

/** Props every section component receives from the renderer. */
export interface SectionComponentProps {
  /** Field values for this instance, merged over the type's `defaultProps`. */
  props: Record<string, unknown>;
  /** Selected variant id, if the type declares variants. */
  variant?: string;
  /** True while the homepage editor is in edit mode (admin-only). */
  editing: boolean;
  /** Site settings loaded once by the renderer (brand name, returns policy…). */
  siteSettings: SiteSettings | null;
  /** Storefront helpers threaded through to product-bearing sections. */
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  /** Pre-rendered child blocks, for layout / container types (Phase 2+). */
  childrenSlot?: ReactNode;
}

export interface SectionType {
  /** Catalog key; equals `PageBlock.type`. */
  type: string;
  /** i18n key for the human name shown in the editor. */
  nameKey: string;
  /** i18n key for a one-line description shown in the add-block menu. */
  descriptionKey: string;
  /**
   * Optional glyph shown beside the name in the insert panel. Absent = the
   * block's category glyph. A plain emoji/character, not markup.
   */
  icon?: string;
  /**
   * Insert-panel grouping. Absent = `'section'` (the v9.3 premade sections),
   * so existing section definitions need no change.
   */
  category?: BlockCategory;
  /** Layout blocks (container / column) that hold nested children (Phase 2+). */
  acceptsChildren?: boolean;
  /**
   * Catalog types to seed as children when this block is inserted — e.g. a
   * "Columns" block seeds two empty columns. Created recursively.
   */
  defaultChildren?: string[];
  /** Whether the Style tab applies to this block. Absent = true. */
  styleable?: boolean;
  /** Field schema — drives the side-panel form automatically. */
  fields: SectionField[];
  /** Optional pre-designed layout variants; first entry is the default. */
  variants?: SectionVariant[];
  /** Seed values. The homepage seed is built from every type's `defaultProps`. */
  defaultProps: Record<string, unknown>;
  /**
   * True when the section's body is Firestore-driven (collections, products):
   * the editor exposes only headings / visibility / variant, never the items.
   */
  dynamic?: boolean;
  /** When true, only one instance of this type may exist on a page. */
  singleton?: boolean;
  Component: ComponentType<SectionComponentProps>;
}

/** Block aliases under the v9.4 "block" vocabulary (a block === a catalog entry). */
export type BlockType = SectionType;
export type BlockComponentProps = SectionComponentProps;
