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
 * a `RoleDefinition` listing the capabilities it holds.
 */
export type PosLocalRole = string;

/** Built-in roles that ship with every till. */
export const POS_LOCAL_ROLES: readonly PosLocalRole[] = ['staff', 'admin', 'superadmin'] as const;

/**
 * The coarse areas a role used to be granted.
 *
 * @deprecated Superseded by `PosLocalCapability`. Kept because it is a public
 * export, and because role definitions stored before capabilities existed are
 * upgraded out of it by `capabilitiesFromAreas`. One of these six -- `reports`
 * -- was never enforced anywhere, which is how the built-in Accountant ended up
 * holding a role that reached no screen at all.
 */
export type PosLocalArea = 'register' | 'store' | 'admin' | 'reports' | 'settings' | 'support';

export const POS_LOCAL_AREAS: readonly PosLocalArea[] = [
  'register',
  'store',
  'admin',
  'reports',
  'settings',
  'support',
] as const;

/**
 * One thing a role may do.
 *
 * Two tiers per screen: `*.view` decides whether the page appears in the menu
 * and resolves as a route, and the capability beside it decides whether that
 * page's controls are offered. The split is the point -- it is what lets a shop
 * show someone the takings without also handing them the export, or the staff
 * list without the password resets.
 */
export type PosLocalCapability =
  | 'register'
  | 'store.view'
  | 'store.edit'
  | 'sales.view'
  | 'sales.export'
  | 'people.view'
  | 'people.edit'
  | 'settings.view'
  | 'settings.shop'
  | 'settings.backup'
  | 'appAdmin.view'
  | 'appAdmin.roles';

/** Every capability, grouped the way the sidebar groups the screens they open. */
export const CAPABILITY_GROUPS: ReadonlyArray<{
  group: 'counter' | 'shop' | 'system';
  capabilities: readonly PosLocalCapability[];
}> = [
  { group: 'counter', capabilities: ['register'] },
  {
    group: 'shop',
    capabilities: [
      'store.view',
      'store.edit',
      'sales.view',
      'sales.export',
      'people.view',
      'people.edit',
    ],
  },
  {
    group: 'system',
    capabilities: [
      'settings.view',
      'settings.shop',
      'settings.backup',
      'appAdmin.view',
      'appAdmin.roles',
    ],
  },
];

export const POS_LOCAL_CAPABILITIES: readonly PosLocalCapability[] = CAPABILITY_GROUPS.flatMap(
  (g) => g.capabilities,
);

/** A role definition managed from App Admin. */
export interface RoleDefinition {
  id: PosLocalRole;
  name: string;
  enabled: boolean;
  capabilities: readonly PosLocalCapability[];
  /**
   * @deprecated What this role was granted before capabilities existed. Read
   * once to upgrade a stored definition, then left alone.
   */
  areas?: readonly PosLocalArea[];
  /** True for built-in roles that cannot be deleted, only enabled/disabled. */
  builtIn?: boolean;
}

const MANAGER_CAPABILITIES: readonly PosLocalCapability[] = [
  'register',
  'store.view',
  'store.edit',
  'sales.view',
  'sales.export',
  'people.view',
  'people.edit',
  'settings.view',
  'settings.shop',
  'settings.backup',
];

/**
 * The roles every till ships with, in least-to-most privilege order.
 *
 * Order is load-bearing twice over: App Admin renders the list in this order,
 * and `enabledRoles[0]` is the role a new person defaults to, so the least
 * privileged entry must stay first.
 *
 * `cashier` duplicates `staff` exactly, and `admin` now duplicates `manager`.
 * Both duplications are deliberate. People can already have been given either
 * id, and dropping one takes the register away from everyone holding it; the
 * only thing that ever separated `admin` from `manager` was the old `settings`
 * area, and since the settings screen was never gated, holding it changed
 * nothing. Inventing a difference here would mean taking something away from
 * one of them. App Admin labels the spare so an owner is not choosing blind.
 *
 * Every role holds `settings.view` because `/pos/settings` was ungated before
 * capabilities existed -- a cashier could always set the theme, the scanner gap
 * and this device's name. Granting it to all keeps that true; an owner can now
 * take it away, which they never could before.
 */
