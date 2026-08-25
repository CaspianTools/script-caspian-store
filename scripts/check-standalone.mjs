#!/usr/bin/env node
/**
 * Behaviour guard for the standalone till (the `local` storage mode).
 *
 * Plain `node:assert` against the built ESM — no test runner and no new
 * dependency, matching the other `scripts/check-*.mjs` guards. It covers the
 * two things that would be expensive to get wrong and are invisible to the type
 * checker: what a customer is actually charged, what a CSV round-trip does to
 * a shop's catalogue, how a keyed amount is read at the tender screen, and
 * whether a receipt's lines add up to its own total.
 *
 * The IndexedDB layer is deliberately not covered here — it needs a browser,
 * which is exactly why the arithmetic it wraps was extracted into
 * `priceLocalSale`, where it can be checked without one. The same trick is used
 * for the row shape `writeLocalRoles` puts (`localRolesRow`) and for the backup
 * pruner, which is handed a fake directory handle: both delete or drop data,
 * and both failed silently in a browser before anything checked them.
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
  parseAmount,
  summariseSoldLines,
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
  evaluateOpeningCashGate,
  localDayKey,
  msUntilNextLocalDay,
  latestOpeningCash,
  localRolesRow,
  formatBytes,
  storageIsTight,
  pruneDatedBackups,
  LATEST_BACKUP_FILENAME,
  RECENT_BACKUPS_KEPT,
  DAILY_BACKUPS_KEPT,
  OPEN_SALE_KEY,
  allocateFefo,
  sortLotsFefo,
  summariseProductMovements,
  receiptTotals,
  lotExpiryState,
  saleStockMovements,
  DEFAULT_SIZE_KEY,
  addReceiptLine,
  ensureReceiptLine,
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
    description: 'Soft cotton, regular fit.',
  }),
  makeLocalProduct({
    id: 'p2',
    name: 'Coffee 250g',
    price: 8.5,
    barcode: '4006381333931',
    stock: { _default: 12 },
    tracksLots: true,
    costPrice: 4.25,
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
    for (const key of [
      'name',
      'price',
      'sku',
      'barcode',
      'category',
      'isActive',
      'imageUrl',
      'description',
      'tracksLots',
      'costPrice',
    ]) {
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
check('a backup from before the stock records parses, with nothing to put back', () => {
  const old = parseLocalBackup(
    JSON.stringify({
      format: 'caspian-standalone-till',
      version: 3,
      createdAtMillis: 1,
      shop: {},
      receiptCounter: 7,
      products: [],
      users: [],
      sales: [],
    }),
  );
  assert.ok(old, 'a v3 backup must still restore');
  assert.equal(old.lots, undefined);
  assert.equal(old.categories, undefined);
});

check('a stock record that is not a list is refused rather than walked', () => {
  const bad = parseLocalBackup(
    JSON.stringify({
      format: 'caspian-standalone-till',
      version: 4,
      createdAtMillis: 1,
      shop: {},
      receiptCounter: 0,
      products: [],
      users: [],
      lots: 'nope',
    }),
  );
  assert.equal(bad, null);
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

console.log('tender amounts');
// `String.replace` with a string argument replaces only the FIRST match, so the
// old reader turned `1,234.50` into `1.234.50` and parseFloat stopped at the
// second dot — 1.234 against a 1234.50 total. On the tendered field that is
// wrong change handed to a customer, so each convention gets an assertion.
check('a plain decimal point reads as written', () => {
  assert.equal(parseAmount('12.50'), 12.5);
});
check('a decimal comma reads the same way', () => {
  assert.equal(parseAmount('12,50'), 12.5);
});
check('a comma grouping separator does not become a decimal point', () => {
  assert.equal(parseAmount('1,234.50'), 1234.5);
});
check('a dot grouping separator does not become a decimal point', () => {
  assert.equal(parseAmount('1.234,50'), 1234.5);
});
check('three trailing digits are grouping, not a third decimal place', () => {
  assert.equal(parseAmount('1,234'), 1234);
  assert.equal(parseAmount('1.234'), 1234);
});
check('spaces and empty input are tolerated', () => {
  assert.equal(parseAmount(' 1 234,50 '), 1234.5);
  assert.equal(parseAmount(''), 0);
});
check('nonsense and negatives read as zero rather than NaN', () => {
  assert.equal(parseAmount('abc'), 0);
  assert.equal(parseAmount('-5'), 0);
});

console.log('receipt figures');
// The receipt used to take its lines and subtotal from the open ticket and its
// total from the commit, so a catalogue edit mid-sale printed a slip whose own
// lines did not add up to its own total. Deriving both from the priced lines is
// what makes that impossible.
check('subtotal and discount are derived from the priced lines', () => {
  const out = summariseSoldLines([
    { productId: 'a', name: 'A', unitPrice: 10.1, quantity: 3, selectedSize: null, selectedColor: null, lineDiscount: 0.3, lineTotal: 30 },
    { productId: 'b', name: 'B', unitPrice: 2.05, quantity: 2, selectedSize: null, selectedColor: null, lineDiscount: 0, lineTotal: 4.1 },
  ]);
  assert.equal(out.subtotal, 34.4);
  assert.equal(out.discount, 0.3);
  assert.equal(out.subtotal - out.discount, 34.1);
});
check('an empty set of lines totals zero', () => {
  assert.deepEqual(summariseSoldLines([]), { subtotal: 0, discount: 0 });
});
check('accumulation stays in minor units across a long ticket', () => {
  const lines = Array.from({ length: 30 }, (_, i) => ({
    productId: `p${i}`,
    name: 'x',
    unitPrice: 0.1,
    quantity: 1,
    selectedSize: null,
    selectedColor: null,
    lineDiscount: 0,
    lineTotal: 0.1,
  }));
  assert.equal(summariseSoldLines(lines).subtotal, 3);
});

// ------------------------------------------------------- opening cash
// A gate that re-asks too often stops a queue; a gate that never re-asks is
// theatre. The reset is a date-and-identity question and nothing else, which is
// why it lives in a pure module rather than inside the screen that draws it.
//
// Every literal below is Date.UTC with an explicit offset, so these answers do
// not move when CI runs in a different zone from this desk.

const BAKU = -240; // UTC+4. getTimezoneOffset() reports minutes BEHIND UTC.
const at = (y, m, d, h, mi = 0) => Date.UTC(y, m, d, h, mi);
const countedRow = (over = {}) => ({
  id: 'c1',
  amount: 200,
  cashierId: 'u1',
  cashierName: 'Aysel',
  deviceId: 'd1',
  deviceLabel: 'Front counter',
  signInId: 's1',
  confirmedAtMillis: at(2026, 7, 24, 5, 0), // 09:00 in Baku
  businessDay: '2026-08-24',
  utcOffsetMinutes: BAKU,
  ...over,
});
const gate = (over = {}) =>
  evaluateOpeningCashGate({
    required: true,
    latest: countedRow(),
    cashierId: 'u1',
    signInId: 's1',
    deviceId: 'd1',
    nowMillis: at(2026, 7, 24, 8, 0), // 12:00 in Baku
    timezoneOffsetMinutes: BAKU,
    ...over,
  });

console.log('opening cash');
check('a shop that never switched it on is never asked', () => {
  assert.equal(gate({ required: false, latest: null, cashierId: null }).required, false);
});
check('a till switched on with nothing on record is stopped', () => {
  const g = gate({ latest: null });
  assert.equal(g.satisfied, false);
  assert.equal(g.reason, 'never');
});
check('the same cashier, same sign-in, same day is admitted', () => {
  const g = gate();
  assert.equal(g.satisfied, true);
  assert.equal(g.confirmation.amount, 200);
});
check('a fresh sign-in asks again on the same day', () => {
  assert.equal(gate({ signInId: 's2' }).reason, 'new-sign-in');
});
check('blocked storage leaves no sign-in id, and that stops rather than admits', () => {
  assert.equal(gate({ signInId: null }).reason, 'new-sign-in');
});
check("another cashier's count is not this cashier's", () => {
  assert.equal(gate({ cashierId: 'u2' }).reason, 'never');
});
check('a count restored from another till does not open this drawer', () => {
  assert.equal(gate({ latest: countedRow({ deviceId: 'd0' }) }).reason, 'other-device');
});
check('nobody signed in is stopped, because there is nobody to attribute it to', () => {
  assert.equal(gate({ cashierId: null, latest: null }).reason, 'no-cashier');
});
// 20:00 UTC is midnight in Baku. These two are the whole point: the day rolls at
// the shop's midnight, not at Greenwich's, and not 24 hours after the count.
check('one minute before local midnight is still the same trading day', () => {
  assert.equal(gate({ nowMillis: at(2026, 7, 24, 19, 59) }).satisfied, true);
});
check('one minute after local midnight is a new trading day', () => {
  assert.equal(gate({ nowMillis: at(2026, 7, 24, 20, 1) }).reason, 'new-day');
});
check('the latest row wins, and only for this cashier on this till', () => {
  const rows = [
    countedRow({ id: 'a', confirmedAtMillis: at(2026, 7, 24, 5, 0) }),
    countedRow({ id: 'b', confirmedAtMillis: at(2026, 7, 24, 9, 0) }),
    countedRow({ id: 'c', confirmedAtMillis: at(2026, 7, 24, 11, 0), cashierId: 'u2' }),
    countedRow({ id: 'd', confirmedAtMillis: at(2026, 7, 24, 12, 0), deviceId: 'd2' }),
  ];
  assert.equal(latestOpeningCash(rows, 'u1', 'd1').id, 'b');
  assert.equal(latestOpeningCash([], 'u1', 'd1'), null);
});

console.log('opening cash - the local day');
check('the day key follows the device offset, not UTC', () => {
  const t = at(2026, 7, 24, 20, 30);
  assert.equal(localDayKey(t, BAKU), '2026-08-25'); // 00:30, next day in Baku
  assert.equal(localDayKey(t, 600), '2026-08-24'); // 10:30, same day in Honolulu
});
check('half-hour zones still land on a whole day', () => {
  assert.equal(localDayKey(at(2026, 7, 24, 18, 30), -330), '2026-08-25'); // 00:00 IST
  assert.equal(localDayKey(at(2026, 7, 24, 18, 29), -330), '2026-08-24'); // 23:59 IST
});
check('a daylight-saving change does not move the calendar date', () => {
  assert.equal(localDayKey(Date.UTC(2026, 2, 28, 8, 0), -60), '2026-03-28'); // 09:00 CET
  assert.equal(localDayKey(Date.UTC(2026, 2, 29, 7, 0), -120), '2026-03-29'); // 09:00 CEST
});
check('the time to the next local day is never zero', () => {
  assert.equal(msUntilNextLocalDay(at(2026, 7, 24, 19, 0), BAKU), 60 * 60 * 1000);
  assert.equal(msUntilNextLocalDay(at(2026, 7, 24, 20, 0), BAKU), 24 * 60 * 60 * 1000);
});

console.log('batches');

/** A lot, with only the fields the arithmetic reads. */
const lot = (id, expiresOn, remainingQty, receivedAtMillis = 0, sizeKey = '_default') => ({
  id,
  productId: 'p1',
  sizeKey,
  lotCode: id.toUpperCase(),
  expiresOn,
  receivedQty: remainingQty,
  remainingQty,
  unitCost: 0,
  supplierId: '',
  receiptId: '',
  receivedAtMillis,
  note: '',
});

