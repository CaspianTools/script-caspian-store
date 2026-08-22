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
 * directly, so the standalone local-storage mode is an implementation of it
 * rather than a second copy of the register. Introduced in v10.0.0 with the
 * cloud implementation only; the local one lands in v10.2.0.
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
}
