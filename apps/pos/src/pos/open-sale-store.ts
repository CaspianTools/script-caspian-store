/**
 * The sale a cashier is in the middle of, on disk.
 *
 * Until this existed the open ticket was a `useState` inside `PosRegister`, and
 * `PosRoot` swaps that component out for every `/pos/**` screen — so a cashier
 * who touched Settings mid-sale lost the ticket, and a reload or a power cut
 * lost it with no trace. Everything downstream of the tender was durable; the
 * two minutes before it were the only part of a sale held nowhere.
 *
 * Uses the `openTicket` store, which has existed since version 2 of the
 * database and was never written to. That is why this needs no `DB_VERSION`
 * bump: a till upgrading into this release already has the store.
 */

import {
  STORE_TICKET,
  idbDelete,
  idbGet,
  idbPut,
  posIdbAvailable,
  posTx,
} from './offline/pos-queue-db';
import type { PosSaleLine } from './storage/types';

/**
 * One till, one open sale.
 *
 * Not keyed by device or by cashier. A second tab of the register on the same
 * machine shares one `deviceId` and one drawer, so two keys would let the same
 * physical till hold two tickets that both believe they are the sale in
 * progress. The cashier fields below say whose it is; they do not partition it.
 */
export const OPEN_SALE_KEY = 'current';

export interface PersistedOpenSale {
  key: typeof OPEN_SALE_KEY;
  /**
   * Bumped on every write. A write whose revision is behind what is already on
   * disk is dropped rather than applied — two debounced writes can land out of
   * order, and the older one winning would silently undo a scan.
   */
  revision: number;
  lines: PosSaleLine[];
  /**
   * The idempotency token, held across a failed commit.
   *
   * The reason this is persisted and not just the lines: `PosStorageAdapter`
   * requires `commitSale` to be idempotent on `saleId`, so a retry after a
   * crash is one sale. Minting a fresh id on restore would double-charge a
   * customer whose first attempt actually landed.
   */
  saleId: string | null;
  cashierId: string;
  /** Frozen, so a resumed ticket names who rang it even after a shift change. */
  cashierName: string;
  deviceId: string;
  /** Which sign-in rang it. Compared by equality, never by time. */
  signInId: string | null;
  updatedAtMillis: number;
}

function usable(): boolean {
  return posIdbAvailable();
}

/**
 * The row as it stands, offerable or not.
 *
 * Returns a row with no lines as well, which `readOpenSale` filters out. The
 * caller needs the revision even from a row it will never show: seeding the
 * counter at 0 while disk sat at 40 made the guard below drop every write that
 * followed, and a ticket that silently stops being saved is the exact failure
 * this module exists to prevent.
 */
export async function peekOpenSale(): Promise<PersistedOpenSale | null> {
  if (!usable()) return null;
  const row = await posTx(STORE_TICKET, 'readonly', (tx) =>
    idbGet<PersistedOpenSale>(tx, STORE_TICKET, OPEN_SALE_KEY),
  );
  return row ?? null;
}

/** A sale worth offering back — a row with something actually on it. */
export async function readOpenSale(): Promise<PersistedOpenSale | null> {
  const row = await peekOpenSale();
  if (!row || !Array.isArray(row.lines) || row.lines.length === 0) return null;
  return row;
}

/**
 * Write the ticket, unless disk already holds a newer one.
 *
 * The read and the write share one transaction so the comparison cannot race a
 * concurrent writer in another tab.
 */
export async function writeOpenSale(record: PersistedOpenSale): Promise<void> {
  if (!usable()) return;
  await posTx(STORE_TICKET, 'readwrite', async (tx) => {
    const existing = await idbGet<PersistedOpenSale>(tx, STORE_TICKET, OPEN_SALE_KEY);
    if (existing && existing.revision > record.revision) return;
    await idbPut(tx, STORE_TICKET, record);
  });
}

export async function clearOpenSale(): Promise<void> {
  if (!usable()) return;
  await posTx(STORE_TICKET, 'readwrite', (tx) => idbDelete(tx, STORE_TICKET, OPEN_SALE_KEY));
}