check('the earliest expiry goes out first, whatever order it arrived in', () => {
  const order = sortLotsFefo([
    lot('c', '2027-01-15', 5, 1),
    lot('a', '2026-11-02', 5, 3),
    lot('b', '2026-12-01', 5, 2),
  ]).map((l) => l.id);
  assert.deepEqual(order, ['a', 'b', 'c']);
});

check('stock with no date sorts last, so perishables move first', () => {
  const order = sortLotsFefo([lot('undated', '', 5), lot('dated', '2030-01-01', 5)]).map((l) => l.id);
  assert.deepEqual(order, ['dated', 'undated']);
});

check('same date falls back to what arrived first', () => {
  const order = sortLotsFefo([
    lot('newer', '2026-11-02', 5, 200),
    lot('older', '2026-11-02', 5, 100),
  ]).map((l) => l.id);
  assert.deepEqual(order, ['older', 'newer']);
});

check('a draw takes the whole of the front lot before touching the next', () => {
  const { draws, unfulfilled } = allocateFefo(
    [lot('a', '2026-11-02', 4), lot('b', '2027-01-15', 10)],
    7,
  );
  assert.equal(unfulfilled, 0);
  assert.deepEqual(
    draws.map((d) => [d.lotId, d.quantity]),
    [['a', 4], ['b', 3]],
  );
});

