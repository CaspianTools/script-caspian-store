import type { PageBlock } from '../types';
import { HOME_SECTION_ORDER, getBlockType } from './catalog';

/**
 * The canonical fallback homepage: one instance per catalog type in the
 * default order, each carrying its type's `defaultProps`. This is what the
 * storefront renders when no `pageLayouts/home` doc exists, so an install that
 * never opens the editor looks pixel-identical to the pre-builder homepage.
 *
 * Seeded instance ids equal the section type (each is unique in the seed),
 * which keeps the React keys and editor selection stable across reloads.
 */
export function buildDefaultHomeLayout(): PageBlock[] {
  return HOME_SECTION_ORDER.map((type) => {
    const entry = getBlockType(type);
    return {
      id: type,
      type,
      visible: true,
      props: { ...(entry?.defaultProps ?? {}) },
    };
  });
}
