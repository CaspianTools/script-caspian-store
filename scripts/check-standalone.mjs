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
  hashLocalPassword,
  verifyLocalPassword,
  needsRehash,
  parseLocalSession,
  credentialStampOf,
  canRemoveLocalUser,
  canDisableLocalUser,
  evaluateSignInThrottle,
  recordSignInFailure,
  pruneSignInThrottle,
  throttleWaitSeconds,
  SIGN_IN_FREE_ATTEMPTS,
  SIGN_IN_DELAY_LADDER_MS,
  SIGN_IN_THROTTLE_FORGET_MS,
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
  rangeStart,
  salesByProduct,
  productSaleRows,
  categoryTotals,
  supplierTotals,
  passwordIsWeak,
  verifyStoredCredentials,
  formatRecoveryCode,
  normaliseRecoveryCode,
  isRecoveryCodeShaped,
  mintRecoveryCode,
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_PREFIX,
  RECOVERY_CODE_SYMBOLS,
  hasRecoveryCode,
  DEFAULT_LOCAL_SHOP_SETTINGS,
  formatTerminalCode,
  normaliseTerminalCode,
  isTerminalCodeShaped,
  mintTerminalCode,
  TERMINAL_CODE_PREFIX,
  TERMINAL_CODE_SYMBOLS,
  evaluateShiftGate,
  openShiftForDevice,
  summariseShift,
  salesForShift,
  shiftVariance,
} = lib;

let passed = 0;
let failed = 0;
/**
 * Collected so an async check can be awaited before the summary is printed.
 *
 * The helper used to call `fn()` and catch synchronously, which meant an async
 * check reported "ok" the instant it started and its rejection landed nowhere.
 * The PBKDF2 checks below are the first async ones here, and a guard that
 * cannot fail is worse than no guard at all.
 */
