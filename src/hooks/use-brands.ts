'use client';

import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { ProductBrandDoc } from '../types';
import { listActiveBrands } from '../services/brand-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';

/**
 * Module-level cache of the active-brand list, keyed by Firestore instance
 * so a preview + live store on the same page never share a list. A grid of
 * product cards mounted on the same page would otherwise fire one read per
 * card; the cache collapses that into a single Firestore read for the tree.
 * A rejected load is evicted so the next mount retries instead of every
 * card inheriting the failure for the session.
 *
 * The Brands admin page calls {@link refreshBrandsCache} after every
 * create / update / delete / migrate so storefront tabs see fresh data
 * on next mount. Cross-tab invalidation (admin renames a brand in tab A
 * while a storefront is open in tab B) is not handled — refreshing the
 * storefront tab picks it up.
 */
const cache = new Map<Firestore, Promise<ProductBrandDoc[]>>();

export function refreshBrandsCache(): void {
  cache.clear();
}

function loadBrands(db: Firestore): Promise<ProductBrandDoc[]> {
  let promise = cache.get(db);
  if (!promise) {
    promise = listActiveBrands(db).catch((error) => {
      if (cache.get(db) === promise) cache.delete(db);
      throw error;
    });
    cache.set(db, promise);
  }
  return promise;
}

export function useBrands(): {
  brands: ProductBrandDoc[];
  brandsById: Map<string, ProductBrandDoc>;
  loaded: boolean;
} {
  const { db } = useCaspianFirebase();
  const [brands, setBrands] = useState<ProductBrandDoc[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadBrands(db)
      .then((list) => {
        if (alive) setBrands(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load brands:', error);
        if (alive) setBrands([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const list = brands ?? [];
  const brandsById = new Map(list.map((b) => [b.id, b]));
  return { brands: list, brandsById, loaded: brands !== null };
}

/**
 * Resolve a stored `Product.brand` value to a display name. Returns the
 * matching brand-doc's `name` when the value is a known brand id, the raw
 * value otherwise (preserves legacy free-text data from before the brands
 * collection existed). Returns the empty string for unset values.
 */
export function useBrandName(value: string | undefined): string {
  const { brandsById } = useBrands();
  if (!value) return '';
  return brandsById.get(value)?.name ?? value;
}
