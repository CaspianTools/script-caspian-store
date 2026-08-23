#!/usr/bin/env node
/**
 * Behaviour guard for the standalone till (the `local` storage mode).
 *
 * Plain `node:assert` against the built ESM — no test runner and no new
 * dependency, matching the other `scripts/check-*.mjs` guards. It covers the
 * two things that would be expensive to get wrong and are invisible to the type
 * checker: what a customer is actually charged, and what a CSV round-trip does
 * to a shop's catalogue.
 *
 * The IndexedDB layer is deliberately not covered here — it needs a browser,
 * which is exactly why the arithmetic it wraps was extracted into
 * `priceLocalSale`, where it can be checked without one.
 *
 *   npm run build && node scripts/check-standalone.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'dist', 'index.mjs');
if (!existsSync(entry)) {
  console.error('[check-standalone] dist/index.mjs is missing. Run `npm run build` first.');
  process.exit(1);
}
const lib = await import(pathToFileURL(entry).href);

const {
  canAccess,
  POS_LOCAL_ROLES,
  LOCAL_PRODUCT_COLUMNS,
  localProductsToCsv,
  localProductTemplateCsv,
  planLocalProductImport,
  makeLocalProduct,
  localProductToProduct,
  parseLocalBackup,
  localBackupFilename,
  resolvePosStorageMode,
  normaliseUsername,
  priceLocalSale,
  MIN_LOCAL_PASSWORD_LENGTH,
} = lib;

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (error) {
    failed++;
    console.error('  FAIL  ' + name);
    console.error('        ' + (error && error.message ? error.message : error));
  }
};

// --------------------------------------------------------------- roles

console.log('roles');
check('cashier reaches only the register', () => {
  assert.equal(canAccess('staff', 'register'), true);
  assert.equal(canAccess('staff', 'admin'), false);
  assert.equal(canAccess('staff', 'support'), false);
});
check('owner reaches the back office but not support', () => {
  assert.equal(canAccess('admin', 'register'), true);
  assert.equal(canAccess('admin', 'admin'), true);
  assert.equal(canAccess('admin', 'support'), false);
});
check('support reaches everything', () => {
  for (const area of ['register', 'admin', 'support']) {
    assert.equal(canAccess('superadmin', area), true);
  }
});
check('nobody signed in reaches nothing', () => {
  assert.equal(canAccess(null, 'register'), false);
  assert.equal(canAccess(undefined, 'admin'), false);
});
check('roles list is the three tiers', () => {
  assert.deepEqual([...POS_LOCAL_ROLES].sort(), ['admin', 'staff', 'superadmin']);
});

// -------------------------------------------------------- storage mode

console.log('storage mode');
check('no firebase forces local regardless of preference', () => {
  assert.equal(resolvePosStorageMode(false), 'local');
});
check('with firebase, the till is a cloud till', () => {
  assert.equal(resolvePosStorageMode(true), 'cloud');
});

// ------------------------------------------------------- catalogue csv

const products = [
  makeLocalProduct({
    id: 'p1',
    name: 'White T-shirt',
    price: 19.99,
    sku: 'TSH-001',
    barcode: '5901234123457',
    category: 'Clothing',
    sizes: ['S', 'M'],
    stock: { S: 3, M: 5 },
  }),
  makeLocalProduct({
    id: 'p2',
    name: 'Coffee 250g',
    price: 8.5,
    barcode: '4006381333931',
    stock: { _default: 12 },
  }),
];

console.log('catalogue csv');
check('export then import round-trips every field', () => {
  const csv = localProductsToCsv(products);
  const plan = planLocalProductImport(csv, products);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.rows.length, 2);
  assert.ok(plan.rows.every((r) => r.updates), 'rows with a known id should update, not add');

  const back = plan.rows.map((r) => r.product);
  for (const original of products) {
    const round = back.find((p) => p.id === original.id);
    assert.ok(round, 'missing ' + original.id);
    for (const key of ['name', 'price', 'sku', 'barcode', 'category', 'isActive', 'imageUrl']) {
      assert.deepEqual(round[key], original[key], `${original.id}.${key} drifted`);
    }
    assert.deepEqual(round.sizes, original.sizes, 'sizes drifted');
    assert.deepEqual(round.stock, original.stock, 'stock drifted');
  }
});

check('a row with no id is treated as new', () => {
  const csv = localProductsToCsv(products).replace(/^p1,/m, ',');
  const plan = planLocalProductImport(csv, products);
  const added = plan.rows.filter((r) => !r.updates);
  assert.equal(added.length, 1);
  assert.equal(added[0].product.name, 'White T-shirt');
  assert.notEqual(added[0].product.id, 'p1');
});

check('bad rows are reported by line, good rows still import', () => {
  const csv = [
    LOCAL_PRODUCT_COLUMNS.map((c) => c.header).join(','),
    ',Good item,,,5.00,,,,,',
    ',,,,9.99,,,,,',
    ',No price,,,,,,,,',
    ',Negative,,,-1,,,,,',
  ].join('\n');
  const plan = planLocalProductImport(csv, []);
  assert.equal(plan.rows.length, 1, 'only the good row should import');
  assert.equal(plan.rows[0].product.name, 'Good item');
  assert.deepEqual(plan.errors.map((e) => e.line), [3, 4, 5]);
});

check('unknown columns from a cloud export are ignored', () => {
  const csv = ['name,price,slug,brand,description,taxonomies', 'Mug,4.25,mug,Acme,A mug,x'].join(
    '\n',
  );
  const plan = planLocalProductImport(csv, []);
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.rows[0].product.name, 'Mug');
  assert.equal(plan.rows[0].product.price, 4.25);
});

check('template carries a header and one sample line', () => {
  const lines = localProductTemplateCsv().trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], LOCAL_PRODUCT_COLUMNS.map((c) => c.header).join(','));
});

check('local product projects to a usable Product', () => {
  const p = localProductToProduct(products[0]);
  assert.equal(p.id, 'p1');
  assert.equal(p.price, 19.99);
  assert.deepEqual(p.images, []);
  const withImage = localProductToProduct(
    makeLocalProduct({ name: 'x', price: 1, imageUrl: 'http://x/y.png' }),
  );
  assert.equal(withImage.images.length, 1);
  assert.ok(withImage.images[0].id, 'ProductImage.id must be set');
});

// -------------------------------------------------------------- backup

console.log('backup');
check('a foreign json file is refused', () => {
  assert.equal(parseLocalBackup('{"format":"something-else"}'), null);
  assert.equal(parseLocalBackup('not json'), null);
  assert.equal(parseLocalBackup('{"format":"caspian-standalone-till","version":999}'), null);
});
check('a well-formed backup parses', () => {
  const ok = parseLocalBackup(
    JSON.stringify({
      format: 'caspian-standalone-till',
      version: 1,
      createdAtMillis: 1,
      shop: {},
      receiptCounter: 7,
      products: [],
      users: [],
      sales: [],
    }),
  );
  assert.ok(ok);
  assert.equal(ok.receiptCounter, 7);
});
check('backup filename is dated and sortable', () => {
  assert.equal(
    localBackupFilename(new Date(2026, 7, 23, 9, 5)),
    'caspian-till-2026-08-23-0905.json',
  );
});

// ------------------------------------------------------------- pricing

const catalogue = (...items) => new Map(items.map((p) => [p.id, p]));
const tshirt = makeLocalProduct({
  id: 'p1',
  name: 'White T-shirt',
  price: 19.99,
  sku: 'TSH-001',
  barcode: '590',
  sizes: ['S', 'M'],
  stock: { S: 3, M: 1 },
});
const coffee = makeLocalProduct({
  id: 'p2',
  name: 'Coffee 250g',
  price: 8.5,
  stock: { _default: 12 },
});
const line = (over) => ({
  productId: 'p1',
  name: 'stale name',
  unitPrice: 999,
  quantity: 1,
  ...over,
});

console.log('pricing');
check('price comes from the catalogue, not the ticket', () => {
  const out = priceLocalSale([line({})], catalogue(tshirt));
  assert.equal(out.lines[0].unitPrice, 19.99, 'must ignore the stale ticket price');
  assert.equal(out.lines[0].name, 'White T-shirt', 'must refresh the name too');
  assert.equal(out.total, 19.99);
});

check('a deleted product still sells at what the ticket showed', () => {
  const out = priceLocalSale([line({ productId: 'gone', unitPrice: 4.25 })], catalogue());
  assert.equal(out.lines[0].unitPrice, 4.25);
  assert.equal(out.total, 4.25);
  assert.equal(out.stockShortfall.length, 0, 'no record means no stock to be short of');
});

check('no float drift across a long ticket', () => {
  const penny = makeLocalProduct({ id: 'p3', name: 'Sweet', price: 0.1, stock: { _default: 100 } });
  const lines = Array.from({ length: 10 }, () => line({ productId: 'p3', unitPrice: 0.1 }));
  const out = priceLocalSale(lines, catalogue(penny));
  assert.equal(out.total, 1, `0.1 x 10 must be exactly 1, got ${out.total}`);
});

check('quantity multiplies before rounding', () => {
  const odd = makeLocalProduct({ id: 'p4', name: 'Odd', price: 0.07, stock: { _default: 99 } });
  const out = priceLocalSale([line({ productId: 'p4', quantity: 3 })], catalogue(odd));
  assert.equal(out.total, 0.21);
});

console.log('discounts');
check('a markdown reduces the line', () => {
  const out = priceLocalSale([line({ lineDiscount: 5 })], catalogue(tshirt));
  assert.equal(out.subtotal, 19.99);
  assert.equal(out.discount, 5);
  assert.equal(out.total, 14.99);
  assert.equal(out.lines[0].lineTotal, 14.99);
});

check('a markdown cannot take a line below zero', () => {
  const out = priceLocalSale([line({ lineDiscount: 500 })], catalogue(tshirt));
  assert.equal(out.total, 0);
  assert.equal(out.discount, 19.99);
  assert.equal(out.lines[0].lineTotal, 0);
});

check('a negative markdown cannot inflate a line', () => {
  const out = priceLocalSale([line({ lineDiscount: -10 })], catalogue(tshirt));
  assert.equal(out.discount, 0);
  assert.equal(out.total, 19.99);
});

console.log('stock');
check('stock comes down by what was sold', () => {
  const out = priceLocalSale(
    [line({ selectedSize: 'S', quantity: 2 }), line({ productId: 'p2', quantity: 3 })],
    catalogue(tshirt, coffee),
  );
  assert.deepEqual(out.stockAfter.get('p1'), { S: 1, M: 1 });
  assert.deepEqual(out.stockAfter.get('p2'), { _default: 9 });
  assert.equal(out.stockShortfall.length, 0);
});

check('two scans of the same size accumulate against one bucket', () => {
  const out = priceLocalSale(
    [line({ selectedSize: 'S', quantity: 2 }), line({ selectedSize: 'S', quantity: 2 })],
    catalogue(tshirt),
  );
  assert.deepEqual(out.stockAfter.get('p1'), { S: -1, M: 1 });
  assert.equal(out.stockShortfall.length, 1);
  assert.deepEqual(out.stockShortfall[0], {
    productId: 'p1',
    sizeKey: 'S',
    requested: 4,
    available: 3,
  });
});

check('overselling records a shortfall but never blocks', () => {
  const out = priceLocalSale([line({ selectedSize: 'M', quantity: 5 })], catalogue(tshirt));
  // 19.99 * 5 in float JS is 99.94999999999999. Minor-unit accumulation is why
  // this is the exact figure a customer is actually asked for.
  assert.equal(out.total, 99.95);
  assert.deepEqual(out.stockAfter.get('p1'), { S: 3, M: -4 });
  assert.equal(out.stockShortfall[0].requested, 5);
  assert.equal(out.stockShortfall[0].available, 1);
});

check('an item with no size uses the _default bucket', () => {
  const out = priceLocalSale([line({ productId: 'p2', selectedSize: null })], catalogue(coffee));
  assert.deepEqual(out.stockAfter.get('p2'), { _default: 11 });
});

check('an untracked size starts from zero and goes negative', () => {
  const out = priceLocalSale([line({ selectedSize: 'XL', quantity: 1 })], catalogue(tshirt));
  assert.deepEqual(out.stockAfter.get('p1'), { S: 3, M: 1, XL: -1 });
  assert.equal(out.stockShortfall[0].available, 0);
});

console.log('shape');
check('an empty ticket totals zero and touches nothing', () => {
  const out = priceLocalSale([], catalogue(tshirt));
  assert.equal(out.total, 0);
  assert.equal(out.subtotal, 0);
  assert.equal(out.lines.length, 0);
  assert.equal(out.stockAfter.size, 0);
});

check('line fields are refreshed from the catalogue', () => {
  const out = priceLocalSale([line({ sku: 'stale', barcode: 'stale' })], catalogue(tshirt));
  assert.equal(out.lines[0].sku, 'TSH-001');
  assert.equal(out.lines[0].barcode, '590');
});

console.log('misc');
check('usernames are case-insensitive', () => {
  assert.equal(normaliseUsername('  Aysel  '), 'aysel');
});
check('minimum password length is exported', () => {
  assert.ok(MIN_LOCAL_PASSWORD_LENGTH >= 6);
});

if (failed) {
  console.error(`\n[check-standalone] ${failed} check(s) failed.`);
  process.exit(1);
}
console.log(`\n[check-standalone] ${passed} checks passed`);
