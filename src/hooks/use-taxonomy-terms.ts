'use client';

import { useEffect, useState } from 'react';
import type { TaxonomyTermDoc } from '../types';
import { listActiveTerms } from '../services/taxonomy-term-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';

/**
 * Module-level cache of active taxonomy terms, keyed by taxonomy `type`. A
 * product grid that shows attribute chips/facets would otherwise fire one read
 * per card per taxonomy; the cache collapses that into a single read per type
 * for the whole tree. Mirrors {@link useBrands}.
 *
 * The product editor calls {@link refreshTaxonomyTermsCache} after creating a
 * term inline so storefront tabs pick up the new term on next mount. Cross-tab
 * invalidation is not handled — refreshing the storefront tab picks it up.
 */
const cache = new Map<string, Promise<TaxonomyTermDoc[]>>();

export function refreshTaxonomyTermsCache(type?: string): void {
  if (type) cache.delete(type);
  else cache.clear();
}

function loadType(
  db: Parameters<typeof listActiveTerms>[0],
  type: string,
): Promise<TaxonomyTermDoc[]> {
  let promise = cache.get(type);
  if (!promise) {
    promise = listActiveTerms(db, type);
    cache.set(type, promise);
  }
  return promise;
}

/**
 * Load active terms for several taxonomy types at once. Returns a map keyed by
 * type. Empty `types` resolves immediately to an empty map. Errors per type are
 * swallowed to `[]` (a missing taxonomy must not blank the others).
 */
export function useTaxonomyTermsByType(types: string[]): {
  byType: Record<string, TaxonomyTermDoc[]>;
  termName: (type: string, id: string) => string;
  loaded: boolean;
} {
  const { db } = useCaspianFirebase();
  // Stable primitive dependency so the effect doesn't re-run on every render
  // when the caller passes a fresh array with the same contents.
  const key = types.join(',');
  const [byType, setByType] = useState<Record<string, TaxonomyTermDoc[]> | null>(null);

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setByType({});
      return undefined;
    }
    let alive = true;
    Promise.all(
      list.map((type) =>
        loadType(db, type)
          .then((terms) => [type, terms] as const)
          .catch((error) => {
            console.error(`[caspian-store] Failed to load taxonomy terms (${type}):`, error);
            cache.delete(type);
            return [type, [] as TaxonomyTermDoc[]] as const;
          }),
      ),
    ).then((entries) => {
      if (alive) setByType(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [db, key]);

  const resolved = byType ?? {};
  const termName = (type: string, id: string): string =>
    resolved[type]?.find((t) => t.id === id)?.name ?? id;

  return { byType: resolved, termName, loaded: byType !== null };
}