check('an empty lot is skipped rather than drawn from', () => {
  const { draws } = allocateFefo([lot('spent', '2026-01-01', 0), lot('live', '2027-01-01', 3)], 2);
  assert.deepEqual(draws, [{ lotId: 'live', lotCode: 'LIVE', quantity: 2 }]);
});

check('more than every lot holds is reported, never refused', () => {
  const { draws, unfulfilled } = allocateFefo([lot('a', '2026-11-02', 2)], 5);
  assert.equal(draws.length, 1);
  assert.equal(draws[0].quantity, 2);
  // The rule the whole till follows: the customer is already holding the goods.
  assert.equal(unfulfilled, 3);
});

check('lots are only drawn for a product that tracks them', () => {
  const plain = makeLocalProduct({ id: 'p1', name: 'Tote bag', price: 5, stock: { _default: 10 } });
  const priced = priceLocalSale(
    [{ productId: 'p1', name: 'Tote bag', unitPrice: 5, quantity: 2 }],
    new Map([['p1', plain]]),
    new Map([['p1', [lot('a', '2026-11-02', 10)]]]),
  );
  assert.equal(priced.lotDraws.length, 0);
  assert.equal(priced.lotsAfter.size, 0);
  // And the answer is exactly what it was before lots existed.
  assert.equal(priced.stockAfter.get('p1')._default, 8);
});

