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
 * Built-in roles are still honoured for backwards compatibility, but the app
 * admin page can define custom roles too. A role is just a string id backed by
 * a `RoleDefinition` that lists the areas it may open.
 */
export type PosLocalRole = string;

/** Built-in roles that ship with every till. */
export const POS_LOCAL_ROLES: readonly PosLocalRole[] = ['staff', 'admin', 'superadmin'] as const;

/** The parts of the software a role can be granted. */
export type PosLocalArea = 'register' | 'store' | 'admin' | 'reports' | 'settings' | 'support';

export const POS_LOCAL_AREAS: readonly PosLocalArea[] = [
  'register',
  'store',
  'admin',
  'reports',
  'settings',
  'support',
] as const;

/** A role definition managed from App Admin. */
export interface RoleDefinition {
  id: PosLocalRole;
  name: string;
  enabled: boolean;
  areas: readonly PosLocalArea[];
  /** True for built-in roles that cannot be deleted, only enabled/disabled. */
  builtIn?: boolean;
}

/**
 * The roles every till ships with, in least-to-most privilege order.
 *
 * Order is load-bearing twice over: App Admin renders the list in this order,
 * and `enabledRoles[0]` is the role a new person defaults to, so the least
 * privileged entry must stay first.
 *
 * `cashier` duplicates `staff` exactly. Keeping both is deliberate — people can
 * already have been given either one, and dropping an id from this list takes
 * the register away from everyone holding it. App Admin labels the spare one so
 * an owner is not choosing between two identical rows.
 */
export const BUILTIN_ROLES: RoleDefinition[] = [
  { id: 'staff', name: 'Cashier', enabled: true, areas: ['register'], builtIn: true },
  { id: 'cashier', name: 'Cashier', enabled: true, areas: ['register'], builtIn: true },
  { id: 'storekeeper', name: 'Storekeeper', enabled: true, areas: ['store'], builtIn: true },
  { id: 'accountant', name: 'Accountant', enabled: true, areas: ['reports'], builtIn: true },
  { id: 'manager', name: 'Manager', enabled: true, areas: ['register', 'store', 'admin', 'reports'], builtIn: true },
  { id: 'admin', name: 'Admin', enabled: true, areas: ['register', 'store', 'admin', 'reports', 'settings'], builtIn: true },
  { id: 'superadmin', name: 'Support', enabled: true, areas: ['register', 'store', 'admin', 'reports', 'settings', 'support'], builtIn: true },
];

/** Fallback map used when no dynamic role definitions have been loaded yet. */
const AREAS_BY_ROLE: Record<string, readonly PosLocalArea[]> = {
  staff: ['register'],
  admin: ['register', 'store', 'admin', 'reports', 'settings'],
  superadmin: ['register', 'store', 'admin', 'reports', 'settings', 'support'],
  cashier: ['register'],
  storekeeper: ['store'],
  manager: ['register', 'store', 'admin', 'reports'],
  accountant: ['reports'],
};

/**
 * Whether a role may open an area.
 *
 * Prefer the `useCanAccess` hook in React components so it reads the latest
 * role definitions from App Admin. This pure function is a safe synchronous
 * fallback for guards and utility code.
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
