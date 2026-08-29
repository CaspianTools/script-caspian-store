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
  | 'stock.receive'
  | 'sales.view'
  | 'sales.export'
  | 'sales.refund'
  | 'people.view'
  | 'people.edit'
  | 'settings.view'
  | 'settings.shop'
  | 'settings.backup'
  | 'appAdmin.view'
  | 'appAdmin.roles'
  | 'terminals.edit';

/** Every capability, grouped the way the sidebar groups the screens they open. */
export const CAPABILITY_GROUPS: ReadonlyArray<{
  group: 'counter' | 'shop' | 'system';
  capabilities: readonly PosLocalCapability[];
}> = [
  { group: 'counter', capabilities: ['register', 'sales.refund'] },
  {
    group: 'shop',
    capabilities: [
      'store.view',
      'store.edit',
      'stock.receive',
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
      'terminals.edit',
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
  'stock.receive',
  'sales.view',
  'sales.export',
  'sales.refund',
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
    // Not "Cashier". The People screen renders `RoleDefinition.name` straight
    // into its picker, so two rows both called Cashier gave an owner two
    // identical options with nothing to choose between -- only App admin, which
    // uses the i18n label, could tell them apart.
    name: 'Cashier (old)',
    enabled: true,
    capabilities: ['register', 'settings.view'],
    builtIn: true,
  },
  {
    id: 'storekeeper',
    name: 'Storekeeper',
    enabled: true,
    capabilities: ['store.view', 'store.edit', 'stock.receive', 'settings.view'],
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
    capabilities: [...MANAGER_CAPABILITIES, 'appAdmin.view', 'appAdmin.roles', 'terminals.edit'],
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
  store: ['store.view', 'store.edit', 'stock.receive'],
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
  /**
   * The category NAME, not an id.
   *
   * `localCategories` is a managed vocabulary that fills a picker, not a
   * foreign-key table: keeping the name here is what lets the CSV, the backup
   * and `toProduct` stay exactly as they were, and what lets a shop with the
   * Categories screen switched off go on typing whatever it likes. Renaming a
   * category rewrites the products carrying it.
   */
  category: string;
  sizes: string[];
  /**
   * On hand, per size key (`_default` for an item with no sizes).
   *
   * For a product with `tracksLots`, this is a PROJECTION of the remaining
   * quantities in `localStockLots`, rewritten by whichever transaction moved
   * them. It stays the field every reader reads -- the register tile, the
   * receipt, `toProduct`, the CSV -- so lots did not have to ripple outwards.
   */
  stock: Record<string, number>;
  isActive: boolean;
  imageUrl: string;
  /** Shown on the product page. Free text; the till renders it as-is. */
  description: string;
  /**
   * Whether this item is received in lots with codes and expiry dates, and sold
   * first-expiry-first-out.
   *
   * Per product, not per shop: one counter sells both yoghurt and tote bags,
   * and nobody wants to type an expiry date for a tote bag. A product with this
   * off follows exactly the path it followed before lots existed.
   */
  tracksLots: boolean;
  /** What the last delivery of this item cost per unit. Restamped on receipt. */
  costPrice: number;
  createdAtMillis: number;
  updatedAtMillis: number;
}

/**
 * A batch of one product, as it arrived.
 *
 * The unit a shop actually buys in: forty yoghurts off one delivery, with one
 * expiry date between them. Authoritative for a product that tracks lots --
 * `LocalProduct.stock` is kept in step with the sum of `remainingQty` here, and
 * a sale draws the earliest expiry down first.
 *
 * Never deleted once it has been received. A lot that runs out sits at
 * `remainingQty: 0` and stays, because it is the record of what was on the
 * shelf when a customer bought it.
 */
export interface LocalStockLot {
  id: string;
  productId: string;
  /** Which size bucket this lot feeds. `_default` for an item with no sizes. */
  sizeKey: string;
  /** What the shop calls the batch. Blank is allowed; the code is for humans. */
  lotCode: string;
  /**
   * `YYYY-MM-DD`, local, or `''` for stock that does not expire.
   *
   * A date string rather than millis because an expiry is a calendar day, not
   * an instant: a yoghurt is out of date on the 4th wherever the till is
   * standing, and storing an instant would move that day for a shop that keeps
   * its clock on the wrong offset.
   */
  expiresOn: string;
  receivedQty: number;
  remainingQty: number;
  unitCost: number;
  supplierId: string;
  /** The delivery this lot came in on. */
  receiptId: string;
  receivedAtMillis: number;
  note: string;
}

/**
 * Why a quantity changed. Signed: positive put stock on the shelf.
 *
 * `sale` rows are written inside `commitLocalSale`'s own transaction, so the
 * ledger cannot disagree with the sale that caused it.
 */
export type LocalStockMovementKind = 'receipt' | 'sale' | 'return' | 'adjustment';

/**
 * Why someone changed a quantity by hand.
 *
 * `customer-return` is the one that is not an adjustment: it writes a `return`
 * movement, and it is one of the two things the product page's Returned figure
 * counts. The other is a receipt-linked refund, which since v2.0.0 puts the
 * stock back itself. This route stays for the return that has no receipt --
 * the customer who lost it, or a sale rung up before the till was installed --
 * and it is the route that moves stock WITHOUT moving money.
 */
export type LocalStockAdjustReason =
  | 'customer-return'
  | 'damaged'
  | 'count-correction'
  | 'expired'
  | 'other';

export const LOCAL_STOCK_ADJUST_REASONS: readonly LocalStockAdjustReason[] = [
  'customer-return',
  'damaged',
  'count-correction',
  'expired',
  'other',
] as const;

/**
 * One line of the stock ledger: what moved, when, why, and who did it.
 *
 * Append-only, like `LocalSale`. A mistake is corrected by another movement,
 * never by editing this one -- that is what makes the history add up to the
 * quantity on the shelf.
 */
export interface LocalStockMovement {
  /**
   * Deterministic for a sale (`sale:<saleId>:<lineIndex>`), random otherwise.
   *
   * That shape is what makes the one-time backfill of sales that predate this
   * store idempotent: running it twice overwrites the same rows rather than
   * doubling every product's sold figure.
   */
  id: string;
  productId: string;
  sizeKey: string;
  /** Which lot moved, or `''` for a product that does not track them. */
  lotId: string;
  kind: LocalStockMovementKind;
  /** Signed. Negative took stock off the shelf. */
  quantity: number;
  /** Set on `return` and `adjustment` rows only. */
  reason: LocalStockAdjustReason | '';
  /** A receipt number, a stock-receipt reference -- whatever names the cause. */
  reference: string;
  /** What a unit cost at the time, for a `receipt`; zero elsewhere. */
  unitCost: number;
  userId: string;
  /** Frozen, so a renamed or disabled account still names who did it. */
  userName: string;
  atMillis: number;
  note: string;
}

/** One line of a delivery as it is being entered. */
export interface LocalStockReceiptLine {
  productId: string;
  /** Frozen at entry, so a later rename does not rewrite what was delivered. */
  productName: string;
  sizeKey: string;
  quantity: number;
  unitCost: number;
  lotCode: string;
  expiresOn: string;
  note: string;
}

/**
 * A delivery: its supplier, its paperwork, and what was in it.
 *
 * Kept in `draft` while a storekeeper is still scanning -- the same posture as
 * the register's open ticket, and for the same reason: forty scans should
 * survive a dropped tab. `posted` is the point at which stock moved, and a
 * posted receipt is never edited.
 */
export interface LocalStockReceipt {
  id: string;
  /** The supplier's invoice or delivery-note number. Free text. */
  reference: string;
  supplierId: string;
  /** Frozen, so a deleted supplier still names who delivered. */
  supplierName: string;
  lines: LocalStockReceiptLine[];
  receivedAtMillis: number;
  userId: string;
  userName: string;
  note: string;
  totalCost: number;
  status: 'draft' | 'posted';
}

/**
 * One entry in the shop's category vocabulary.
 *
 * Optional: switched on per shop from App Admin. With it off, a product's
 * category is whatever someone typed, exactly as before.
 */
export interface LocalCategory {
  id: string;
  name: string;
  nameLower: string;
  sortOrder: number;
  createdAtMillis: number;
  updatedAtMillis: number;
}

/** Who the shop buys from. Optional, switched on per shop from App Admin. */
export interface LocalSupplier {
  id: string;
  name: string;
  nameLower: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  /**
   * A supplier stops appearing in the picker rather than being deleted, so last
   * quarter's deliveries still name who they came from.
   */
  isActive: boolean;
  createdAtMillis: number;
  updatedAtMillis: number;
}

/**
 * What a row in `localSales` is. Absent means `'sale'`, so every record already
 * on disk is valid without being rewritten.
 */
export type LocalSaleKind = 'sale' | 'refund';

/** Why goods came back. */
export type LocalRefundReason =
  | 'faulty'
  | 'wrong-item'
  | 'changed-mind'
  | 'overcharged'
  | 'other';

/**
 * Why a line was marked down.
 *
 * A fixed vocabulary rather than free text, because the point is to be able to
 * COUNT them: a cashier under queue pressure types nothing an owner can total
 * up at the end of the week. Recorded on the line, never on the sale, because
 * that is where the discount is.
 */
export type LocalDiscountReason =
  | 'damaged'
  | 'price-match'
  | 'staff'
  | 'loyalty'
  | 'goodwill'
  | 'other';

/** Where a sale has got to with the tax authority. Carried, never computed. */
export type LocalFiscalStatus = 'pending' | 'sent' | 'failed' | 'exempt';

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
  /** On a refund row: which line of the original sale this reverses. */
  originalLineIndex?: number;
  /** Set only when the discount survived the clamp -- see `priceLocalSale`. */
  discountReason?: LocalDiscountReason;
}

/**
 * A completed sale. The local equivalent of an `orders` document.
 *
 * Written once and never edited: a correction is another sale, not a rewrite of
 * this one. That is what makes the receipt a shop hands a customer match the
 * record a tax inspector later reads.
 *
 * **A refund is a row in here too**, with `kind: 'refund'` and negative money.
 * That is the whole design, and it is worth saying why rather than leaving the
 * next reader to wonder.
 *
 * Six independent readers already sum `total` or `lineTotal` -- `shift-totals`,
 * the Sales page's takings, its CSV, and three in `store-stats`. A separate
 * `localRefunds` store would mean teaching each of them to subtract a second
 * query, and each is a place somebody can forget. Forgetting OVERSTATES
 * REVENUE, which is the exact failure refunds exist to fix. Negative rows here
 * make all six correct without touching them.
 *
 * Three more reasons, each sufficient on its own. A refund slip needs an
 * ordinal from the same receipt sequence, and `commitLocalSale` already spends
 * one atomically. No new `local*` store means `factoryResetLocalStore`, the
 * backup and the fourteen-store count in CLAUDE.md are all untouched. And it
 * degrades safely: an older build reads a refund as a sale with a negative
 * total, so its figures stay RIGHT even where the label is missing -- a
 * separate store would be invisible to it and would silently overstate.
 *
 * This does not contradict "written once and never edited". Nothing ever writes
 * to the original row: how much of each line has already been returned is
 * derived from the refunds pointing at it, never stored on it.
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
  /**
   * Which counter rang it, and which turn at that counter.
   *
   * All three optional, and absent on every sale written before terminals
   * existed. A sale is never refused for want of them: a till with no roster
   * has no terminal to stamp, and one with shifts switched off has no shift.
   * The name is frozen beside the id for the reason `LocalOpeningCash` freezes
   * `deviceLabel` -- a terminal an owner later removes must still leave its
   * sales readable as "Front counter" rather than as a dangling id.
   */
  terminalId?: string;
  terminalName?: string;
  shiftId?: string;

  /** Absent means `'sale'`, so every row written before refunds existed is valid. */
  kind?: LocalSaleKind;
  /** Refund rows only: the sale being reversed. Indexed as `by-original`. */
  originalSaleId?: string;
  /** Frozen beside the id, so the Sales list reads without a second lookup. */
  originalReceiptNumber?: string;
  refundReason?: LocalRefundReason;
  refundNote?: string;

  /**
   * Fiscal fields, carried and never computed.
   *
   * Nothing in the till writes these today and no tax is calculated anywhere --
   * `showTaxOnReceipt` remains the switch it always was. They are here because
   * adding a field to this type costs nothing now and costs a migration across
   * every live shop later, and because `fiscalStatus: 'pending'` IS the
   * "sold, not yet fiscalised" marker; a separate boolean would be a second
   * source of truth for one fact.
   */
  fiscalDocumentNumber?: string;
  fiscalStatus?: LocalFiscalStatus;
  fiscalisedAtMillis?: number;
  fiscalError?: string;
}

