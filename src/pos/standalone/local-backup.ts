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
  listLocalProducts,
  listLocalSales,
  listLocalUsers,
  peekLocalReceiptCounter,
  readLocalShopSettings,
  saveLocalProducts,
  saveLocalUser,
  writeLocalShopSettings,
} from './local-db';
import {
  STORE_LOCAL_COUNTERS,
  STORE_LOCAL_SALES,
  idbGet,
  idbPut,
  posTx,
} from '../offline/pos-queue-db';
import type { LocalProduct, LocalSale, LocalShopSettings, LocalUser } from './types';

/** Bumped only when the shape changes in a way an older reader cannot handle. */
export const LOCAL_BACKUP_VERSION = 1;

export interface LocalBackup {
  format: 'caspian-standalone-till';
  version: number;
  createdAtMillis: number;
  shop: LocalShopSettings;
  receiptCounter: number;
  products: LocalProduct[];
  users: LocalUser[];
  sales: LocalSale[];
}

export async function buildLocalBackup(): Promise<LocalBackup> {
  const [shop, receiptCounter, products, users, sales] = await Promise.all([
    readLocalShopSettings(),
    peekLocalReceiptCounter(),
    listLocalProducts(),
    listLocalUsers(),
    listLocalSales(),
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
}

/**
 * Merge a backup back in.
 *
 * Additive by design, and sales are never overwritten: a sale already on this
 * till is the real one, and a restore that clobbered it with an older copy
 * would rewrite history that a receipt in a customer's hand still refers to.
 * The receipt counter only ever moves forward, for the same reason — winding it
 * back would reissue numbers that have already been printed.
 */
export async function restoreLocalBackup(backup: LocalBackup): Promise<RestoreResult> {
  await saveLocalProducts(backup.products);
  for (const user of backup.users) await saveLocalUser(user);
  await writeLocalShopSettings(backup.shop);

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
  };
}

/**
 * Hand the file to the browser.
 *
 * Object-URL rather than a `data:` URI because a busy till's backup runs to
 * megabytes and long `data:` URLs are truncated by some browsers — silently,
 * which for a backup is the worst possible failure. The desktop shell replaces
 * this with a real filesystem write so a shop gets a file in a folder it chose
 * rather than one in Downloads.
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