check('a tracked product draws its earliest date and leaves the rest', () => {
  const tracked = makeLocalProduct({
    id: 'p1',
    name: 'Yoghurt',
    price: 1.2,
    stock: { _default: 15 },
    tracksLots: true,
  });
  const priced = priceLocalSale(
    [{ productId: 'p1', name: 'Yoghurt', unitPrice: 1.2, quantity: 6 }],
    new Map([['p1', tracked]]),
    new Map([['p1', [lot('a', '2026-11-02', 4), lot('b', '2027-01-15', 11)]]]),
  );
  assert.deepEqual(
    priced.lotDraws.map((d) => [d.lotId, d.quantity]),
    [['a', 4], ['b', 2]],
  );
  assert.equal(priced.lotsAfter.get('a'), 0);
  assert.equal(priced.lotsAfter.get('b'), 9);
  assert.equal(priced.stockAfter.get('p1')._default, 9);
});

check('one size does not draw down another size lots', () => {
  const tracked = makeLocalProduct({
    id: 'p1',
    name: 'Shirt',
    price: 20,
    sizes: ['S', 'M'],
    stock: { S: 5, M: 5 },
    tracksLots: true,
  });
  const priced = priceLocalSale(
    [{ productId: 'p1', name: 'Shirt', unitPrice: 20, quantity: 2, selectedSize: 'M' }],
    new Map([['p1', tracked]]),
    new Map([
      ['p1', [lot('small', '2026-11-02', 5, 0, 'S'), lot('medium', '2027-01-15', 5, 0, 'M')]],
    ]),
  );
  assert.deepEqual(
    priced.lotDraws.map((d) => d.lotId),
    ['medium'],
  );
  assert.equal(priced.lotsAfter.get('medium'), 3);
  assert.equal(priced.lotsAfter.has('small'), false);
});

