'use client';

import { useEffect, useState } from 'react';
import type { Breakpoint } from '../types';

/**
 * The active breakpoint derived from viewport width, matching the builder's CSS
 * cutoffs (`≤767px` mobile, `≤1024px` tablet). Used by the public render path so
 * per-breakpoint CONTENT overrides (`responsive[bp].props`) apply for shoppers —
 * a plain `@media` sheet can express style/hidden but can't swap text.
 *
 * SSR/hydration note: the first paint is `desktop` (matchMedia runs after mount),
 * then swaps on the client. Only affects blocks that actually set overrides.
 */
export function useActiveBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('desktop');
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mobile = window.matchMedia('(max-width: 767px)');
    const tablet = window.matchMedia('(max-width: 1024px)');
    const compute = () => setBp(mobile.matches ? 'mobile' : tablet.matches ? 'tablet' : 'desktop');
    compute();
    mobile.addEventListener('change', compute);
    tablet.addEventListener('change', compute);
    return () => {
      mobile.removeEventListener('change', compute);
      tablet.removeEventListener('change', compute);
    };
  }, []);
  return bp;
}