/**
 * Whether a `localSales` row is a refund.
 *
 * A function rather than `sale.kind === 'refund'` scattered about, so the
 * string appears once and every reader that must branch on it is findable.
 */
export function isRefundSale(row: Pick<LocalSale, 'kind'>): boolean {
  return row.kind === 'refund';
}

/**
 * What a cashier declared was in the drawer before they started selling.
 *
 * Append-only, like `LocalSale`: a mis-keyed figure is corrected by confirming
 * again, never by editing this row, so an owner sees both declarations and the
 * order they arrived in. Nothing here is computed. This till has no closing
 * count and no cash movements, so there is no expected figure to compare
 * against and none is invented -- a variance derived from opening float plus
 * cash tenders is wrong the first time anyone takes a note out to pay a
 * delivery, and a wrong variance is what shops discipline staff on.
 *
 * Deliberately not named for the dormant cloud shift layer (`PosSession`,
 * `PosCashMovement`, `Order.sessionId`). That layer is a server-written shift;
 * this is a device-local declaration and nothing more.
 */
export interface LocalOpeningCash {
  /**
   * Random per confirmation, never composite.
   *
   * A `${day}-${cashier}-${device}` key would be idempotent against a
   * double-click but would overwrite the legitimate second confirmation of a
   * day -- drawer swapped at a handover, cashier signs back in, declares again.
   * Overwriting the morning's declaration destroys the record this exists to
   * keep. Guarding a double-click is the button's job.
   */
  id: string;
  /** Major units. Zero is valid: a card-only counter opens with an empty drawer. */
  amount: number;
  cashierId: string;
  /** Frozen at confirmation, so a renamed or disabled account still names who declared it. */
  cashierName: string;
  /** Whose drawer. A backup restored onto a replacement till carries the dead machine's id. */
  deviceId: string;
  /** This till's name at the time, so the back office reads "Front counter" and not a UUID. */
  deviceLabel: string;
  confirmedAtMillis: number;
  /**
   * Which sign-in this belongs to. Compared by equality, never by time, so the
   * "confirm again after signing in" rule survives an NTP correction or a
   * hand-set clock.
   *
   * Named `signInId` rather than `sessionId` because `Order.sessionId` already
   * means a cloud shift.
   */
  signInId: string;
  /**
   * The calendar day at the counter, `YYYY-MM-DD`, local.
   *
   * Frozen at write time rather than derived from `confirmedAtMillis` later:
   * deriving it needs a UTC offset, and the only honest offset is the one the
   * machine had while the cashier stood in front of it. Freezing it is also
   * what makes a daylight-saving change a non-event -- recomputing a 23:50
   * confirmation with tomorrow's offset can flip the date by one.
   */
  businessDay: string;
  /** `getTimezoneOffset()` at confirmation -- minutes local is BEHIND UTC. */
  utcOffsetMinutes: number;
}