console.log('the stock ledger');

const soldSale = {
  saleId: 's1',
  receiptNumber: 'R-000001',
  committedAtMillis: 1000,
  cashierId: 'u1',
  cashierName: 'Aysel',
  lines: [
    { productId: 'p1', quantity: 2, selectedSize: null },
    { productId: 'p1', quantity: 1, selectedSize: null },
    { productId: 'p2', quantity: 4, selectedSize: 'M' },
  ],
};

check('a sale with no lots produces one row per product and size', () => {
  const rows = saleStockMovements(soldSale);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.productId === 'p1').quantity, -3);
  assert.equal(rows.find((r) => r.productId === 'p2').quantity, -4);
  assert.equal(rows[0].sizeKey, DEFAULT_SIZE_KEY);
  assert.equal(rows[0].kind, 'sale');
  assert.equal(rows[0].reference, 'R-000001');
  assert.equal(rows[0].userName, 'Aysel');
});

check('movement ids are deterministic, so a backfill can be run twice', () => {
  const once = saleStockMovements(soldSale).map((r) => r.id);
  const twice = saleStockMovements(soldSale).map((r) => r.id);
  assert.deepEqual(once, twice);
  assert.equal(new Set(once).size, once.length);
  assert.ok(once[0].startsWith('sale:s1:'));
});

check('a lot-drawn sale has one row per lot, and they add up to what was sold', () => {
  const rows = saleStockMovements(soldSale, [
    { productId: 'p1', sizeKey: DEFAULT_SIZE_KEY, lotId: 'a', lotCode: 'A', quantity: 2 },
    { productId: 'p1', sizeKey: DEFAULT_SIZE_KEY, lotId: 'b', lotCode: 'B', quantity: 1 },
  ]);
  const forP1 = rows.filter((r) => r.productId === 'p1');
  assert.equal(forP1.length, 2);
  assert.equal(
    forP1.reduce((total, r) => total + r.quantity, 0),
    -3,
  );
  assert.deepEqual(forP1.map((r) => r.lotId).sort(), ['a', 'b']);
});

check('an oversell still adds up: the part no lot covered gets its own row', () => {
  const rows = saleStockMovements(soldSale, [
    { productId: 'p1', sizeKey: DEFAULT_SIZE_KEY, lotId: 'a', lotCode: 'A', quantity: 1 },
  ]).filter((r) => r.productId === 'p1');
  assert.equal(
    rows.reduce((total, r) => total + r.quantity, 0),
    -3,
  );
  assert.equal(rows.find((r) => r.lotId === '').quantity, -2);
});

check('the figures on a product page net out to what is on the shelf', () => {
  const summary = summariseProductMovements([
    { kind: 'receipt', quantity: 24 },
    { kind: 'sale', quantity: -19 },
    { kind: 'return', quantity: 3 },
    { kind: 'adjustment', quantity: -1 },
  ]);
  assert.deepEqual(summary, { received: 24, sold: 19, returned: 3, adjusted: -1, onHand: 7 });
});

check('nothing having happened is zero, not a crash', () => {
  assert.deepEqual(summariseProductMovements([]), {
    received: 0,
    sold: 0,
    returned: 0,
    adjusted: 0,
    onHand: 0,
  });
});

console.log('what a delivery cost');

check('a delivery totals its lines', () => {
  const totals = receiptTotals([
    { quantity: 24, unitCost: 0.6 },
    { quantity: 12, unitCost: 0.45 },
  ]);
  assert.deepEqual(totals, { lineCount: 2, unitCount: 36, totalCost: 19.8 });
});

