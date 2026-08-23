'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Firestore } from 'firebase/firestore';
import type { CartItem, CartItemRef, Product } from '../types';
import { getProductsByIds } from '../services/product-service';
import {
  combineCartItems,
  mergeCartOnSignIn,
  saveUserCart,
} from '../services/cart-service';
import { reportServiceError } from '../services/error-log-service';
import { useAuth } from './auth-context';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  count: number;
  subtotal: number;
  addToCart: (product: Product, quantity?: number, selectedSize?: string, selectedColor?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string) => void;
  removeFromCart: (productId: string, selectedSize?: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const LOCAL_KEY = 'caspian-cart-v1';

function readLocal(): CartItemRef[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocal(items: CartItemRef[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
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

function sameLine(a: CartItemRef, b: CartItemRef) {
  return (
    a.productId === b.productId &&
    (a.selectedSize ?? '') === (b.selectedSize ?? '') &&
    (a.selectedColor ?? '') === (b.selectedColor ?? '')
  );
}

export function CartProvider({
  db,
  children,
}: {
  /** `null` on a standalone till. The cart then lives in localStorage only. */
  db: Firestore | null;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [refs, setRefs] = useState<CartItemRef[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  // Track the prior auth identity + in-memory cart snapshot so we can carry an
  // anon shopper's lines across the anon → real sign-in transition. We can't
  // read the orphan anon UID's cart doc from a real-user session — the
  // `/carts/{uid}` rule requires `request.auth.uid == uid` — so the in-memory
  // refs are the only source of truth for that previous cart state.
  const previousUserRef = useRef<typeof user>(null);
  const refsSnapshotRef = useRef<CartItemRef[]>([]);

  // Keep an up-to-date snapshot of refs available to the auth-change effect
  // without making refs a dependency (which would re-fire the effect on every
  // cart mutation and trigger a redundant merge).
  useEffect(() => {
    refsSnapshotRef.current = refs;
  }, [refs]);

  // Hydrate refs on auth change. Sign-in merges the anon cart into the
  // now-authenticated cart, summing quantities for matching (productId, size,
  // color) lines. Mirrors the wishlist merge. The anon cart comes from
  // localStorage on the first transition (null → user) and from in-memory
  // refs on the anon → real transition (since the orphan anon-UID Firestore
  // doc is unreadable from the real-user session under our `/carts/{uid}`
  // rule).
  useEffect(() => {
    let alive = true;
    const previousUser = previousUserRef.current;
    previousUserRef.current = user;
    const carriedFromMemory =
      previousUser &&
      previousUser.isAnonymous &&
      previousUser.uid !== user?.uid &&
      user &&
      !user.isAnonymous
        ? refsSnapshotRef.current
        : [];
    (async () => {
      setLoading(true);
      try {
        if (user && db) {
          const local = readLocal();
          const incoming = combineCartItems(local, carriedFromMemory);
          const merged = await mergeCartOnSignIn(db, user.uid, incoming);
          if (!alive) return;
          setRefs(merged);
          if (local.length > 0) clearLocal();
        } else {
          setRefs(readLocal());
        }
      } catch (error) {
        // Firestore can throw "Failed to get document because the client is
        // offline" when the consumer's Firebase config is incomplete (e.g.
        // missing `projectId`) or the user is genuinely offline. Either way,
        // the cart shouldn't take the page down with an unhandled rejection
        // — fall back to localStorage so the shopper at least keeps their
        // session-local cart, and log via reportServiceError so the admin
        // sees it on /admin/about.
        reportServiceError(db, 'cart-context.hydrateRefs', error);
        if (alive) setRefs(readLocal());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, user]);

  // Load product details for refs whenever refs change
  useEffect(() => {
    const ids = Array.from(new Set(refs.map((r) => r.productId).filter((id) => !products[id])));
    if (ids.length === 0 || !db) return;
    let alive = true;
    (async () => {
      try {
        const fetched = await getProductsByIds(db, ids);
        if (!alive) return;
        setProducts((prev) => {
          const next = { ...prev };
          for (const p of fetched) next[p.id] = p;
          return next;
        });
      } catch (error) {
        reportServiceError(db, 'cart-context.hydrate', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, refs, products]);

  // Persist refs
  const persist = useCallback(
    async (next: CartItemRef[]) => {
      if (user && db) {
        try {
          await saveUserCart(db, user.uid, next);
        } catch (error) {
          reportServiceError(db, 'cart-context.saveCart', error);
        }
      } else {
        writeLocal(next);
      }
    },
    [db, user],
  );

  const addToCart = useCallback(
    (product: Product, quantity = 1, selectedSize?: string, selectedColor?: string) => {
      setRefs((prev) => {
        const incoming: CartItemRef = { productId: product.id, quantity };
        if (selectedSize !== undefined) incoming.selectedSize = selectedSize;
        if (selectedColor !== undefined) incoming.selectedColor = selectedColor;
        const idx = prev.findIndex((r) => sameLine(r, incoming));
        const next =
          idx === -1
            ? [...prev, incoming]
            : prev.map((r, i) => (i === idx ? { ...r, quantity: r.quantity + quantity } : r));
        void persist(next);
        return next;
      });
      // Cache the product so we don't need a round-trip.
      setProducts((prev) => ({ ...prev, [product.id]: product }));
    },
    [persist],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number, selectedSize?: string) => {
      setRefs((prev) => {
        const next =
          quantity <= 0
            ? prev.filter((r) => !(r.productId === productId && (r.selectedSize ?? '') === (selectedSize ?? '')))
            : prev.map((r) =>
                r.productId === productId && (r.selectedSize ?? '') === (selectedSize ?? '')
                  ? { ...r, quantity }
                  : r,
              );
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeFromCart = useCallback(
    (productId: string, selectedSize?: string) => {
      setRefs((prev) => {
        const next = prev.filter(
          (r) => !(r.productId === productId && (r.selectedSize ?? '') === (selectedSize ?? '')),
        );
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearCart = useCallback(() => {
    setRefs([]);
    void persist([]);
  }, [persist]);

  const items: CartItem[] = useMemo(() => {
    const out: CartItem[] = [];
    for (const r of refs) {
      const product = products[r.productId];
      if (!product) continue;
      const line: CartItem = { product, quantity: r.quantity };
      if (r.selectedSize !== undefined) line.selectedSize = r.selectedSize;
      if (r.selectedColor !== undefined) line.selectedColor = r.selectedColor;
      out.push(line);
    }
    return out;
  }, [refs, products]);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{ items, loading, count, subtotal, addToCart, updateQuantity, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be called inside <CaspianStoreProvider>.');
  }
  return ctx;
}
