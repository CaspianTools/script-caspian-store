import { PRODUCTS_DATASET } from './datasets/products';
import { BRANDS_DATASET, CATEGORIES_DATASET, COLLECTIONS_DATASET } from './datasets/taxonomy';
import { PROMO_CODES_DATASET, SUBSCRIBERS_DATASET } from './datasets/marketing';
import { ORDERS_DATASET, REVIEWS_DATASET, USERS_DATASET } from './datasets/read-only';
import type { DatasetDescriptor, DatasetId } from './types';

/**
 * The Import / Export dataset catalog. Add a dataset by dropping a descriptor
 * file under `datasets/` and registering it here — the admin page's pickers,
 * templates, and import flow are all driven off this record.
 */
export const DATASET_CATALOG: Record<DatasetId, DatasetDescriptor> = {
  products: PRODUCTS_DATASET,
  categories: CATEGORIES_DATASET,
  collections: COLLECTIONS_DATASET,
  brands: BRANDS_DATASET,
  'promo-codes': PROMO_CODES_DATASET,
  subscribers: SUBSCRIBERS_DATASET,
  orders: ORDERS_DATASET,
  users: USERS_DATASET,
  reviews: REVIEWS_DATASET,
};

/** Catalog order — drives the order datasets appear in the pickers. */
const ORDER: DatasetId[] = [
  'products',
  'categories',
  'collections',
  'brands',
  'promo-codes',
  'subscribers',
  'orders',
  'users',
  'reviews',
];

export function listDatasets(): DatasetDescriptor[] {
  return ORDER.map((id) => DATASET_CATALOG[id]);
}

export function getDataset(id: string): DatasetDescriptor | null {
  return (DATASET_CATALOG as Record<string, DatasetDescriptor>)[id] ?? null;
}

export function exportableDatasets(): DatasetDescriptor[] {
  return listDatasets().filter((d) => d.canExport);
}

export function importableDatasets(): DatasetDescriptor[] {
  return listDatasets().filter((d) => d.canImport);
}