check('a delivery does not drift, however many lines it has', () => {
  // The float answer is 2.0999999999999996 — a delivery that will not match its
  // own invoice, which is an argument with a supplier.
  assert.equal(receiptTotals([{ quantity: 3, unitCost: 0.07 }]).totalCost, 0.21);
  const many = Array.from({ length: 30 }, () => ({ quantity: 1, unitCost: 0.07 }));
  assert.equal(receiptTotals(many).totalCost, 2.1);
});

check('a negative quantity or cost cannot inflate a delivery', () => {
  assert.equal(receiptTotals([{ quantity: -5, unitCost: 10 }]).totalCost, 0);
  assert.equal(receiptTotals([{ quantity: 5, unitCost: -10 }]).totalCost, 0);
});

console.log('building up a delivery');

const receivable = (id, name, sizes = [], costPrice = 0) => ({ id, name, sizes, costPrice });

check('a scanned item joins the delivery with what it last cost', () => {
  const lines = addReceiptLine([], receivable('p1', 'Yoghurt', [], 0.6));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productId, 'p1');
  assert.equal(lines[0].productName, 'Yoghurt');
  assert.equal(lines[0].sizeKey, DEFAULT_SIZE_KEY);
  assert.equal(lines[0].quantity, 1);
  assert.equal(lines[0].unitCost, 0.6);
});

check('scanning the same box again is one more of it, not a second line', () => {
  let lines = addReceiptLine([], receivable('p1', 'Yoghurt'));
  lines = addReceiptLine(lines, receivable('p1', 'Yoghurt'));
  lines = addReceiptLine(lines, receivable('p1', 'Yoghurt'));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);
});

check('two sizes of one item are two lines', () => {
  let lines = addReceiptLine([], receivable('p1', 'Shirt', ['S']));
  lines = addReceiptLine(lines, receivable('p1', 'Shirt', ['M']));
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((l) => l.sizeKey), ['S', 'M']);
});

check('seeding a delivery from an item page is idempotent', () => {
  // The effect that calls this runs twice under React StrictMode. An
  // incrementing version would open every seeded delivery showing two.
  const once = ensureReceiptLine([], receivable('p1', 'Yoghurt'));
  const twice = ensureReceiptLine(once, receivable('p1', 'Yoghurt'));
  const thrice = ensureReceiptLine(twice, receivable('p1', 'Yoghurt'));
  assert.equal(thrice.length, 1);
  assert.equal(thrice[0].quantity, 1);
});

check('seeding never disturbs a delivery already being entered', () => {
  const started = addReceiptLine([], receivable('p1', 'Yoghurt'), 24);
  const seeded = ensureReceiptLine(started, receivable('p2', 'Crisps'));
  assert.equal(seeded.length, 2);
  // The 24 already scanned is exactly where it was.
  assert.equal(seeded[0].quantity, 24);
  assert.equal(seeded[1].quantity, 1);
});

check('neither helper mutates the array it was handed', () => {
  const original = addReceiptLine([], receivable('p1', 'Yoghurt'));
  const snapshot = JSON.stringify(original);
  addReceiptLine(original, receivable('p1', 'Yoghurt'));
  ensureReceiptLine(original, receivable('p2', 'Crisps'));
  assert.equal(JSON.stringify(original), snapshot);
});

check('a fractional delivery quantity totals the same way it lands on the shelf', () => {
  // `postLocalStockReceipt` rounds before it adds to stock. These used to
  // differ, so a pasted 2.5 put 3 on the shelf while the screen said the
  // delivery held 2.5.
  const totals = receiptTotals([{ quantity: 2.5, unitCost: 2 }]);
  assert.equal(totals.unitCount, 3);
  assert.equal(totals.totalCost, 6);
});

console.log('the backfill cannot double-count');

