import {
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { Order, OrderStatus } from '../types';

const PURCHASED_STATUSES: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered'];

export async function getOrderById(db: Firestore, orderId: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) };
}

export async function getOrdersByUser(
  db: Firestore,
  userId: string,
  max = 200,
): Promise<Order[]> {
  const q = query(
    caspianCollections(db).orders,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
}

/** Admin: list all orders, newest first. */
export async function listAllOrders(db: Firestore, max = 500): Promise<Order[]> {
  const q = query(
    caspianCollections(db).orders,
    orderBy('createdAt', 'desc'),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
}

/** Admin: update the status of an order. */
export async function updateOrderStatus(
  db: Firestore,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), {
    status,
    updatedAt: Timestamp.now(),
  });
}

export async function hasUserPurchasedProduct(
  db: Firestore,
  userId: string,
  productId: string,
): Promise<boolean> {
  const q = query(
    caspianCollections(db).orders,
    where('userId', '==', userId),
    where('status', 'in', PURCHASED_STATUSES),
  );
  const snap = await getDocs(q);
  return snap.docs.some((d) => {
    const data = d.data() as Order;
    return data.items?.some((item) => item.productId === productId) ?? false;
  });
}

/**
 * In-person sales, newest first. Backed by the `(channel, createdAt)` composite
 * index added in v10.0.0.
 *
 * Note this returns only orders written by the register — orders created before
 * v10.0.0 have no `channel` field at all, and Firestore equality filters skip
 * documents missing the field, which is the behaviour we want here: everything
 * that predates the POS was a storefront sale.
 */
export async function listPosOrders(db: Firestore, max = 50): Promise<Order[]> {
  const q = query(
    caspianCollections(db).orders,
    where('channel', '==', 'pos'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
}