/**
 * One counter in the shop.
 *
 * The roster is shop data, held on every till and travelling the only way
 * anything travels between standalone tills: the backup file. There is no wire
 * between two of them, so a claim recorded here is this machine's claim and
 * nothing more -- till B does not learn that till A answers to "Front counter",
 * and cannot. That is a limit of a register with no server, not a gap to be
 * closed later by syncing, and the manual says so plainly.
 *
 * Deliberately not `PosDevice`, which is the cloud register's dormant registry:
 * that one is a Firestore document written by an admin elsewhere, this one is a
 * row a till holds about itself and its siblings.
 */
export interface LocalTerminal {
  id: string;
  /** What the shop calls it: "Front counter", "Kiosk 2". */
  name: string;
  /**
   * The pairing code, hashed exactly the way a password is -- same three
   * fields, same PBKDF2, same reason. The code is read off paper and typed on a
   * tablet by whoever sets a counter up; only its scrambled form is kept, so a
   * stolen backup does not hand somebody the codes.
   */
  codeHash: string;
  codeSalt: string;
  codeIterations: number;
  /**
   * The device answering to this terminal ON THIS MACHINE, or empty when free.
   *
   * Cleared when a backup is restored: the restoring machine is a different
   * machine, or the same one with its storage wiped and a fresh device id, and
   * either way the claim it carries is about a device that is not this one.
   * Leaving it would quietly point a second till at an occupied counter.
   */
  claimedByDeviceId: string;
  claimedAtMillis?: number;
  createdAtMillis: number;
}

