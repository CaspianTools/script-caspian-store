'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Firestore } from 'firebase/firestore';
import type { Product } from '../types';
import { getProductsByIds } from '../services/product-service';
import {
  mergeWishlistOnSignIn,
  saveUserWishlist,
} from '../services/wishlist-service';
import { reportServiceError } from '../services/error-log-service';
import { useAuth } from './auth-context';

interface WishlistContextValue {
  wishlist: string[];
  products: Record<string, Product>;
  count: number;
  loading: boolean;
  signedIn: boolean;
  isSaved: (productId: string) => boolean;
  add: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const LOCAL_KEY = 'caspian-wishlist-v1';

function readLocal(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {
    /* noop */
  }
}

function clearLocal() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* noop */
  }
}

export function WishlistProvider({ db, children }: { db: Firestore; children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  // Hydrate on auth change. Sign-in merges the local (anon) list into the
  // server list — this is the deliberate improvement over cart, which does a
  // hard switch and loses anon data.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (user) {
          const local = readLocal();
          const merged = await mergeWishlistOnSignIn(db, user.uid, local);
          if (!alive) return;
          setIds(merged);
          if (local.length > 0) clearLocal();
        } else {
          setIds(readLocal());
        }
      } catch (error) {
        // Firestore can throw "client is offline" when the consumer's Firebase
        // config is incomplete. Don't take the page down — fall back to
        // localStorage so the shopper at least keeps their session-local
        // wishlist.
        reportServiceError(db, 'wishlist-context.hydrate', error);
        if (alive) setIds(readLocal());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, user]);

  // Lazy-hydrate product details. Wishlist consumers (panel, page, badge) only
  // need product docs when actually rendering — but pre-fetching here keeps
  // them ready so the grid doesn't flash empty cells.
  useEffect(() => {
    const missing = ids.filter((id) => !products[id]);
    if (missing.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const fetched = await getProductsByIds(db, missing);
        if (!alive) return;
        setProducts((prev) => {
          const next = { ...prev };
          for (const p of fetched) next[p.id] = p;
          return next;
        });
      } catch (error) {
        reportServiceError(db, 'wishlist-context.hydrateProducts', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, ids, products]);

  const persist = useCallback(
    async (next: string[]) => {
      if (user) {
        try {
          await saveUserWishlist(db, user.uid, next);
        } catch (error) {
          reportServiceError(db, 'wishlist-context.saveWishlist', error);
        }
      } else {
        writeLocal(next);
      }
    },
    [db, user],
  );

  const add = useCallback(
    async (productId: string) => {
      let mutated = false;
      setIds((prev) => {
        if (prev.includes(productId)) return prev;
        mutated = true;
        const next = [...prev, productId];
        void persist(next);
        return next;
      });
      // Idempotent: if it was already saved, no work to do.
      if (!mutated) return;
    },
    [persist],
  );

  const remove = useCallback(
    async (productId: string) => {
      setIds((prev) => {
        if (!prev.includes(productId)) return prev;
        const next = prev.filter((id) => id !== productId);
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const toggle = useCallback(
    async (productId: string) => {
      setIds((prev) => {
        const next = prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId];
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const clear = useCallback(async () => {
    setIds([]);
    await persist([]);
  }, [persist]);

  const isSaved = useCallback((productId: string) => ids.includes(productId), [ids]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlist: ids,
      products,
      count: ids.length,
      loading,
      signedIn: Boolean(user),
      isSaved,
      add,
      remove,
      toggle,
      clear,
    }),
    [ids, products, loading, user, isSaved, add, remove, toggle, clear],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be called inside <CaspianStoreProvider>.');
  }
  return ctx;
}
