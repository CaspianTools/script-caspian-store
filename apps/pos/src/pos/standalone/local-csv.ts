/**
 * CSV in and out for a standalone till's catalogue.
 *
 * Headers deliberately match the cloud products export where the two models
 * overlap (`name`, `sku`, `barcode`, `price`, `category`, `sizes`, `stock`,
 * `isActive`, `description`), and unknown columns are ignored rather than
 * rejected. That is what lets a shop export from an online store and import the
 * file straight into a standalone till — the extra storefront columns (slug,
 * brand, taxonomies) simply have nowhere to land here.
 *
 * Lots are deliberately NOT here. A batch has a code, a date, a cost, a
 * supplier and a quantity that only ever moves through a delivery or an
 * adjustment; a column that let somebody paste one in would be a way to invent
 * stock history in a spreadsheet. `tracksLots` says whether an item works that
 * way, and the batches themselves arrive through Receive stock and travel in
 * the JSON backup.
 *
 * The cell encodings come from the import/export helpers rather than being
 * re-implemented, so `S:3;M:5` means the same thing on both sides.
 */

import {
  csvToRecords,
  parseCsv,
  toCsv,
  type CsvCell,
  joinList,
  joinStock,
  parseBool,
  parseList,
  parseNumber,
  parseStock,
} from '@caspian-explorer/script-caspian-store';
import { makeLocalProduct } from './local-db';
import { DEFAULT_SIZE_KEY } from './lot-allocation';
import type { LocalProduct } from './types';

/**
 * A bare count is the sizeless bucket.
 *
 * `parseStock` wants `size:quantity` and skips any part without a colon, so a
 * shop that typed a plain `12` -- which is what the item form now asks for, and
 * what most shops mean -- imported an item with no stock at all and no warning.
 * Widening the shared helper would change the cloud import too, so the leniency
 * lives here, on the standalone side of the boundary.
 */
function parseLocalStock(cell: string | undefined): Record<string, number> {
  const raw = (cell ?? '').trim();
  if (raw && !raw.includes(':')) {
    const count = Number(raw);
    if (Number.isInteger(count) && count >= 0) return { [DEFAULT_SIZE_KEY]: count };
  }
  return parseStock(cell);
}

/**
 * The other half of that, so the sentinel never reaches a spreadsheet either.
 *
 * `_default` is an internal key for "this item has no sizes", and an owner who
 * opened the export had no way to know that. An item that holds nothing else
 * writes its count plainly; anything with sizes keeps the `size:quantity` form.
 * `parseLocalStock` reads both, so the round-trip still reproduces the record.
 */
function joinLocalStock(stock: Record<string, number>): string {
  const keys = Object.keys(stock);
  if (keys.length === 1 && keys[0] === DEFAULT_SIZE_KEY) return String(stock[DEFAULT_SIZE_KEY]);
  return joinStock(stock);
}

export interface LocalColumnMeta {
  header: string;
  required?: boolean;
  sample: string;
  help?: string;
}

/** The single source of truth for the export, the template and the import. */
export const LOCAL_PRODUCT_COLUMNS: LocalColumnMeta[] = [
  {
    header: 'id',
    sample: '',
    help: 'Leave blank to add a new item; fill it to update one that is already here.',
  },
  { header: 'name', required: true, sample: 'White T-shirt' },
  { header: 'sku', sample: 'TSH-001', help: 'Your own code. Keyed when a label will not scan.' },
  { header: 'barcode', sample: '5901234123457', help: 'What the scanner reads off the label.' },
  { header: 'price', required: true, sample: '19.99' },
  { header: 'category', sample: 'Clothing' },
  { header: 'sizes', sample: 'S;M;L', help: 'Separated by semicolons. Leave blank if the item has no sizes.' },
  {
    header: 'stock',
    sample: '12',
    help: 'A plain count for an item with no sizes. Per size, write size:quantity separated by semicolons - S:3;M:5;L:0.',
  },
  { header: 'isActive', sample: 'true', help: 'false hides the item from the till without deleting it.' },
  { header: 'imageUrl', sample: '', help: 'Optional. Only shown if the till has the picture available.' },
  {
    header: 'description',
    sample: 'Soft cotton, regular fit.',
    help: 'Shown on the item\u2019s own page in the back office. Never on a receipt.',
  },
  {
    header: 'tracksLots',
    sample: 'false',
    help: 'true if this item is received in batches with expiry dates and sold oldest-date-first.',
  },
  {
    header: 'costPrice',
    sample: '8.50',
    help: 'What the last delivery cost per unit. Receiving stock overwrites it.',
  },
];