/**
 * Money in or out of the drawer during a shift, other than a sale.
 *
 * This is the record that makes a variance defensible. Without it the expected
 * figure is opening float plus cash taken, which is wrong the first time
 * anybody pays a delivery out of the till -- and a wrong variance is what shops
 * discipline staff on. `LocalOpeningCash` declined to compute one for exactly
 * that reason; this is the missing half, not a change of mind.
 */
export interface LocalCashMovement {
  id: string;
  kind: 'in' | 'out';
  /** Major units, always positive. The direction is `kind`, never a sign. */
  amount: number;
  /** Why: "float top-up", "paid the milkman", "bank drop". */
  reason: string;
  byUserId: string;
  /** Frozen, so a renamed or deleted account still names who moved it. */
  byUserName: string;
  atMillis: number;
}

/**
 * One cashier's turn at one counter.
 *
 * Named `LocalShift` and keyed by `shiftId` rather than borrowing `PosSession`
 * and `Order.sessionId`, which are the cloud register's server-written shift.
 * The two answer the same question in different products and must not be wired
 * together by a shared name -- the same rule that produced `signInId` over
 * `sessionId` and `requireOpeningCash` over `requireShift`.
 *
 * Money fields are major units, like `LocalSale`; the arithmetic that produces
 * them accumulates in minor units in `shift-totals.ts`, like `priceLocalSale`.
 *
 * Closed shifts are never edited. A miscount is corrected by a cash movement on
 * the next shift, not by rewriting this row, so the figure an owner reads is
 * the figure the cashier actually gave.
 */
