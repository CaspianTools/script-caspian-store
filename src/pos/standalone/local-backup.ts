/**
 * Backup and restore for a standalone till.
 *
 * A standalone till keeps a shop's entire trading history in one browser
 * profile on one computer. Nothing is in the cloud — that is the whole point of
 * the mode — but it also means a failed disk takes the lot. So the backup is
 * not an optional convenience here; it is the only copy a shop will ever have,
 * and the UI says so in those words.
 *
 * The file is JSON rather than CSV because a backup has to restore the till
 * exactly: sales, staff, the receipt counter and the shop record, not just the
 * catalogue. CSV is for the catalogue alone, where a shop wants to edit it in a
 * spreadsheet.
 */

import {
  listAllLocalLots,
  listLocalCategories,
  listLocalOpeningCash,
  listLocalProducts,
  listLocalSales,
  listLocalStockReceipts,
  listLocalSuppliers,
  listLocalUsers,
  peekLocalReceiptCounter,
  readLocalRoles,
  readLocalShopSettings,
  saveLocalCategory,
  saveLocalProducts,
  saveLocalSupplier,
  saveLocalUser,
  writeLocalRoles,
  writeLocalShopSettings,
} from './local-db';
import { listLocalShifts } from './local-shifts';
import { listLocalTerminals } from './local-terminals';
import {
  STORE_LOCAL_COUNTERS,
  STORE_LOCAL_LOTS,
  STORE_LOCAL_MOVEMENTS,
  STORE_LOCAL_OPENING_CASH,
  STORE_LOCAL_RECEIPTS,
  STORE_LOCAL_SALES,
  STORE_LOCAL_SHIFTS,
  STORE_LOCAL_TERMINALS,
  idbGet,
  idbGetAll,
  idbPut,
  posTx,
} from '../offline/pos-queue-db';
import type {
  LocalCategory,
  LocalOpeningCash,
  LocalProduct,
  LocalSale,
  LocalShift,
  LocalShopSettings,
  LocalStockLot,
  LocalStockMovement,
  LocalStockReceipt,
  LocalSupplier,
  LocalTerminal,
  LocalUser,
  RoleDefinition,
} from './types';

/**
 * Bumped only when the shape changes in a way an older reader cannot handle.
 *
 * v2 added `roles`. A v1 file restores fine — it simply has no custom roles to
 * put back — but a v2 file is refused by a v1 reader, which is the right way
 * round: the alternative is an old build silently discarding a shop's roles.
 *
 * v3 added `openingCash`. A v2 file restores fine — it simply has no drawer
 * counts to put back — but a v3 file is refused by a v2 reader, which is the
 * right way round for the same reason: those declarations are the only record
 * of what a cashier said was in the drawer, and an old build dropping them
 * loses them for good.
 *
 * v4 added the stock records — lots, the movement ledger, deliveries — and the
 * category and supplier lists. Same rule again: a v3 file restores fine and
 * simply has no stock history to put back, and a v4 file is refused by a v3
 * reader rather than being read with the new half quietly dropped.
 *
 * v5 added the counters the shop named and the shifts worked at them. Same rule
 * a fourth time: a v4 file restores fine and simply has no roster to put back,
 * and a v5 file is refused by a v4 reader rather than being read with the
 * drawer counts silently dropped. Losing a closed shift loses the only record
 * of what a cashier counted and what it came to against expectation.
 */
export const LOCAL_BACKUP_VERSION = 5;

