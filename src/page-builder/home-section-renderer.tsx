'use client';

import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { getPageLayout } from '../services/page-layout-service';
import type { PageBlock } from '../types';
import { buildDefaultHomeLayout } from './home-default-layout';

/** The single editable page id shipped in v9.3; still the homepage's id. */
export const HOME_PAGE_ID = 'home';

export interface UseHomeLayoutResult {
  /** Null while loading; never null afterwards (falls back to the seed). */
  blocks: PageBlock[] | null;
  loading: boolean;
}

/**
 * Loads a saved page layout by id. When no `pageLayouts/{pageId}` doc exists the
 * homepage falls back to the catalog seed (so an un-edited install is unchanged)
 * while any other page falls back to an empty layout. Legacy (v9.3) flat-section
 * docs are migrated to blocks by `getPageLayout`, so this always yields blocks.
 */
export function usePageLayoutBlocks(db: Firestore, pageId: string): UseHomeLayoutResult {
  const [blocks, setBlocks] = useState<PageBlock[] | null>(null);

  useEffect(() => {
    let alive = true;
    const seed = () => (pageId === HOME_PAGE_ID ? buildDefaultHomeLayout() : []);
    getPageLayout(db, pageId)
      .then((layout) => {
        if (alive) setBlocks(layout ? layout.blocks : seed());
      })
      .catch(() => {
        if (alive) setBlocks(seed());
      });
    return () => {
      alive = false;
    };
  }, [db, pageId]);

  return { blocks, loading: blocks === null };
}

/** The homepage layout loader — `usePageLayoutBlocks` pinned to `HOME_PAGE_ID`. */
export function useHomeLayout(db: Firestore): UseHomeLayoutResult {
  return usePageLayoutBlocks(db, HOME_PAGE_ID);
}

// The renderer itself now lives in `block-renderer.tsx` (recursive, supports
// widgets + nested layout blocks). `HomeSectionRenderer` is kept as a name
// alias so external consumers of the v9.3 API keep working.
export { BlockRenderer, BlockRenderer as HomeSectionRenderer } from './block-renderer';
export type { BlockRendererProps, BlockRendererProps as HomeSectionRendererProps } from './block-renderer';