export interface LocalShift {
  id: string;
  terminalId: string;
  /** Frozen at open, so removing the terminal does not orphan the shift. */
  terminalName: string;
  cashierId: string;
  /** Frozen at open, for the reason `LocalOpeningCash.cashierName` is. */
  cashierName: string;
  deviceId: string;
  /**
   * Which sign-in opened it. Compared by equality, never by time, so the rule
   * survives an NTP correction or a hand-set clock -- as on `LocalOpeningCash`.
   */
  signInId: string;
  status: 'open' | 'closed';
  openedAtMillis: number;
  /** Major units. Zero is valid: a card-only counter opens empty. */
  openingFloat: number;
  /** `YYYY-MM-DD` local, frozen at open. Never recomputed at close -- a shift
   * that runs past midnight belongs to the day it started. */
  businessDay: string;
  /** `getTimezoneOffset()` at open -- minutes local is BEHIND UTC. */
  utcOffsetMinutes: number;
  movements: LocalCashMovement[];
  closedAtMillis?: number;
  /** What the cashier counted. Absent while the shift is open. */
  countedCash?: number;
  /**
   * Opening float + cash taken + movements in − movements out.
   *
   * No refund term, because this till cannot make one: `priceLocalSale` clamps
   * a total at zero, so there is no negative sale to subtract. A permanently
   * zero "refunds" line on the Z-report would have implied a returns screen
   * that did not exist. Returns arrived in v2.0.0, and the Z-report now
   * shows Given back and Net -- but only on a shift that actually had one,
   * for the same reason.
   */
  expectedCash?: number;
  /** `countedCash − expectedCash`. Negative means the drawer is short. */
  variance?: number;
  totalsByTender?: Record<string, number>;
  salesTotal?: number;
  saleCount?: number;
  /**
   * Frozen at close, like the rest. Absent on every shift closed before
   * returns existed -- which is not a gap to be filled in but the truth: those
   * shifts had no returns because the till could not make one.
   */
  refundsTotal?: number;
  refundCount?: number;
  netTotal?: number;
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
  /**
   * Whether a cashier must declare the cash in the drawer before the register
   * will open.
   *
   * Off by default, and off on every till that upgrades into this release:
   * `readLocalShopSettings` merges over `DEFAULT_LOCAL_SHOP_SETTINGS`, so a
   * settings row written before this field existed reads back false and no
   * migration runs. A change of software must never be the reason a queue stops.
   *
   * Named for what it gates, not for the dormant cloud shift layer.
   * `PosSettings.requireShift` means something larger -- an open/close session
   * with movements and a variance, none of which is implemented -- and reusing
   * that name would invite someone to wire the two together.
   */
  requireOpeningCash: boolean;
  /**
   * Whether a cashier must open a shift before the register will sell, and
   * close it against a counted drawer when they finish.
   *
   * Off by default and off on every till that upgrades into this release, for
   * the reason `requireOpeningCash` gives above. It cannot be switched on until
   * the shop has named at least one counter: a shift belongs to a terminal, and
   * one with nowhere to belong would have to invent a counter out of the device
   * id, which is the sort of placeholder that survives into a shop's records.
   *
   * When this is on, `requireOpeningCash` is not asked -- the shift's opening
   * float IS the drawer declaration, and putting both in front of a cashier
   * would ask the same question twice with two different answers on file.
   */
  shiftsEnabled: boolean;
  /**
   * The optional screens, switched on per shop by whoever installed the till.
   *
   * Off by default and off on every till that upgrades into this release, for
   * the reason `requireOpeningCash` gives above: `readLocalShopSettings` merges
   * over the defaults, so a settings row written before these existed reads
   * back false and no migration runs.
   *
   * `lotTrackingEnabled` hides the lot fields and columns; it does NOT change
   * what happens to stock. A product already marked `tracksLots` goes on
   * drawing first-expiry-first-out with this off, because a switch that quietly
   * stopped drawing lots would leave the shelf and the record disagreeing.
   */
  categoriesEnabled: boolean;
  suppliersEnabled: boolean;
  lotTrackingEnabled: boolean;
  /** Set once, by Technical Support, when the machine is commissioned. */
  commissionedAtMillis: number;
  /**
   * The recovery code, hashed exactly the way a password is.
   *
   * One job: set a new password on the account named by `recoveryForUserId`.
   * It never grants a session and never signs anybody in -- after it is used
   * the operator goes to the ordinary sign-in screen and types the password
   * they just chose. That is what keeps it safe to write on paper and file in
   * a drawer, and it is why losing the paper costs a shop nothing it was not
   * already exposed to.
   *
   * Deliberately five fields here rather than a `localRecoveryCodes` store.
   * `readLocalShopSettings` merges over `DEFAULT_LOCAL_SHOP_SETTINGS`, so a
   * till commissioned before this release reads them back empty and no
   * migration runs -- the same trick `requireOpeningCash` and
   * `categoriesEnabled` use. It also means the rule that a new `local*` store
   * joins `factoryResetLocalStore` *and* the backup in the same change is
   * satisfied by construction: `localSettings` is already in both.
   *
   * Carrying the hash into the backup is correct rather than a leak. A hundred
   * and twenty-five bits behind PBKDF2 is not grindable the way a six-character
   * password is, and a shop restoring onto a replacement machine should find
   * the code it has written down still works.
   *
   * Empty `recoveryHash` means no code exists. Tills commissioned before this
   * release are in that state and are told so on the App admin screen, where
   * somebody can do something about it -- never at the counter, where a cashier
   * cannot.
   */
  recoveryHash: string;
  recoverySalt: string;
  recoveryIterations: number;
  recoveryMintedAtMillis: number;
  /** The account a code resets. Empty when no code has been minted. */
  recoveryForUserId: string;
}

export const DEFAULT_LOCAL_SHOP_SETTINGS: LocalShopSettings = {
  shopName: '',
  currency: 'USD',
  receiptHeader: '',
  receiptFooter: '',
  receiptPrefix: 'R',
  roundCashTo: 0,
  showTaxOnReceipt: false,
  requireOpeningCash: false,
  shiftsEnabled: false,
  categoriesEnabled: false,
  suppliersEnabled: false,
  lotTrackingEnabled: false,
  commissionedAtMillis: 0,
  recoveryHash: '',
  recoverySalt: '',
  recoveryIterations: 0,
  recoveryMintedAtMillis: 0,
  recoveryForUserId: '',
};
