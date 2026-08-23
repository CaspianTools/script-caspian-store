import type { PosSaleDraft, PosTenderInput } from '../storage/types';

/**
 * Where a captured sale is in its life.
 *
 * `held` is the only state that means money has been taken but the server does
 * not know yet. Everything about the queue exists to move sales out of it.
 */
export type QueuedSaleState =
  /** Written to this device, not yet accepted by the server. */
  | 'held'
  /** A commit is in flight right now. */
  | 'sending'
  /** The server has it. Kept briefly so the cashier can see it landed. */
  | 'sent'
  /** Retried to exhaustion, or rejected permanently. Needs a person. */
  | 'blocked';

export interface QueuedSale {
  saleId: string;
  deviceId: string;
  /** Exactly what will be sent to `commitPosSale`. */
  draft: PosSaleDraft;
  /**
   * The number already printed on the customer's receipt, spent from a leased
   * block. Empty only when the till ran out of leased numbers and issued a
   * reference instead.
   */
  receiptNumber: string;
  /** Local reference shown when there was no leased number left. */
  localRef: string;
  /** What the till told the customer. The server re-prices; divergence is recorded. */
  capturedTotal: number;
  capturedSubtotal: number;
  capturedAtMillis: number;
  /** Who rang it, so a backlog drained by a manager is still attributed correctly. */
  capturedByUid: string;
  capturedByName: string;
  tenders: PosTenderInput[];
  state: QueuedSaleState;
  attempts: number;
  nextAttemptAtMillis: number;
  lastError?: string;
  lastErrorCode?: string;
  /** Set once the server has accepted it, for the reconcile view. */
  serverTotal?: number;
  serverReceiptNumber?: string;
}

/** A block of receipt numbers this device may spend while offline. */
export interface ReceiptLease {
  leaseId: string;
  prefix: string;
  from: number;
  to: number;
  size: number;
  /** Next unspent offset within the block. Spent transactionally with the sale. */
  nextOrdinal: number;
  expiresAtMillis: number;
}

/**
 * A product as the register needs it offline.
 *
 * Deliberately a projection rather than the raw document. `getPosCatalogDelta`
 * returns Firestore documents straight off the wire, where a `Timestamp` has
 * been flattened to `{_seconds,_nanoseconds}` — an object that is not a
 * `Timestamp` and will throw the moment anything calls `.toMillis()` on it.
 * Storing raw docs in IndexedDB would bake that landmine into the cache.
 */
export interface CachedProduct {
  id: string;
  name: string;
  price: number;
  sku: string;
  barcode: string;
  /** Lowercased name, so a search does not have to scan-and-lowercase every row. */
  nameLower: string;
  sizes: string[];
  stock: Record<string, number>;
  isActive: boolean;
  imageUrl: string;
  updatedAtMillis: number;
}

/** Cached shop settings, so an offline receipt still prints branded and rounds correctly. */
export interface PosBootCache {
  receiptHeader: string;
  receiptFooter: string;
  roundCashTo: number;
  receiptPrefix: string;
  currency: string;
  /** Whether the last known state permitted this device to open the register. */
  posEnabled: boolean;
  cachedAtMillis: number;
}

export interface QueueCounts {
  held: number;
  blocked: number;
  sending: number;
}