check('a sale already in the ledger is not written a second time', () => {
  // The shape of the bug: commitLocalSale writes one row PER LOT, keyed by the
  // lot id. The backfill has no draws to hand and would write a single `:none`
  // row for the same units -- a different key, so both survive and the product
  // page reports everything sold since the upgrade twice.
  const sale = {
    saleId: 'S1',
    receiptNumber: 'R-000001',
    committedAtMillis: 1000,
    cashierId: 'u1',
    cashierName: 'Aysel',
    lines: [{ productId: 'p1', quantity: 5, selectedSize: null }],
  };
  const fromCommit = saleStockMovements(sale, [
    { productId: 'p1', sizeKey: DEFAULT_SIZE_KEY, lotId: 'L1', lotCode: 'L1', quantity: 5 },
  ]);
  const fromBackfill = saleStockMovements(sale);
  assert.equal(fromCommit.length, 1);
  assert.equal(fromBackfill.length, 1);
  // Different ids -- which is exactly why the backfill has to skip sales the
  // ledger already knows about rather than relying on the id alone.
  assert.notEqual(fromCommit[0].id, fromBackfill[0].id);
  // And both claim the same 5 units, so keeping both doubles the figure.
  assert.equal(fromCommit[0].quantity, -5);
  assert.equal(fromBackfill[0].quantity, -5);
});

check('the saleId can be recovered from a movement id, which is how they are matched', () => {
  const rows = saleStockMovements({
    saleId: 'S-with-dashes',
    receiptNumber: 'R-1',
    committedAtMillis: 1,
    cashierId: 'u',
    cashierName: 'A',
    lines: [{ productId: 'p1', quantity: 1, selectedSize: null }],
  });
  const id = rows[0].id;
  assert.ok(id.startsWith('sale:'));
  const rest = id.slice('sale:'.length);
  assert.equal(rest.slice(0, rest.indexOf(':')), 'S-with-dashes');
});

console.log('expiry dates');

check('a date that has passed reads as out of date', () => {
  assert.equal(lotExpiryState('2026-08-20', '2026-08-25'), 'expired');
});

check('a lot is sellable on the day it expires', () => {
  // Not 'expired': it is good until the day is out, and a shop that binned it
  // at midnight would bin a day of stock it could have sold.
  assert.equal(lotExpiryState('2026-08-25', '2026-08-25'), 'soon');
});

check('the warning window is a whole number of days from today', () => {
  assert.equal(lotExpiryState('2026-09-24', '2026-08-25', 30), 'soon');
  assert.equal(lotExpiryState('2026-09-25', '2026-08-25', 30), 'ok');
});

check('stock with no date never warns', () => {
  assert.equal(lotExpiryState('', '2026-08-25'), 'none');
  assert.equal(lotExpiryState('not a date', '2026-08-25'), 'none');
});

console.log('misc');
check('usernames are case-insensitive', () => {
  assert.equal(normaliseUsername('  Aysel  '), 'aysel');
});
check('minimum password length is exported', () => {
  assert.ok(MIN_LOCAL_PASSWORD_LENGTH >= 6);
});

console.log('roles are written in a shape the store will accept');
check('the roles row carries the id its object store keys on', () => {
  // The store is created with `keyPath: 'id'`. A row without one is a
  // `DataError`, the transaction aborts, and the only visible symptom is a
  // success toast that never appears -- which is how custom roles quietly
  // failed to survive a reload for three releases.
  const row = localRolesRow([{ id: 'staff', name: 'Staff', enabled: true, capabilities: [] }]);
  assert.equal(row.id, 'roles');
  assert.equal(row.key, row.id);
  assert.equal(row.value.length, 1);
});

console.log('storage health');
check('bytes are reported in units a shop reads', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(20 * 1024 * 1024), '20 MB');
});
check('a near-full quota is called tight, and an unknown one is not', () => {
  assert.equal(storageIsTight({ usage: 95, quota: 100 }), true);
  assert.equal(storageIsTight({ usage: 50, quota: 100 }), false);
  assert.equal(storageIsTight({ usage: null, quota: null }), false);
  // A zero quota is a browser declining to answer, not a full disk.
  assert.equal(storageIsTight({ usage: 10, quota: 0 }), false);
});

