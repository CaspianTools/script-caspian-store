import { listAllOrders } from '../../order-service';
import { listUsers } from '../../user-service';
import { listAllReviews } from '../../review-service';
import { isoFromTs } from '../helpers';
import type { ColumnMeta, DatasetDescriptor } from '../types';

// Export-only datasets — transactional/auth-bound data that the admin can
// download but never bulk-import. They omit analyzeRows/applyRows (canImport=false).

const orderColumns: ColumnMeta[] = [
  { header: 'id', sample: '' },
  { header: 'createdAt', sample: '' },
  { header: 'status', sample: '' },
  { header: 'userEmail', sample: '' },
  { header: 'subtotal', sample: '' },
  { header: 'shippingCost', sample: '' },
  { header: 'tax', sample: '' },
  { header: 'discount', sample: '' },
  { header: 'total', sample: '' },
  { header: 'promoCode', sample: '' },
  { header: 'itemCount', sample: '' },
  { header: 'items', sample: '' },
];

export const ORDERS_DATASET: DatasetDescriptor = {
  id: 'orders',
  labelKey: 'admin.importExport.dataset.orders',
  descriptionKey: 'admin.importExport.dataset.orders.desc',
  canExport: true,
  canImport: false,
  columns: orderColumns,

  async exportMatrix(db) {
    const orders = await listAllOrders(db, 5000);
    return orders.map((o) => [
      o.id,
      isoFromTs(o.createdAt),
      o.status,
      o.userEmail,
      o.subtotal,
      o.shippingCost,
      o.tax ?? '',
      o.discount,
      o.total,
      o.promoCode ?? '',
      o.items?.length ?? 0,
      (o.items ?? []).map((i) => `${i.name} x${i.quantity}`).join('; '),
    ]);
  },
};

const userColumns: ColumnMeta[] = [
  { header: 'uid', sample: '' },
  { header: 'email', sample: '' },
  { header: 'displayName', sample: '' },
  { header: 'role', sample: '' },
  { header: 'phone', sample: '' },
  { header: 'createdAt', sample: '' },
  { header: 'addressCount', sample: '' },
  { header: 'wishlistCount', sample: '' },
];

export const USERS_DATASET: DatasetDescriptor = {
  id: 'users',
  labelKey: 'admin.importExport.dataset.users',
  descriptionKey: 'admin.importExport.dataset.users.desc',
  canExport: true,
  canImport: false,
  columns: userColumns,

  async exportMatrix(db) {
    const users = await listUsers(db);
    return users.map((u) => [
      u.uid,
      u.email,
      u.displayName ?? '',
      u.role,
      u.phone ?? '',
      isoFromTs(u.createdAt),
      u.addresses?.length ?? 0,
      u.wishlist?.length ?? 0,
    ]);
  },
};

const reviewColumns: ColumnMeta[] = [
  { header: 'id', sample: '' },
  { header: 'productId', sample: '' },
  { header: 'author', sample: '' },
  { header: 'rating', sample: '' },
  { header: 'status', sample: '' },
  { header: 'isVerifiedPurchase', sample: '' },
  { header: 'createdAt', sample: '' },
  { header: 'text', sample: '' },
];

export const REVIEWS_DATASET: DatasetDescriptor = {
  id: 'reviews',
  labelKey: 'admin.importExport.dataset.reviews',
  descriptionKey: 'admin.importExport.dataset.reviews.desc',
  canExport: true,
  canImport: false,
  columns: reviewColumns,

  async exportMatrix(db) {
    const reviews = await listAllReviews(db);
    return reviews.map((r) => [
      r.id,
      r.productId,
      r.author,
      r.rating,
      r.status,
      r.isVerifiedPurchase,
      isoFromTs(r.createdAt),
      r.text,
    ]);
  },
};