export interface LocalBackup {
  format: 'caspian-standalone-till';
  version: number;
  createdAtMillis: number;
  shop: LocalShopSettings;
  receiptCounter: number;
  products: LocalProduct[];
  users: LocalUser[];
  sales: LocalSale[];
  /**
   * Custom role definitions. Absent in a v1 file.
   *
   * These were missing from the backup entirely until v12.0.0, which meant a
   * shop that had customised who may open which screen got the built-in roles
   * back on a replacement machine, with nothing saying so. On a till whose only
   * copy of everything is this file, an omission is a silent loss.
   */
  roles?: RoleDefinition[];
  /**
   * What cashiers declared was in the drawer. Absent in a v1 or v2 file.
   *
   * Carried for the same reason `roles` is: these rows exist on this machine
   * and nowhere else, and a shop that restores onto a replacement till and
   * finds its drawer history gone has lost it silently.
   */
  openingCash?: LocalOpeningCash[];
  /**
   * What the shop bought and what became of it. Absent before v4.
   *
   * `lots` is the one that would hurt most to lose: for a lot-tracked product
   * it is what `LocalProduct.stock` is a projection of, so a restore without it
   * would put the shelf back with no idea what expires when.
   */
  lots?: LocalStockLot[];
  movements?: LocalStockMovement[];
  stockReceipts?: LocalStockReceipt[];
  categories?: LocalCategory[];
  suppliers?: LocalSupplier[];
  /**
   * The counters the shop has named. Absent before v5.
   *
   * This is the roster's only way between two standalone tills -- there is no
   * wire between them -- so it is carried deliberately, pairing-code hashes and
   * all. Carrying those hashes is correct rather than a leak, for the reason the
   * recovery hash is carried: fifty bits behind PBKDF2 is not grindable the way
   * a six-character password is, and a shop restoring onto a replacement machine
   * should find the codes it wrote down still work.
   *
   * `claimedByDeviceId` is deliberately NOT put back -- see `restoreLocalBackup`.
   */
  terminals?: LocalTerminal[];
  /** Shifts worked at those counters, open and closed. Absent before v5. */
  shifts?: LocalShift[];
}

/** Read whole, because the backup is the one place that wants every row. */
async function listAllMovements(): Promise<LocalStockMovement[]> {
  return posTx(STORE_LOCAL_MOVEMENTS, 'readonly', (tx) =>
    idbGetAll<LocalStockMovement>(tx, STORE_LOCAL_MOVEMENTS),
  );
}

export async function buildLocalBackup(): Promise<LocalBackup> {
  const [
    shop,
    receiptCounter,
    products,
    users,
    sales,
    roles,
    openingCash,
    lots,
    movements,
    stockReceipts,
    categories,
    suppliers,
    terminals,
    shifts,
  ] = await Promise.all([
    readLocalShopSettings(),
    peekLocalReceiptCounter(),
    listLocalProducts(),
    listLocalUsers(),
    listLocalSales(),
    readLocalRoles(),
    listLocalOpeningCash(),
    listAllLocalLots(),
    listAllMovements(),
    // Every delivery, not the screen's hundred: this file is the only copy.
    listLocalStockReceipts(Number.MAX_SAFE_INTEGER),
    listLocalCategories(),
    listLocalSuppliers(),
    listLocalTerminals(),
    listLocalShifts(),
  ]);
  return {
    format: 'caspian-standalone-till',
    version: LOCAL_BACKUP_VERSION,
    createdAtMillis: Date.now(),
    shop,
    receiptCounter,
    products,
    users,
    sales,
    roles,
    openingCash,
    lots,
    movements,
    stockReceipts,
    categories,
    suppliers,
    terminals,
    shifts,
  };
}

/** A dated, sortable filename. A shop ends up with a folder of these. */
export function localBackupFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `caspian-till-${stamp}.json`;
}

export function parseLocalBackup(text: string): LocalBackup | null {
  try {
    const parsed = JSON.parse(text) as Partial<LocalBackup>;
    if (parsed?.format !== 'caspian-standalone-till') return null;
    if (typeof parsed.version !== 'number' || parsed.version > LOCAL_BACKUP_VERSION) return null;
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.users)) return null;
    // `sales` was validated nowhere, and `restoreLocalBackup` iterates it — a
    // string would have been walked character by character, a number thrown.
    if (parsed.sales != null && !Array.isArray(parsed.sales)) return null;
    if (parsed.roles != null && !Array.isArray(parsed.roles)) return null;
    if (parsed.openingCash != null && !Array.isArray(parsed.openingCash)) return null;
    for (const rows of [
      parsed.lots,
      parsed.movements,
      parsed.stockReceipts,
      parsed.categories,
      parsed.suppliers,
    ]) {
      if (rows != null && !Array.isArray(rows)) return null;
    }
    return parsed as LocalBackup;
  } catch {
    return null;
  }
}

