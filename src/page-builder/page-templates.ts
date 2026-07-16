import type { PageBlock } from '../types';
import { createBlock } from './block-factory';

/**
 * Starter templates for new builder pages (v9.5). Code-defined (like
 * `buildDefaultHomeLayout`), so they ship with the library and are always
 * available — no Firestore seed. Each `build()` returns a fresh block tree
 * (fresh ids), used to seed a new page's DRAFT. Admin → Pages picks one at
 * create time; a Firestore-backed "save current page as template" is a later
 * option.
 *
 * Templates use content sections/widgets that render without storefront product
 * helpers (`BuilderPageView` doesn't thread them), so a landing page looks right
 * on first load.
 */
export interface PageTemplate {
  id: string;
  /** Label shown in the admin Create-page dialog (English, admin-only surface). */
  name: string;
  description: string;
  build: () => PageBlock[];
}

/** Build a block list from catalog types, dropping any unknown type. */
function fromTypes(...types: string[]): PageBlock[] {
  return types.map((t) => createBlock(t)).filter((b): b is PageBlock => b !== null);
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'blank', name: 'Blank', description: 'Start from an empty page.', build: () => [] },
  {
    id: 'landing',
    name: 'Landing',
    description: 'Hero + editorial split + story panel.',
    build: () => fromTypes('hero', 'editorial-split', 'story-panel'),
  },
  {
    id: 'about',
    name: 'About',
    description: 'Story panel + editorial split.',
    build: () => fromTypes('story-panel', 'editorial-split'),
  },
  {
    id: 'text',
    name: 'Text page',
    description: 'A heading and a rich-text block.',
    build: () => fromTypes('widget:heading', 'widget:text'),
  },
];

export function getPageTemplate(id: string): PageTemplate | null {
  return PAGE_TEMPLATES.find((tpl) => tpl.id === id) ?? null;
}