export function localProductsToCsv(products: LocalProduct[]): string {
  const rows: CsvCell[][] = [LOCAL_PRODUCT_COLUMNS.map((c) => c.header)];
  for (const p of products) {
    rows.push([
      p.id,
      p.name,
      p.sku,
      p.barcode,
      p.price,
      p.category,
      joinList(p.sizes),
      joinLocalStock(p.stock),
      p.isActive ? 'true' : 'false',
      p.imageUrl,
      p.description,
      p.tracksLots ? 'true' : 'false',
      p.costPrice,
    ]);
  }
  return toCsv(rows);
}

/** A header row plus one sample line, for a shop starting from nothing. */
export function localProductTemplateCsv(): string {
  return toCsv([
    LOCAL_PRODUCT_COLUMNS.map((c) => c.header),
    LOCAL_PRODUCT_COLUMNS.map((c) => c.sample),
  ]);
}

export interface LocalImportRow {
  line: number;
  product: LocalProduct;
  /** True when `id` matched something already on the till. */
  updates: boolean;
}

export interface LocalImportPlan {
  rows: LocalImportRow[];
  errors: Array<{ line: number; message: string }>;
}

/**
 * Read a CSV into products, reporting per-line problems rather than throwing.
 *
 * A spreadsheet a shop maintains by hand will have bad rows in it. Rejecting
 * the whole file for one missing price means the shop cannot import at all;
 * listing the bad lines means they fix three cells and try again.
 */
export function planLocalProductImport(text: string, existing: LocalProduct[]): LocalImportPlan {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const records = csvToRecords(parseCsv(text));
  const rows: LocalImportRow[] = [];
  const errors: LocalImportPlan['errors'] = [];

  records.forEach((record, index) => {
    // +2: one for the header row, one because humans count from 1.
    const line = index + 2;
    const name = (record.name ?? '').trim();
    if (!name) {
      errors.push({ line, message: 'Missing a name.' });
      return;
    }
    const price = parseNumber(record.price);
    if (price === null) {
      errors.push({ line, message: `"${name}" has no usable price.` });
      return;
    }
    if (price < 0) {
      errors.push({ line, message: `"${name}" has a negative price.` });
      return;
    }

    const id = (record.id ?? '').trim();
    const prior = id ? byId.get(id) : undefined;
    rows.push({
      line,
      updates: Boolean(prior),
      product: makeLocalProduct({
        ...(prior ?? {}),
        ...(id ? { id } : {}),
        name,
        price,
        sku: record.sku ?? '',
        barcode: record.barcode ?? '',
        category: record.category ?? '',
        sizes: parseList(record.sizes),
        stock: parseLocalStock(record.stock),
        isActive: parseBool(record.isActive, true),
        imageUrl: (record.imageUrl ?? '').trim(),
        description: (record.description ?? '').trim(),
        tracksLots: parseBool(record.tracksLots, false),
        // A blank cell means zero rather than an error: a shop importing a
        // price list from a supplier rarely knows its own cost yet, and the
        // next delivery stamps the real figure over it.
        costPrice: parseNumber(record.costPrice) ?? 0,
      }),
    });
  });

  return { rows, errors };
}
