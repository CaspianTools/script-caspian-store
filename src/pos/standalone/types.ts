/**
 * The shapes a standalone till keeps on its own disk.
 *
 * Everything here is authoritative. On a cloud register these records are
 * projections of Firestore documents and can be rebuilt at will; on a
 * standalone till there is no Firestore, no admin panel elsewhere, and no
 * second copy — this IS the shop's catalogue, staff list and trading history.
 */

/**
 * Who may reach which part of a standalone till.
 *
 * Deliberately NOT the cloud `UserRole`. That type is mirrored into Firebase
 * Auth custom claims and named directly in `firestore.rules`, so widening it
 * would ripple into rules that a standalone till never evaluates. The two
 * models answer different questions and are kept apart on purpose.
 *
 *   - `staff`      — the counter. Sell, print, reprint. Nothing else.
 *   - `admin`      — the shop owner: catalogue, prices, reports, backups.
 *   - `superadmin` — Technical Support, who commissions the machine, creates
 *                    the shop's accounts and assigns their roles.
 */
export type PosLocalRole = 'superadmin' | 'admin' | 'staff';

export const POS_LOCAL_ROLES: readonly PosLocalRole[] = ['staff', 'admin', 'superadmin'] as const;

/** The parts of the software a role can be granted. */
export type PosLocalArea = 'register' | 'admin' | 'support';

const AREAS_BY_ROLE: Record<PosLocalRole, readonly PosLocalArea[]> = {
  staff: ['register'],
  admin: ['register', 'admin'],
  superadmin: ['register', 'admin', 'support'],
};

/**
 * Whether a role may open an area.
 *
 * Cumulative rather than exclusive: an owner who has to sign out and back in as
 * somebody else to serve a customer will simply share the cashier's password
 * instead, and then the sales attribution is a fiction. Access widens with
 * rank; it never trades one area for another.
 */
export function canAccess(role: PosLocalRole | null | undefined, area: PosLocalArea): boolean {
  if (!role) return false;
  return AREAS_BY_ROLE[role]?.includes(area) ?? false;
}

export interface LocalUser {
  id: string;
  /** What the person types to sign in. Lowercased, unique, never re-used. */
  username: string;
  displayName: string;
  role: PosLocalRole;
  /** PBKDF2-SHA-256 output, base64. Never the password itself. */
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAtMillis: number;
  /**
   * A disabled account keeps its sales attribution but cannot sign in. Staff
   * are disabled rather than deleted so last month's receipts still name the
   * person who rang them.
   */
  disabled?: boolean;
}

/**
 * A product as a standalone shop edits it.
 *
 * Flatter than the cloud `Product` — no slug, no taxonomies, no colour
 * variants, no rich text. A till needs a name, a price, something to scan and
 * a stock count; the rest is storefront furniture that a shop with no
 * storefront has nowhere to show.
 */
export interface LocalProduct {
  id: string;
  name: string;
  /** Lowercased name, so search does not scan-and-lowercase every row. */
  nameLower: string;
  price: number;
  sku: string;
  barcode: string;
  category: string;
  sizes: string[];
  stock: Record<string, number>;
  isActive: boolean;
  imageUrl: string;
  createdAtMillis: number;
  updatedAtMillis: number;
}

/** One priced line on a committed local sale. */
export interface LocalSaleLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  /** The price actually charged, resolved at commit and then frozen. */
  unitPrice: number;
  quantity: number;
  selectedSize: string | null;
  selectedColor: string | null;
  lineDiscount: number;
  lineTotal: number;
}

/**
 * A completed sale. The local equivalent of an `orders` document.
 *
 * Written once and never edited: a correction is another sale, not a rewrite of
 * this one. That is what makes the receipt a shop hands a customer match the
 * record a tax inspector later reads.
 */
export interface LocalSale {
  saleId: string;
  receiptNumber: string;
  deviceId: string;
  lines: LocalSaleLine[];
  tenders: Array<{ kind: 'cash' | 'card' | 'other'; amount: number; tendered?: number; reference?: string }>;
  subtotal: number;
  discount: number;
  total: number;
  promoCode: string | null;
  committedAtMillis: number;
  cashierId: string;
  cashierName: string;
  /** Lines whose stock went negative. Recorded, never blocking. */
  stockShortfall: Array<{ productId: string; sizeKey: string; requested: number; available: number }>;
}

/** Shop-wide settings on a standalone till. The local twin of `SiteSettings.pos`. */
export interface LocalShopSettings {
  shopName: string;
  currency: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptPrefix: string;
  roundCashTo: number;
  showTaxOnReceipt: boolean;
  /** Set once, by Technical Support, when the machine is commissioned. */
  commissionedAtMillis: number;
}

export const DEFAULT_LOCAL_SHOP_SETTINGS: LocalShopSettings = {
  shopName: '',
  currency: 'USD',
  receiptHeader: '',
  receiptFooter: '',
  receiptPrefix: 'R',
  roundCashTo: 0,
  showTaxOnReceipt: false,
  commissionedAtMillis: 0,
};