const pending = [];
const pass = (name) => {
  passed++;
  console.log('  ok  ' + name);
};
const fail = (name, error) => {
  failed++;
  console.error('  FAIL  ' + name);
  console.error('        ' + (error && error.message ? error.message : error));
};
const check = (name, fn) => {
  let result;
  try {
    result = fn();
  } catch (error) {
    fail(name, error);
    return;
  }
  if (result && typeof result.then === 'function') {
    pending.push(result.then(() => pass(name), (error) => fail(name, error)));
    return;
  }
  pass(name);
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

// A plain count is what the item form asks for and what most shops mean. The
// shared `parseStock` skips any part without a colon, so before v1.6.0 a `12`
// here imported an item with no stock and said nothing about it.
check('a bare stock count imports as the sizeless bucket', () => {
  const csv = [
    LOCAL_PRODUCT_COLUMNS.map((c) => c.header).join(','),
    ',Sock,,,3.00,,,12,',
    ',Shirt,,,9.00,,S;M,S:3;M:5,',
    ',Junk,,,1.00,,,twelve,',
  ].join('\n');
  const plan = planLocalProductImport(csv, []);
  assert.equal(plan.errors.length, 0, 'none of these rows is malformed');
  assert.deepEqual(plan.rows[0].product.stock, { _default: 12 });
  assert.deepEqual(plan.rows[1].product.stock, { S: 3, M: 5 }, 'the per-size form still parses');
  assert.deepEqual(plan.rows[2].product.stock, {}, 'a count that is not a number buys nothing');
});

check('a sizeless count exports plainly, so _default never reaches a spreadsheet', () => {
  const csv = localProductsToCsv(products);
  assert.ok(
    !csv.includes('_default'),
    'the sentinel is an internal key, not something to show an owner',
  );
  assert.ok(csv.includes(',12,'), 'the sizeless item writes its count plainly');
  assert.ok(csv.includes('S:3;M:5'), 'an item with sizes keeps the per-size form');
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


// ------------------------------------------------------------------ passwords
//
// crypto.subtle is present in Node 18+, so the PBKDF2 path is genuinely
// checkable here. Six derives at 600k iterations is a few seconds; keep it to
// these, and never add a seventh casually.

check('a password verifies against its own hash and nothing else', async () => {
  const creds = await hashLocalPassword('correct horse');
  const user = {
    passwordHash: creds.hash,
    passwordSalt: creds.salt,
    passwordIterations: creds.iterations,
  };
  assert.equal(await verifyLocalPassword('correct horse', user), true);
  assert.equal(await verifyLocalPassword('correct horsf', user), false, 'one character off must fail');
  assert.equal(await verifyLocalPassword('', user), false);
});

check('the salt is per user, not per install', async () => {
  // A constant salt is invisible to the type checker and to every screen: two
  // people who pick the same password would simply have the same stored hash.
  const a = await hashLocalPassword('same password');
  const b = await hashLocalPassword('same password');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

check('the iteration count stored on the account is the one that is used', async () => {
  // The regression that would silently lock out every existing account the day
  // the cost is raised. `passwordIterations` exists precisely so old accounts
  // keep working; if verification ever reads the constant instead, this fails.
  const creds = await hashLocalPassword('shop password');
  const raised = { ...creds, iterations: creds.iterations + 1 };
  const user = {
    passwordHash: raised.hash,
    passwordSalt: raised.salt,
    passwordIterations: raised.iterations,
  };
  assert.equal(await verifyLocalPassword('shop password', user), false,
    'a mismatched iteration count must not still verify');
});

check('needsRehash notices an account below the current cost, and only then', () => {
  assert.equal(needsRehash({ passwordIterations: 1 }), true);
  assert.equal(needsRehash({ passwordIterations: 600_000 }), false);
  assert.equal(needsRehash({ passwordIterations: 900_000 }), false);
});

// ------------------------------------------------------------- delay ladder
//
// Every instant is an explicit `now`, never Date.now(): the same discipline the
// opening-cash block keeps, and for the same reason.

const T0 = 1_700_000_000_000;

check('the first three failures cost nothing', () => {
  assert.equal(SIGN_IN_FREE_ATTEMPTS, 3);
  let rec;
  for (let i = 0; i < SIGN_IN_FREE_ATTEMPTS; i++) {
    rec = recordSignInFailure(rec, T0);
    const v = evaluateSignInThrottle(rec, T0);
    assert.equal(v.allowed, true, `attempt ${i + 1} should not be delayed`);
    assert.equal(v.waitMillis, 0);
  }
});

check('the fourth failure starts the ladder and it climbs to a ceiling', () => {
  let rec;
  for (let i = 0; i < 4; i++) rec = recordSignInFailure(rec, T0);
  assert.equal(evaluateSignInThrottle(rec, T0).waitMillis, SIGN_IN_DELAY_LADDER_MS[0]);

  const ceiling = SIGN_IN_DELAY_LADDER_MS[SIGN_IN_DELAY_LADDER_MS.length - 1];
  for (let i = 0; i < 20; i++) rec = recordSignInFailure(rec, T0);
  const v = evaluateSignInThrottle(rec, T0);
  assert.equal(v.allowed, false);
  assert.equal(v.waitMillis, ceiling, 'the ladder must stop, never grow without bound');
});

check('the wait counts down, and never becomes a lockout', () => {
  let rec;
  for (let i = 0; i < 4; i++) rec = recordSignInFailure(rec, T0);
  const full = SIGN_IN_DELAY_LADDER_MS[0];
  assert.equal(evaluateSignInThrottle(rec, T0 + 1000).waitMillis, full - 1000);
  assert.equal(evaluateSignInThrottle(rec, T0 + full).allowed, true,
    'once the wait is served the attempt must be allowed -- there is no locked state');
});

check('a quiet spell forgets the count entirely', () => {
  let rec;
  for (let i = 0; i < 8; i++) rec = recordSignInFailure(rec, T0);
  assert.equal(evaluateSignInThrottle(rec, T0 + SIGN_IN_THROTTLE_FORGET_MS).failures, 0);
  // And the next failure starts again from one rather than resuming at eight.
  assert.equal(recordSignInFailure(rec, T0 + SIGN_IN_THROTTLE_FORGET_MS).failures, 1);
});

check('pruning drops stale buckets and keeps live ones', () => {
  const state = {
    stale: { failures: 9, lastFailureAtMillis: T0 },
    live: { failures: 2, lastFailureAtMillis: T0 + SIGN_IN_THROTTLE_FORGET_MS },
  };
  const pruned = pruneSignInThrottle(state, T0 + SIGN_IN_THROTTLE_FORGET_MS + 1);
  assert.deepEqual(Object.keys(pruned), ['live']);
});

check('the ladder cannot tell whether the account exists', () => {
  // It takes a record and a clock and nothing else. If it ever grew a lookup,
  // a throttle that fired only for real names would hand back exactly the
  // username oracle the dummy derive in signInLocal exists to close.
  const rec = { failures: 5, lastFailureAtMillis: T0 };
  assert.deepEqual(evaluateSignInThrottle(rec, T0), evaluateSignInThrottle({ ...rec }, T0));
  assert.equal(throttleWaitSeconds(4200), 5, 'a part second still reads as a whole one');
  assert.equal(throttleWaitSeconds(1), 1);
});

// ----------------------------------------------------------------- sessions

check('the old bare-id session record still reads', () => {
  // Every till in the field has one of these on disk. Without this branch they
  // would all sign out on the morning after the upgrade.
  assert.deepEqual(parseLocalSession('abc123'), {
    userId: 'abc123',
    issuedAtMillis: 0,
    lastSeenAtMillis: 0,
    credentialStamp: '',
  });
  assert.equal(parseLocalSession(null), null);
  assert.equal(parseLocalSession(''), null);
  assert.equal(parseLocalSession('{not json'), null);
  assert.equal(parseLocalSession('{"issuedAtMillis":1}'), null, 'a record with no user is no record');
});

check('a session record round-trips, and the stamp follows the password', () => {
  const record = {
    userId: 'u1',
    issuedAtMillis: T0,
    lastSeenAtMillis: T0 + 5,
    credentialStamp: 'abcdefghijklmnop',
  };
  assert.deepEqual(parseLocalSession(JSON.stringify(record)), record);
  assert.equal(credentialStampOf({ passwordHash: 'abcdefghijklmnopqrstuvwx' }), 'abcdefghijklmnop');
  assert.notEqual(
    credentialStampOf({ passwordHash: 'ZZZZZZZZZZZZZZZZqrstuvwx' }),
    credentialStampOf({ passwordHash: 'abcdefghijklmnopqrstuvwx' }),
    'a changed password must change the stamp, or a reset would not end the session',
  );
});

// -------------------------------------------------- the last way in
//
// App admin already refuses to switch the Support role off. These are the same
// rule for the last Support account, which the People screen never had.

check('the last account that can open App admin cannot be removed', () => {
  const holds = (role) => role === 'superadmin';
  const users = [
    { id: 'a', role: 'superadmin' },
    { id: 'b', role: 'staff' },
  ];
  assert.equal(canRemoveLocalUser(users, 'a', holds), false);
  assert.equal(canRemoveLocalUser(users, 'b', holds), true, 'a cashier is never the last way in');
  assert.equal(canDisableLocalUser(users, 'a', holds), false);

  const two = [...users, { id: 'c', role: 'superadmin' }];
  assert.equal(canRemoveLocalUser(two, 'a', holds), true);

  const otherBlocked = [{ id: 'a', role: 'superadmin' }, { id: 'c', role: 'superadmin', disabled: true }];
  assert.equal(canRemoveLocalUser(otherBlocked, 'a', holds), false,
    'a blocked account is not a way in, so it cannot be the spare');

  assert.equal(canRemoveLocalUser(users, 'nobody', holds), false);
});

check('a custom role granted App admin counts as a way in', () => {
  // The whole reason the capability test is an argument rather than an import:
  // the static built-in map knows seven ids and would not see this one.
  const holds = (role) => role === 'superadmin' || role === 'shop-owner';
  const users = [
    { id: 'a', role: 'superadmin' },
    { id: 'b', role: 'shop-owner' },
  ];
  assert.equal(canRemoveLocalUser(users, 'a', holds), true);
});

console.log('\nthe recovery code');

check('the printed shape is the prefix and five groups of five', () => {
  const code = mintRecoveryCode();
  assert.match(code, /^CSPR1(-[0-9A-Z]{5}){5}$/);
  assert.equal(code.length, 'CSPR1'.length + 5 * 6);
});

check('the alphabet leaves out the letters people confuse with digits', () => {
  for (const letter of ['I', 'L', 'O', 'U']) {
    assert.equal(RECOVERY_CODE_ALPHABET.includes(letter), false, `${letter} should not be mintable`);
  }
  assert.equal(RECOVERY_CODE_ALPHABET.length, 32, 'base32 needs exactly 32 symbols');
  assert.equal(new Set(RECOVERY_CODE_ALPHABET).size, 32, 'and no repeats');
});

check('two codes minted in a row are not the same', () => {
  assert.notEqual(mintRecoveryCode(), mintRecoveryCode());
});

check('a code typed in lower case with no dashes normalises to the printed one', () => {
  const printed = mintRecoveryCode();
  const sloppy = printed.toLowerCase().replace(/-/g, '');
  assert.equal(formatRecoveryCode(normaliseRecoveryCode(sloppy)), printed);
});

check('the confusable letters are folded onto the digits they look like', () => {
  // Somebody reading a code down a phone says "oh" for zero and "ell" for one,
  // and the person writing it down writes what they heard.
  assert.equal(normaliseRecoveryCode('O I L'), '011');
  assert.equal(normaliseRecoveryCode('o i l'), '011');
  // Spaces, dashes and a stray newline from a paste all go.
  assert.equal(normaliseRecoveryCode(' 2-3 4\n5 '), '2345');
});

check('the prefix is stripped whether or not it was typed', () => {
  const payload = normaliseRecoveryCode(mintRecoveryCode());
  assert.equal(payload.length, RECOVERY_CODE_SYMBOLS);
  assert.equal(normaliseRecoveryCode(payload), payload, 'already-bare input is left alone');
  assert.equal(normaliseRecoveryCode(`${RECOVERY_CODE_PREFIX}-${payload}`), payload);
});

check('garbage and near-misses are refused on shape alone', () => {
  const good = mintRecoveryCode();
  assert.equal(isRecoveryCodeShaped(good), true);
  assert.equal(isRecoveryCodeShaped(good.toLowerCase()), true);
  assert.equal(isRecoveryCodeShaped(''), false);
  assert.equal(isRecoveryCodeShaped('CSPR1-ABC'), false, 'too short');
  assert.equal(isRecoveryCodeShaped(`${good}Z`), false, 'too long');
  assert.equal(isRecoveryCodeShaped('the quick brown fox jumped over it'), false);
});

check('a minted code verifies through the same PBKDF2 as a password', async () => {
  // The point of the round-trip: the code is stored exactly the way a password
  // is, so raising the iteration count one day cannot leave codes behind.
  const code = mintRecoveryCode();
  const stored = await hashLocalPassword(normaliseRecoveryCode(code));
  assert.equal(await verifyStoredCredentials(normaliseRecoveryCode(code), stored), true);

  const payload = normaliseRecoveryCode(code);
  const swapped = RECOVERY_CODE_ALPHABET[(RECOVERY_CODE_ALPHABET.indexOf(payload[0]) + 1) % 32];
  const oneOff = swapped + payload.slice(1);
  assert.notEqual(oneOff, payload);
  assert.equal(await verifyStoredCredentials(oneOff, stored), false, 'one symbol out must fail');
});

check('a till with no code is told apart from one that has one', () => {
  assert.equal(hasRecoveryCode(DEFAULT_LOCAL_SHOP_SETTINGS), false);
  assert.equal(
    hasRecoveryCode({ ...DEFAULT_LOCAL_SHOP_SETTINGS, recoveryHash: 'h', recoverySalt: 's' }),
    false,
    'a stored row with no iteration count is not a usable code',
  );
  assert.equal(
    hasRecoveryCode({
      ...DEFAULT_LOCAL_SHOP_SETTINGS,
      recoveryHash: 'h',
      recoverySalt: 's',
      recoveryIterations: 600000,
    }),
    true,
  );
});

check('the recovery fields default to empty, so an upgrading till needs no migration', () => {
  // `readLocalShopSettings` merges over these. If any of them were absent the
  // merge would hand back `undefined` and `hasRecoveryCode` would throw rather
  // than say "no code yet".
  for (const field of ['recoveryHash', 'recoverySalt', 'recoveryForUserId']) {
    assert.equal(DEFAULT_LOCAL_SHOP_SETTINGS[field], '', `${field} must default to empty`);
  }
  assert.equal(DEFAULT_LOCAL_SHOP_SETTINGS.recoveryIterations, 0);
  assert.equal(DEFAULT_LOCAL_SHOP_SETTINGS.recoveryMintedAtMillis, 0);
});

check('the recovery ladder charges from the very first wrong code', () => {
  // Zero free attempts, unlike the three the front door allows: nobody mistypes
  // twenty-five symbols off a piece of paper by leaving caps lock on.
  const first = recordSignInFailure(undefined, 1_000);
  const verdict = evaluateSignInThrottle(first, 1_000, 0);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.waitMillis, SIGN_IN_DELAY_LADDER_MS[0]);

  // ...while the same record at the front door's three free tries is waved through.
  assert.equal(evaluateSignInThrottle(first, 1_000).allowed, true);
  assert.equal(evaluateSignInThrottle(first, 1_000, SIGN_IN_FREE_ATTEMPTS).allowed, true);
});

check('the recovery ladder still climbs, tops out, and is forgotten', () => {
  let record = undefined;
  const at = 1_000;
  for (let i = 0; i < 6; i++) record = recordSignInFailure(record, at);
  assert.equal(
    evaluateSignInThrottle(record, at, 0).waitMillis,
    SIGN_IN_DELAY_LADDER_MS[SIGN_IN_DELAY_LADDER_MS.length - 1],
    'six failures is past the end of the ladder, so it sits on the ceiling',
  );
  assert.equal(
    evaluateSignInThrottle(record, at + SIGN_IN_THROTTLE_FORGET_MS, 0).allowed,
    true,
    'quiet for the forget window clears it, as it does at the front door',
  );
});

console.log('\npasswords a till refuses');

check('a password equal to the account name is refused however it is typed', () => {
  assert.equal(passwordIsWeak('aysel', 'aysel'), true);
  assert.equal(passwordIsWeak('AYSEL', 'aysel'), true, 'case is not a difference');
  assert.equal(passwordIsWeak('aysel', '  Aysel  '), true, 'nor is a stray space');
});

check('the blocklist catches what a stranger tries first', () => {
  for (const bad of ['123456', 'password', 'qwerty', 'parol', 'admin', 'kassa']) {
    assert.equal(passwordIsWeak(bad, 'aysel'), true, `${bad} should be refused`);
  }
  assert.equal(passwordIsWeak('PASSWORD', 'aysel'), true, 'case is not a difference here either');
});

check('an ordinary password is allowed', () => {
  assert.equal(passwordIsWeak('kupfer-lantern-9', 'aysel'), false);
  assert.equal(passwordIsWeak('aysel2026!', 'aysel'), false, 'containing the name is not being it');
  assert.equal(passwordIsWeak('', 'aysel'), true, 'nothing at all is not a password');
});

console.log('\nthe code that names a counter');

check('a minted code is shaped, prefixed and grouped for reading aloud', () => {
  const code = mintTerminalCode();
  assert.equal(isTerminalCodeShaped(code), true);
  assert.match(code, /^CSPT1-[0-9A-Z]{5}-[0-9A-Z]{5}$/, 'prefix then two groups of five');
  assert.equal(normaliseTerminalCode(code).length, TERMINAL_CODE_SYMBOLS);
});

check('a recovery code typed into the pairing box is refused on shape', () => {
  // Not merely reported as the wrong pairing code: the two are different
  // lengths and carry different prefixes, so the shape check catches it before
  // any PBKDF2 derive is paid for.
  assert.equal(isTerminalCodeShaped(mintRecoveryCode()), false);
  assert.equal(isRecoveryCodeShaped(mintTerminalCode()), false, 'and the other way round');
  assert.notEqual(TERMINAL_CODE_PREFIX, RECOVERY_CODE_PREFIX);
});

check('handwriting is folded the way the recovery code folds it', () => {
  const payload = 'ABCDE01234';
  const code = formatTerminalCode(payload);
  assert.equal(normaliseTerminalCode(code), payload);
  assert.equal(normaliseTerminalCode(code.toLowerCase()), payload, 'case is not a difference');
  assert.equal(normaliseTerminalCode(payload), payload, 'nor is leaving the prefix off');
  assert.equal(
    normaliseTerminalCode(' cspt1 abcde 01234 \n'),
    payload,
    'nor spaces, nor the newline a paste brings with it',
  );
  assert.equal(
    normaliseTerminalCode('CSPT1-ABCDE-0O234'),
    'ABCDE00234',
    'an O written where the paper said 0 folds back',
  );
  assert.equal(normaliseTerminalCode('CSPT1-ABCDE-0I234'), 'ABCDE01234', 'and I and L onto 1');
});

check('a pairing code round-trips through the hashing a password uses', async () => {
  const code = mintTerminalCode();
  const payload = normaliseTerminalCode(code);
  const stored = await hashLocalPassword(payload);
  assert.equal(await verifyStoredCredentials(payload, stored), true);
  // One character different is a different counter, not a near miss.
  const variant = (payload[0] === 'A' ? 'B' : 'A') + payload.slice(1);
  assert.equal(await verifyStoredCredentials(variant, stored), false);
});

check('an empty or pasted-sentence box is refused before any derive', () => {
  assert.equal(isTerminalCodeShaped(''), false);
  assert.equal(isTerminalCodeShaped('   '), false);
  assert.equal(isTerminalCodeShaped('please open the till'), false);
  assert.equal(isTerminalCodeShaped('CSPT1-ABCDE'), false, 'half a code is not a code');
});

console.log('\nwhat a shift took');

const shiftOf = (openingFloat, movements = []) => ({ openingFloat, movements });
const saleOf = (total, tenders, shiftId = 's1') => ({ total, tenders, shiftId });
const cash = (amount, tendered) => ({ kind: 'cash', amount, ...(tendered ? { tendered } : {}) });

check('expected cash is the float plus what went into the drawer', () => {
  const totals = summariseShift(shiftOf(100), [
    saleOf(14, [cash(14, 20)]),
    saleOf(6.5, [cash(6.5)]),
  ]);
  assert.equal(totals.expectedCash, 120.5);
  assert.equal(totals.cashTaken, 20.5);
  assert.equal(totals.salesTotal, 20.5);
  assert.equal(totals.saleCount, 2);
});

check('change handed back is not counted as cash taken', () => {
  // The drawer nets the applied amount. Counting `tendered` would say the shift
  // took six pounds more than it did, every time anybody paid with a note.
  const totals = summariseShift(shiftOf(0), [saleOf(14, [cash(14, 20)])]);
  assert.equal(totals.cashTaken, 14, 'not 20');
  assert.equal(totals.expectedCash, 14);
});

check('a card sale moves the takings but not the drawer', () => {
  const totals = summariseShift(shiftOf(50), [
    saleOf(30, [{ kind: 'card', amount: 30 }]),
    saleOf(10, [cash(10)]),
  ]);
  assert.equal(totals.expectedCash, 60, 'the float plus the tenner, and not the card sale');
  assert.equal(totals.salesTotal, 40);
  assert.deepEqual(totals.totalsByTender, { card: 30, cash: 10 });
});

check('a split tender lands in both columns', () => {
  const totals = summariseShift(shiftOf(0), [saleOf(50, [cash(20), { kind: 'card', amount: 30 }])]);
  assert.deepEqual(totals.totalsByTender, { cash: 20, card: 30 });
  assert.equal(totals.expectedCash, 20);
});

check('money paid out of the drawer is subtracted, and paid in is added', () => {
  // This is the whole reason a variance can be computed at all. Without it the
  // expected figure is wrong the first time anybody pays a delivery out of the
  // till, and a wrong variance is what shops discipline staff on.
  const totals = summariseShift(
    shiftOf(100, [
      { kind: 'out', amount: 12.4, reason: 'milkman' },
      { kind: 'in', amount: 50, reason: 'float top-up' },
      { kind: 'out', amount: 7.6, reason: 'window cleaner' },
    ]),
    [saleOf(20, [cash(20)])],
  );
  assert.equal(totals.movementsOut, 20);
  assert.equal(totals.movementsIn, 50);
  assert.equal(totals.expectedCash, 150, '100 + 20 + 50 - 20');
});

check('a movement that arrived negative is taken at its magnitude', () => {
  // `kind` carries the direction. A minus key slipped into the amount box must
  // not quietly reverse the movement it claims to be.
  const totals = summariseShift(shiftOf(100, [{ kind: 'out', amount: -10, reason: 'slip' }]), []);
  assert.equal(totals.expectedCash, 90, 'still out, not in');
});

check('a shift with no sales expects exactly its float', () => {
  const totals = summariseShift(shiftOf(75.25), []);
  assert.equal(totals.expectedCash, 75.25);
  assert.equal(totals.saleCount, 0);
  assert.deepEqual(totals.totalsByTender, {});
});

check('a long day of odd amounts does not drift by a cent', () => {
  // The reason the sums run in minor units. Summing 0.10 as a float a hundred
  // times lands just under 10, and a drawer that will not balance is somebody
  // answering for money.
  const sales = Array.from({ length: 100 }, () => saleOf(0.1, [cash(0.1)]));
  const totals = summariseShift(shiftOf(0), sales);
  assert.equal(totals.expectedCash, 10);
  assert.equal(totals.salesTotal, 10);
});

check('only the sales stamped with this shift count towards it', () => {
  const rows = [
    saleOf(10, [cash(10)], 's1'),
    saleOf(99, [cash(99)], 's2'),
    { total: 5, tenders: [cash(5)] },
  ];
  const mine = salesForShift(rows, 's1');
  assert.equal(mine.length, 1, 'another shift and an unstamped sale are not mine');
  assert.equal(summariseShift(shiftOf(0), mine).expectedCash, 10);
});

check('variance is counted minus expected, and negative means short', () => {
  assert.equal(shiftVariance(118.5, 120.5), -2, 'two pounds missing reads as minus two');
  assert.equal(shiftVariance(122.5, 120.5), 2, 'and a surplus reads as plus');
  assert.equal(shiftVariance(120.5, 120.5), 0, 'an exact count is exactly zero');
  assert.equal(shiftVariance(0.3, 0.1 + 0.2), 0, 'and float crumbs do not render as a variance');
});

console.log('\nwhether the register opens');

const aTerminal = { id: 't1', name: 'Front counter' };
const anOpenShift = {
  id: 's1',
  cashierId: 'u1',
  deviceId: 'd1',
  status: 'open',
  openedAtMillis: 10,
};

check('shifts switched off short-circuit everything', () => {
  const gate = evaluateShiftGate({ required: false, open: null, terminal: null, cashierId: null });
  assert.equal(gate.required, false);
});

check('nobody signed in belongs to the sign-in screen, not to this gate', () => {
  const gate = evaluateShiftGate({
    required: true,
    open: null,
    terminal: aTerminal,
    cashierId: null,
  });
  assert.equal(gate.reason, 'no-cashier');
});

check('a device that has claimed no counter has nowhere to hang a shift', () => {
  const gate = evaluateShiftGate({ required: true, open: null, terminal: null, cashierId: 'u1' });
  assert.equal(gate.reason, 'no-terminal');
});

check('no shift open asks for one', () => {
  const gate = evaluateShiftGate({
    required: true,
    open: null,
    terminal: aTerminal,
    cashierId: 'u1',
  });
  assert.equal(gate.reason, 'none-open');
});

check('an open shift belonging to somebody else is a handover, and names whose', () => {
  const gate = evaluateShiftGate({
    required: true,
    open: anOpenShift,
    terminal: aTerminal,
    cashierId: 'u2',
  });
  assert.equal(gate.reason, 'other-cashier');
  assert.equal(gate.shift.id, 's1', 'the screen needs it to offer a Close button');
});

check('an open shift belonging to this cashier opens the register', () => {
  const gate = evaluateShiftGate({
    required: true,
    open: anOpenShift,
    terminal: aTerminal,
    cashierId: 'u1',
  });
  assert.equal(gate.satisfied, true);
  assert.equal(gate.shift.id, 's1');
});

check('the gate never compares sign-ins, so a lunch break does not end a shift', () => {
  // Deliberately unlike the opening-cash gate, which is per sign-in. Somebody
  // who locks the screen, or signs out to let a colleague check a price, is
  // still working the same turn -- and ending it underneath them would close a
  // drawer nobody counted. There is no signInId in the gate input at all.
  const gate = evaluateShiftGate({
    required: true,
    open: { ...anOpenShift, signInId: 'long-gone' },
    terminal: aTerminal,
    cashierId: 'u1',
  });
  assert.equal(gate.satisfied, true);
});

check('only an open shift on THIS device is found', () => {
  const rows = [
    { id: 'a', status: 'closed', deviceId: 'd1', openedAtMillis: 50 },
    { id: 'b', status: 'open', deviceId: 'd2', openedAtMillis: 40 },
    { id: 'c', status: 'open', deviceId: 'd1', openedAtMillis: 30 },
  ];
  assert.equal(openShiftForDevice(rows, 'd1').id, 'c', 'not the closed one, not the other till');
  assert.equal(openShiftForDevice(rows, 'd3'), null);
});

check('the newest wins if a restored backup left two open', () => {
  // Should not happen -- the gate refuses to open a second -- but a backup can
  // legitimately carry a shift left open on the machine it came from, and the
  // cashier standing here needs something they can close.
  const rows = [
    { id: 'old', status: 'open', deviceId: 'd1', openedAtMillis: 10 },
    { id: 'new', status: 'open', deviceId: 'd1', openedAtMillis: 20 },
  ];
  assert.equal(openShiftForDevice(rows, 'd1').id, 'new');
});

// ---------------------------------------------------------------- store-stats
// The figures the category, supplier and product pages print. Pure by design --
// every function is handed rows a caller already read -- which is the whole
// reason they live in `store-stats.ts` rather than inside the screens.

const statSale = (over) => ({
  saleId: 's1',
  receiptNumber: 'R-1',
  deviceId: 'd1',
  lines: [],
  tenders: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  committedAtMillis: 1_000,
  cashierId: 'u1',
  cashierName: 'Ada',
  stockShortfall: [],
  ...over,
});

const statLine = (over) => ({
  productId: 'p1',
  name: 'Tea',
  sku: '',
  barcode: '',
  unitPrice: 5,
  quantity: 1,
  selectedSize: null,
  selectedColor: null,
  lineDiscount: 0,
  lineTotal: 5,
  ...over,
});

const statProduct = (over) => ({
  id: 'p1',
  name: 'Tea',
  nameLower: 'tea',
  price: 5,
  sku: '',
  barcode: '',
  category: 'Drinks',
  sizes: [],
  stock: { _default: 4 },
  isActive: true,
  imageUrl: '',
  description: '',
  tracksLots: false,
  costPrice: 2,
  createdAtMillis: 0,
  updatedAtMillis: 0,
  ...over,
});

check('a range starts at the till local midnight, and All at the epoch', () => {
  const noon = new Date(2026, 0, 15, 12, 0, 0).getTime();
  const midnight = new Date(2026, 0, 15, 0, 0, 0).getTime();
  assert.equal(rangeStart('today', noon), midnight);
  assert.equal(rangeStart('week', noon), midnight - 6 * 86_400_000);
  assert.equal(rangeStart('month', noon), midnight - 29 * 86_400_000);
  assert.equal(rangeStart('all', noon), 0, 'All time reaches every sale ever rung');
});

check('one product on two lines of one receipt counts as one sale', () => {
  // Two sizes of the same shirt. Counting it twice would quietly turn "sold on
  // 40 sales" into "sold on 40 lines" and stop it matching the receipts list.
  const rows = salesByProduct(
    [statSale({ lines: [statLine({ quantity: 2, lineTotal: 10 }), statLine({ quantity: 1, lineTotal: 5 })] })],
    0,
  );
  const p1 = rows.get('p1');
  assert.equal(p1.units, 3);
  assert.equal(p1.revenue, 15);
  assert.equal(p1.saleCount, 1, 'one receipt, however many lines it has');
});

check('sales outside the window are not counted at all', () => {
  const rows = salesByProduct([statSale({ committedAtMillis: 500 })], 1_000);
  assert.equal(rows.size, 0);
});

check('revenue is the line total, so a discount is already taken off', () => {
  const rows = salesByProduct(
    [statSale({ lines: [statLine({ unitPrice: 5, quantity: 2, lineDiscount: 3, lineTotal: 7 })] })],
    0,
  );
  assert.equal(rows.get('p1').revenue, 7, 'not quantity x unitPrice');
  assert.equal(rows.get('p1').discount, 3);
});

check('category figures follow the product, not the sale', () => {
  // The join that makes this page possible and also limits it: a sale line
  // records `productId` and nothing else, so re-filing a product moves its whole
  // history with it. Asserted rather than merely documented, because a future
  // change that keyed on something else would be a silent behaviour change.
  const sales = [statSale({ lines: [statLine({ quantity: 2, lineTotal: 10 })] })];
  const before = categoryTotals(sales, [statProduct()], 0);
  assert.equal(before.get('Drinks').unitsSold, 2);
  assert.equal(before.get('Drinks').revenue, 10);

  const after = categoryTotals(sales, [statProduct({ category: 'Snacks' })], 0);
  assert.equal(after.has('Drinks'), false, 'the old category keeps nothing');
  assert.equal(after.get('Snacks').unitsSold, 2, 'the history moved with the product');
});

check('a category holds its shelf value at the last cost paid', () => {
  const rows = categoryTotals([], [statProduct({ stock: { S: 3, M: 2 }, costPrice: 4 })], 0);
  assert.equal(rows.get('Drinks').unitsOnHand, 5);
  assert.equal(rows.get('Drinks').stockValueAtCost, 20);
});

check('units with no cost price are left out of profit, and counted', () => {
  // A shop that typed its catalogue in by hand has costPrice 0 everywhere, and
  // counting those at zero cost reports the whole takings as profit -- a number
  // an owner would act on.
  const sales = [
    statSale({ lines: [statLine({ productId: 'p1', quantity: 1, lineTotal: 5 })] }),
    statSale({ saleId: 's2', lines: [statLine({ productId: 'p2', quantity: 2, lineTotal: 20 })] }),
  ];
  const rows = categoryTotals(
    sales,
    [statProduct(), statProduct({ id: 'p2', costPrice: 0 })],
    0,
  );
  const drinks = rows.get('Drinks');
  assert.equal(drinks.grossProfit, 3, '5 charged less the 2 it cost, and nothing from p2');
  assert.equal(drinks.unitsWithoutCost, 2);
});

check('a sold product that has since been deleted joins no category', () => {
  const rows = categoryTotals([statSale({ lines: [statLine({ productId: 'gone' })] })], [statProduct()], 0);
  assert.equal(rows.get('Drinks').unitsSold, 0, 'never invented a category for it');
});

check('a supplier is credited only with what its own batches sold', () => {
  const lots = [
    { id: 'L1', productId: 'p1', supplierId: 'sup1', remainingQty: 4, unitCost: 2 },
    { id: 'L2', productId: 'p1', supplierId: 'sup2', remainingQty: 1, unitCost: 3 },
  ];
  const movements = [
    { kind: 'sale', lotId: 'L1', productId: 'p1', quantity: -6 },
    { kind: 'sale', lotId: 'L2', productId: 'p1', quantity: -9 },
    // The oversell row `saleStockMovements` writes when the lots could not cover
    // the line. It belongs to no batch, so it belongs to no supplier.
    { kind: 'sale', lotId: '', productId: 'p1', quantity: -5 },
    { kind: 'receipt', lotId: 'L1', productId: 'p1', quantity: 10 },
  ];
  const receipts = [
    {
      id: 'r1',
      supplierId: 'sup1',
      status: 'posted',
      totalCost: 20,
      receivedAtMillis: 100,
      lines: [{ productId: 'p1', productName: 'Tea', quantity: 10, unitCost: 2 }],
    },
  ];
  const totals = supplierTotals({ supplierId: 'sup1', receipts, lots, movements });
  assert.equal(totals.deliveries, 1);
  assert.equal(totals.spend, 20);
  assert.equal(totals.unitsReceived, 10);
  assert.equal(totals.unitsSoldFromLots, 6, 'not the other supplier, and not the oversell');
  assert.equal(totals.costOfUnitsSoldFromLots, 12);
  assert.equal(totals.unitsOnHandFromLots, 4);
  assert.equal(totals.products[0].unitsSoldFromLots, 6);
});

check('a draft delivery has not happened yet', () => {
  const receipts = [
    { id: 'r1', supplierId: 'sup1', status: 'draft', totalCost: 99, receivedAtMillis: 1, lines: [] },
  ];
  const totals = supplierTotals({ supplierId: 'sup1', receipts, lots: [], movements: [] });
  assert.equal(totals.deliveries, 0);
  assert.equal(totals.spend, 0, 'a storekeeper still scanning has not bought anything');
});

check('the unit cost shown is the last one paid, not an average', () => {
  const receipts = [
    {
      id: 'r1', supplierId: 'sup1', status: 'posted', totalCost: 10, receivedAtMillis: 100,
      lines: [{ productId: 'p1', productName: 'Tea', quantity: 5, unitCost: 2 }],
    },
    {
      id: 'r2', supplierId: 'sup1', status: 'posted', totalCost: 30, receivedAtMillis: 200,
      lines: [{ productId: 'p1', productName: 'Tea', quantity: 5, unitCost: 6 }],
    },
  ];
  const totals = supplierTotals({ supplierId: 'sup1', receipts, lots: [], movements: [] });
  assert.equal(totals.products[0].lastUnitCost, 6, 'what a reorder would be quoted');
  assert.equal(totals.products[0].unitsReceived, 10);
  assert.equal(totals.lastAtMillis, 200);
});

check('a product page lists one row per receipt, newest first', () => {
  const rows = productSaleRows(
    [
      statSale({ saleId: 'a', receiptNumber: 'R-1', committedAtMillis: 10, lines: [statLine({ quantity: 1, lineTotal: 5 })] }),
      statSale({ saleId: 'b', receiptNumber: 'R-2', committedAtMillis: 20, lines: [statLine({ quantity: 2, lineTotal: 10 }), statLine({ quantity: 1, lineTotal: 5 })] }),
      statSale({ saleId: 'c', receiptNumber: 'R-3', committedAtMillis: 30, lines: [statLine({ productId: 'other' })] }),
    ],
    'p1',
    0,
  );
  assert.deepEqual(rows.map((r) => r.receiptNumber), ['R-2', 'R-1']);
  assert.equal(rows[0].quantity, 3, 'both lines of R-2 on one row');
  assert.equal(rows[0].total, 15);
});

await Promise.all(pending);

if (failed) {
  console.error(`\n[check-standalone] ${failed} check(s) failed.`);
  process.exit(1);
}
console.log(`\n[check-standalone] ${passed} checks passed`);
