import type { Product } from '../../types';

/**
 * Where a register keeps its data.
 *
 * `'cloud'` writes through to Firestore, so stock, reporting and the admin
 * panel all stay in step. `'local'` keeps everything on the computer and
 * contacts nothing — no Firebase project required, but nothing shows up in the
 * online admin either, and backups become the shop's responsibility.
 *
 * The choice is per-device, not per-store: one shop can legitimately run a
 * cloud till at the counter and a local one at a market stall.
 */
export type PosStorageMode = 'cloud' | 'local';

/** A ticket line as the register holds it, before the server prices it. */
export interface PosSaleLine {
  productId: string;
  /** Display copy, held so the ticket renders without a second read. */
  name: string;
  /** Indicative only. The server re-reads the real price at commit. */
  unitPrice: number;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  lineDiscount?: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PosTenderInput {
  kind: 'cash' | 'card' | 'other';
  amount: number;
  tendered?: number;
  reference?: string;
}

export interface PosSaleDraft {
  saleId: string;
  deviceId: string;
  lines: PosSaleLine[];
  tenders: PosTenderInput[];
  promoCode?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  capturedAtMillis?: number;
  /**
   * A receipt number this device already spent from a leased block, and already
   * printed. Present only on a sale captured offline. The server derives the
   * number from its own lease document; the client never sends the string.
   */
  receipt?: { leaseId: string; ordinal: number };
  /** Who rang the sale, when somebody else is replaying it later. */
  capturedByUid?: string;
  capturedByName?: string;
  /** What the till told the customer, so divergence can be recorded on replay. */
  capturedTotal?: number;
  capturedSubtotal?: number;
}

export interface PosCommittedSale {
  orderId: string;
  receiptNumber: string;
  total: number;
  /** True when this exact sale had already been committed — a replay, not a new sale. */
  duplicate: boolean;
  /** Lines whose stock went negative. Empty on a healthy sale. */
  stockShortfall: Array<{
    productId: string;
    sizeKey: string;
    requested: number;
    available: number;
  }>;
  /**
   * True when the sale is held on this device awaiting sync rather than
   * confirmed by the server. The receipt still prints — the customer is
   * standing there — but the register shows a pending indicator.
   */
  pending?: boolean;
}

/**
 * The single seam between the register UI and wherever its data lives.
 *
 * Every screen is written against this interface and never against Firestore
 * directly, so a standalone local-storage mode would be an implementation of it
 * rather than a second copy of the register. Introduced in v10.0.0 with the
 * cloud implementation, which is still the only one that ships.
 */
export interface PosStorageAdapter {
  readonly mode: PosStorageMode;

  /** Resolve a scanned barcode / SKU / product id. `null` when nothing matches. */
  lookupByCode(code: string): Promise<{ matchedBy: 'barcode' | 'sku' | 'id'; products: Product[] } | null>;

  /** Free-text search for the browse pane. */
  searchProducts(term: string): Promise<Product[]>;

  /**
   * Commit a sale. Implementations MUST be idempotent on `saleId`: committing
   * the same draft twice yields one sale and reports the second as a duplicate.
   */
  commitSale(draft: PosSaleDraft): Promise<PosCommittedSale>;

  /**
   * Did this sale already land? Answers the one question the register cannot
   * guess after a failed commit: a lost response and a rejected call look
   * identical from the client, and the two safe reactions are opposite.
   * Reusing the sale id when the sale did NOT land is fine; reusing it when it
   * DID land silently discards anything scanned since. Minting a fresh id has
   * the mirror-image failure, and that one double-charges a customer.
   *
   * Resolves `null` when the sale is definitively absent, and rejects when the
   * answer could not be obtained — callers must treat those differently.
   */
  findCommittedSale(saleId: string): Promise<PosCommittedSale | null>;

  /**
   * Present only on an adapter that can hold sales on the device. Optional
   * because this interface is publicly exported — requiring it would break
   * every consumer that wrote their own adapter.
   */
  readonly queue?: unknown;
}