export interface RestoreResult {
  products: number;
  users: number;
  sales: number;
  /** Sales already on this till and therefore left alone. */
  salesSkipped: number;
  /** Custom roles put back. Zero for a v1 file, which carried none. */
  roles: number;
  /** Drawer declarations put back. Zero for a v1 or v2 file, which carried none. */
  openingCash: number;
  /** Stock records put back. Zero for anything older than v4. */
  lots: number;
  /**
   * Batched products whose shelf figure had to be rebuilt from their batches.
   *
   * Normally zero. It is not zero when the two halves of the restore disagreed
   * -- see `reconcileLotProjection`.
   */
  reconciled: number;
  movements: number;
  stockReceipts: number;
  categories: number;
  suppliers: number;
  /** Counters put back. Zero for anything older than v5. */
  terminals: number;
  /** Shifts put back. Zero for anything older than v5. */
  shifts: number;
}

/**
 * Merge a backup back in.
 *
 * Additive by design, and sales are never overwritten: a sale already on this
 * till is the real one, and a restore that clobbered it with an older copy
 * would rewrite history that a receipt in a customer's hand still refers to.
 * Drawer declarations follow the same rule for the same reason — both are
 * append-only records of something a person did at a counter. The receipt
 * counter only ever moves forward too: winding it back would reissue numbers
 * that have already been printed.
 */
export async function restoreLocalBackup(backup: LocalBackup): Promise<RestoreResult> {
  await saveLocalProducts(backup.products);
  for (const user of backup.users) await saveLocalUser(user);
  await writeLocalShopSettings(backup.shop);
  if (backup.roles?.length) await writeLocalRoles(backup.roles);

  let restored = 0;
  let skipped = 0;
  for (const sale of backup.sales ?? []) {
    // eslint-disable-next-line no-await-in-loop
    const wrote = await posTx(STORE_LOCAL_SALES, 'readwrite', async (tx) => {
      const existing = await idbGet<LocalSale>(tx, STORE_LOCAL_SALES, sale.saleId);
      if (existing) return false;
      await idbPut(tx, STORE_LOCAL_SALES, sale);
      return true;
    });
    if (wrote) restored++;
    else skipped++;
  }

  let openingCashRestored = 0;
  for (const row of backup.openingCash ?? []) {
    // eslint-disable-next-line no-await-in-loop
    const wrote = await posTx(STORE_LOCAL_OPENING_CASH, 'readwrite', async (tx) => {
      const existing = await idbGet<LocalOpeningCash>(tx, STORE_LOCAL_OPENING_CASH, row.id);
      if (existing) return false;
      await idbPut(tx, STORE_LOCAL_OPENING_CASH, row);
      return true;
    });
    if (wrote) openingCashRestored++;
  }

  // Append-only, like sales, and skipped rather than overwritten for the same
  // reason: a lot on this till has been sold out of since the backup was taken,
  // and putting the older copy back would refill a shelf that is empty.
  const lots = await restoreAppendOnly(STORE_LOCAL_LOTS, backup.lots ?? []);
  const movements = await restoreAppendOnly(STORE_LOCAL_MOVEMENTS, backup.movements ?? []);
  const stockReceipts = await restoreAppendOnly(STORE_LOCAL_RECEIPTS, backup.stockReceipts ?? []);

  // Vocabularies, not records of anything that happened, so these upsert.
  for (const category of backup.categories ?? []) await saveLocalCategory(category);
  for (const supplier of backup.suppliers ?? []) await saveLocalSupplier(supplier);

  // The roster upserts like a vocabulary, but with the claim stripped. The
  // machine doing the restoring is a different machine -- or the same one with
  // its storage wiped, which mints a fresh device id and comes to the same
  // thing -- so the claim in the file is about a device that is not this one.
  // Putting it back would leave this till believing a counter was already taken
  // and refusing to pair with it, or believing it already held one it had never
  // been paired to. Clearing it costs somebody typing a code they have written
  // down; keeping it costs two tills answering to one counter.
  let terminalsRestored = 0;
  for (const terminal of backup.terminals ?? []) {
    const { claimedAtMillis: _dropped, ...rest } = terminal;
    // eslint-disable-next-line no-await-in-loop
    await posTx(STORE_LOCAL_TERMINALS, 'readwrite', (tx) =>
      idbPut(tx, STORE_LOCAL_TERMINALS, { ...rest, claimedByDeviceId: '' }),
    );
    terminalsRestored++;
  }

  // Append-only, like sales and drawer declarations, and for the same reason: a
  // shift is a record of what somebody counted, and an older copy must not
  // overwrite a closed one already on this machine.
  let shiftsRestored = 0;
  for (const shift of backup.shifts ?? []) {
    // eslint-disable-next-line no-await-in-loop
    const wrote = await posTx(STORE_LOCAL_SHIFTS, 'readwrite', async (tx) => {
      const existing = await idbGet<LocalShift>(tx, STORE_LOCAL_SHIFTS, shift.id);
      if (existing) return false;
      await idbPut(tx, STORE_LOCAL_SHIFTS, shift);
      return true;
    });
    if (wrote) shiftsRestored++;
  }

  // Last, once both halves are in: the products came back wholesale and the
  // batches came back append-only, and those two rules disagree the moment
  // this till has traded since the backup was taken.
  const reconciled = await reconcileLotProjection();

  await posTx(STORE_LOCAL_COUNTERS, 'readwrite', async (tx) => {
    const current = await idbGet<{ key: string; value: number }>(tx, STORE_LOCAL_COUNTERS, 'receipt');
    const next = Math.max(current?.value ?? 0, backup.receiptCounter ?? 0);
    await idbPut(tx, STORE_LOCAL_COUNTERS, { key: 'receipt', value: next });
  });

  return {
    products: backup.products.length,
    users: backup.users.length,
    sales: restored,
    salesSkipped: skipped,
    roles: backup.roles?.length ?? 0,
    openingCash: openingCashRestored,
    lots,
    movements,
    stockReceipts,
    categories: backup.categories?.length ?? 0,
    suppliers: backup.suppliers?.length ?? 0,
    terminals: terminalsRestored,
    shifts: shiftsRestored,
    reconciled,
  };
}