export const BUILTIN_ROLES: RoleDefinition[] = [
  {
    id: 'staff',
    name: 'Cashier',
    enabled: true,
    capabilities: ['register', 'settings.view'],
    builtIn: true,
  },
  {
    id: 'cashier',
    name: 'Cashier',
    enabled: true,
    capabilities: ['register', 'settings.view'],
    builtIn: true,
  },
  {
    id: 'storekeeper',
    name: 'Storekeeper',
    enabled: true,
    capabilities: ['store.view', 'store.edit', 'settings.view'],
    builtIn: true,
  },
  {
    id: 'accountant',
    name: 'Accountant',
    enabled: true,
    capabilities: ['sales.view', 'sales.export', 'settings.view'],
    builtIn: true,
  },
  { id: 'manager', name: 'Manager', enabled: true, capabilities: MANAGER_CAPABILITIES, builtIn: true },
  { id: 'admin', name: 'Admin', enabled: true, capabilities: MANAGER_CAPABILITIES, builtIn: true },
  {
    id: 'superadmin',
    name: 'Support',
    enabled: true,
    capabilities: [...MANAGER_CAPABILITIES, 'appAdmin.view', 'appAdmin.roles'],
    builtIn: true,
  },
];

/**
 * What each old area becomes.
 *
 * `admin` fans out into the pieces the back office used to hold. It grants
 * `settings.view` too, because the shop and backup panels it used to contain
 * now live on the settings page -- without it a manager would hold
 * `settings.shop` and have nowhere to spend it.
 */
const CAPABILITIES_BY_AREA: Record<PosLocalArea, readonly PosLocalCapability[]> = {
  register: ['register'],
  store: ['store.view', 'store.edit'],
  admin: ['people.view', 'people.edit', 'settings.view', 'settings.shop', 'settings.backup'],
  reports: ['sales.view', 'sales.export'],
  settings: ['settings.view'],
  support: ['appAdmin.view', 'appAdmin.roles'],
};

/**
 * Upgrade a pre-capability role definition.
 *
 * Deliberately additive: it can only ever hand a role more than it had, so an
 * upgrade cannot lock anyone out of a till they were using yesterday. The
 * unconditional `settings.view` is the same promise -- that screen answered to
 * nobody before, so everybody keeps it.
 */
export function capabilitiesFromAreas(
  areas: readonly PosLocalArea[] | undefined,
): PosLocalCapability[] {
  const out = new Set<PosLocalCapability>(['settings.view']);
  for (const area of areas ?? []) {
    for (const capability of CAPABILITIES_BY_AREA[area] ?? []) out.add(capability);
  }
  return POS_LOCAL_CAPABILITIES.filter((c) => out.has(c));
}

/**
 * Fallback map used when no dynamic role definitions have been loaded yet.
 *
 * Derived from `BUILTIN_ROLES` rather than written out a second time, because
 * the hand-maintained copy this replaces had already drifted from it.
 */
const CAPABILITIES_BY_ROLE: Record<string, readonly PosLocalCapability[]> = Object.fromEntries(
  BUILTIN_ROLES.map((role) => [role.id, role.capabilities]),
);

/**
 * Whether a role holds a capability.
 *
 * Prefer the `can` from `usePosRoles()` in React components so it reads the
 * latest definitions from App Admin. This pure function is a safe synchronous
 * fallback for guards and utility code.
 */
export function can(
  role: PosLocalRole | null | undefined,
  capability: PosLocalCapability,
): boolean {
  if (!role) return false;
  return CAPABILITIES_BY_ROLE[role]?.includes(capability) ?? false;
}

/**
 * Whether a role may open an area.
 *
 * @deprecated Prefer `can`. Answers in terms of the old six areas by asking
 * about the capability that opens each one, so callers written against the
 * previous model keep getting the same answers.
 */
export function canAccess(role: PosLocalRole | null | undefined, area: PosLocalArea): boolean {
  const [view] = CAPABILITIES_BY_AREA[area] ?? [];
  return view ? can(role, view) : false;
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