console.log('backup pruning');
const fakeFolder = (names) => {
  const removed = [];
  return {
    removed,
    async *entries() {
      for (const name of names) yield [name, { kind: 'file' }];
    },
    removeEntry: async (name) => {
      removed.push(name);
    },
  };
};
const stamp = (day, hhmm) => `caspian-till-2026-01-${String(day).padStart(2, '0')}-${hhmm}.json`;

await (async () => {
  // The failure this policy exists to prevent: the writer makes a file after
  // every sale, so a plain keep-30 count meant a busy till's oldest "backup"
  // was two hours old. One a day has to survive regardless of volume.
  const busyDay = ['0900', '1000', '1100', '1200', '1300', '1400', '1500', '1600'];
  const names = [];
  for (const day of [1, 2, 3]) for (const t of busyDay) names.push(stamp(day, t));

  const folder = fakeFolder(names);
  await pruneDatedBackups(folder, { recent: 3, days: 30 });
  const kept = names.filter((n) => !folder.removed.includes(n));

  check('one file survives from every day, however many that day produced', () => {
    for (const day of [1, 2, 3]) {
      const survivors = kept.filter((n) => n.includes(`2026-01-0${day}-`));
      assert.ok(survivors.length >= 1, `nothing kept from day ${day}`);
    }
  });
  check('the file kept for a day is that day\'s last, not its first', () => {
    assert.ok(kept.includes(stamp(1, '1600')));
    assert.ok(!kept.includes(stamp(1, '0900')));
  });
  check('the most recent few survive on top of the daily ones', () => {
    for (const t of ['1400', '1500', '1600']) assert.ok(kept.includes(stamp(3, t)));
  });
})();

await (async () => {
  // Everything else in the folder is somebody's file. This runs against a real
  // directory a shop chose, so anything but our own dated pattern must be
  // untouchable -- including the rolling copy, which is the newest data there is.
  const names = [
    stamp(1, '0900'), stamp(2, '0900'), stamp(3, '0900'), stamp(4, '0900'),
    LATEST_BACKUP_FILENAME,
    'payroll.json',
    'caspian-till-notes.json',
    'caspian-till-2026-01-09.json',
    'caspian-till-2026-01-09-0900.json.bak',
  ];
  const folder = fakeFolder(names);
  await pruneDatedBackups(folder, { recent: 1, days: 1 });
  check('nothing outside the dated pattern is ever deleted', () => {
    assert.deepEqual(folder.removed, [stamp(1, '0900'), stamp(2, '0900'), stamp(3, '0900')]);
  });
})();

await (async () => {
  const names = [stamp(1, '0900'), stamp(2, '0900')];
  const folder = fakeFolder(names);
  await pruneDatedBackups(folder);
  check('a folder under the keep counts loses nothing', () => {
    assert.deepEqual(folder.removed, []);
  });
})();

check('the keep policy is two numbers, and both are sane', () => {
  assert.ok(RECENT_BACKUPS_KEPT >= 1);
  assert.ok(DAILY_BACKUPS_KEPT >= 7);
});

check('the name the till writes is the name the pruner recognises', () => {
  // The coupling that would otherwise rot silently: change the stamp format and
  // pruning stops matching, so a busy till grows an unbounded folder forever.
  const dated = /^caspian-till-(\d{4}-\d{2}-\d{2})-\d{4}\.json$/;
  const produced = localBackupFilename(new Date(2026, 0, 9, 8, 5));
  assert.ok(dated.test(produced), produced);
  assert.equal(dated.exec(produced)[1], '2026-01-09');
  assert.ok(!dated.test(LATEST_BACKUP_FILENAME));
});

check('the open sale is stored under one key per till', () => {
  assert.equal(OPEN_SALE_KEY, 'current');
});

if (failed) {
  console.error(`\n[check-standalone] ${failed} check(s) failed.`);
  process.exit(1);
}
console.log(`\n[check-standalone] ${passed} checks passed`);