/**
 * Rebuild every batched product's shelf figure from its batches.
 *
 * A restore writes products wholesale -- `saveLocalProducts` is a bare put, so
 * the backup's `stock` replaces whatever is here -- while batches are put back
 * append-only, skipping any this till already has. Those two rules disagree the
 * moment a till has traded since the backup was taken: the shelf goes back to
 * the older figure while the batches keep the newer remainders, and for a
 * batched product the shelf is supposed to BE the sum of the batches.
 *
 * The batches win, because they are the append-only record and the shelf figure
 * is a projection of them. Only batched products are touched; one that does not
 * track batches has no second opinion to reconcile against and keeps exactly
 * what the backup said.
 */
async function reconcileLotProjection(): Promise<number> {
  const [products, lots] = await Promise.all([listLocalProducts(), listAllLocalLots()]);
  const tracked = products.filter((p) => p.tracksLots);
  if (!tracked.length) return 0;

  const bySize = new Map<string, Record<string, number>>();
  for (const lot of lots) {
    const forProduct = bySize.get(lot.productId) ?? {};
    forProduct[lot.sizeKey] = (forProduct[lot.sizeKey] ?? 0) + Math.max(0, lot.remainingQty);
    bySize.set(lot.productId, forProduct);
  }

  const repaired: LocalProduct[] = [];
  for (const product of tracked) {
    const wanted = bySize.get(product.id) ?? {};
    const same =
      Object.keys(wanted).length === Object.keys(product.stock).length &&
      Object.entries(wanted).every(([size, qty]) => product.stock[size] === qty);
    if (!same) repaired.push({ ...product, stock: wanted });
  }
  if (repaired.length) await saveLocalProducts(repaired);
  return repaired.length;
}

/**
 * Put rows back without ever overwriting one this till already has.
 *
 * The rule sales and drawer counts already follow, applied to the three stock
 * stores that are records of something that happened rather than lists somebody
 * maintains.
 */
async function restoreAppendOnly(
  store: typeof STORE_LOCAL_LOTS | typeof STORE_LOCAL_MOVEMENTS | typeof STORE_LOCAL_RECEIPTS,
  rows: readonly { id: string }[],
): Promise<number> {
  let written = 0;
  for (const row of rows) {
    const wrote = await posTx(store, 'readwrite', async (tx) => {
      const existing = await idbGet<{ id: string }>(tx, store, row.id);
      if (existing) return false;
      await idbPut(tx, store, row);
      return true;
    });
    if (wrote) written++;
  }
  return written;
}

/**
 * Hand the file to the browser.
 *
 * Object-URL rather than a `data:` URI because a busy till's backup runs to
 * megabytes and long `data:` URLs are truncated by some browsers — silently,
 * which for a backup is the worst possible failure. The browser decides where
 * the file lands; a shop that wants it somewhere specific sets its download
 * folder, or moves the file afterwards.
 */
export function saveTextFile(filename: string, text: string, mime = 'application/json'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoked on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has actually started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
