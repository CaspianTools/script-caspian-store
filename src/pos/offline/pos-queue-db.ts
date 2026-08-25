/**
 * A very small promise wrapper over IndexedDB, for the register's offline store.
 *
 * IndexedDB rather than localStorage because this holds money. localStorage is
 * synchronous, string-only, capped around 5 MB, and has no transactions — so
 * "write the sale, then spend the receipt ordinal" could not be made atomic,
 * and a crash between the two would either lose a sale or reuse a number.
 *
 * No `idb` dependency: the wrapper is smaller than the library, and this is a
 * peer-dependency-sensitive package where every added dependency is one a
 * consumer inherits.
 */

export const DB_NAME = 'caspian-pos';
export const DB_VERSION = 5;

export const STORE_QUEUE = 'queue';
export const STORE_LEASES = 'leases';
export const STORE_CATALOG = 'catalog';
/**
 * The sale a cashier is part-way through -- see `open-sale-store.ts`.
 *
 * Declared with the cloud five because it was created alongside them, but it
 * belongs to neither group: it is not a cache of anything (nothing else has a
 * copy) and it is not a record of trade (no money has been taken yet). That is
 * why `clearPosDb` leaves it alone.
 */
export const STORE_TICKET = 'openTicket';
export const STORE_META = 'meta';

/**
 * Standalone stores, added at version 2.
 *
 * Separate from the five above, which all belong to the cloud register: they
 * are caches and outboxes whose truth lives in Firestore, and every one of them
 * can be thrown away and rebuilt. The `local*` stores are the opposite — on a
 * standalone till they ARE the shop's records, and nothing else has a copy.
 * That difference is why `clearPosDb` still wipes only the cloud five.
 */
export const STORE_LOCAL_PRODUCTS = 'localProducts';
export const STORE_LOCAL_USERS = 'localUsers';
export const STORE_LOCAL_SALES = 'localSales';
export const STORE_LOCAL_COUNTERS = 'localCounters';
export const STORE_LOCAL_SETTINGS = 'localSettings';
export const STORE_LOCAL_ROLES = 'localRoles';
/**
 * What each cashier declared was in the drawer before they started selling.
 *
 * Added at version 4. Belongs with the `local*` group above and not with the
 * cloud five: it is a shop's only record of who counted what, so `clearPosDb`
 * must never touch it.
 */
export const STORE_LOCAL_OPENING_CASH = 'localOpeningCash';
/**
 * What the shop bought, what is left of it, and every move in between.
 *
 * Added at version 5, and `local*` for the same reason as the rest: a delivery
 * nobody wrote down anywhere else is gone the moment this is cleared.
 *
 * `localStockLots` is authoritative for a product that tracks lots --
 * `LocalProduct.stock` is kept as a projection of it so the register, the
 * receipt and the CSV can go on reading the field they always read.
 */
export const STORE_LOCAL_LOTS = 'localStockLots';
export const STORE_LOCAL_MOVEMENTS = 'localStockMovements';
export const STORE_LOCAL_RECEIPTS = 'localStockReceipts';
export const STORE_LOCAL_CATEGORIES = 'localCategories';
export const STORE_LOCAL_SUPPLIERS = 'localSuppliers';

export type StoreName =
  | typeof STORE_QUEUE
  | typeof STORE_LEASES
  | typeof STORE_CATALOG
  | typeof STORE_TICKET
  | typeof STORE_META
  | typeof STORE_LOCAL_PRODUCTS
  | typeof STORE_LOCAL_USERS
  | typeof STORE_LOCAL_SALES
  | typeof STORE_LOCAL_COUNTERS
  | typeof STORE_LOCAL_SETTINGS
  | typeof STORE_LOCAL_ROLES
  | typeof STORE_LOCAL_OPENING_CASH
  | typeof STORE_LOCAL_LOTS
  | typeof STORE_LOCAL_MOVEMENTS
  | typeof STORE_LOCAL_RECEIPTS
  | typeof STORE_LOCAL_CATEGORIES
  | typeof STORE_LOCAL_SUPPLIERS;

let dbPromise: Promise<IDBDatabase> | null = null;

export function posIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export function openPosDb(): Promise<IDBDatabase> {
  if (!posIdbAvailable()) return Promise.reject(new Error('IndexedDB is not available'));
  if (dbPromise) return dbPromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queue = db.createObjectStore(STORE_QUEUE, { keyPath: 'saleId' });
        queue.createIndex('by-state', 'state');
        queue.createIndex('by-capturedAt', 'capturedAtMillis');
      }
      if (!db.objectStoreNames.contains(STORE_LEASES)) {
        db.createObjectStore(STORE_LEASES, { keyPath: 'leaseId' });
      }
      if (!db.objectStoreNames.contains(STORE_CATALOG)) {
        const catalog = db.createObjectStore(STORE_CATALOG, { keyPath: 'id' });
        catalog.createIndex('by-barcode', 'barcode');
        catalog.createIndex('by-sku', 'sku');
        catalog.createIndex('by-nameLower', 'nameLower');
      }
      if (!db.objectStoreNames.contains(STORE_TICKET)) {
        db.createObjectStore(STORE_TICKET, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_PRODUCTS)) {
        const local = db.createObjectStore(STORE_LOCAL_PRODUCTS, { keyPath: 'id' });
        local.createIndex('by-barcode', 'barcode');
        local.createIndex('by-sku', 'sku');
        local.createIndex('by-nameLower', 'nameLower');
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_USERS)) {
        const users = db.createObjectStore(STORE_LOCAL_USERS, { keyPath: 'id' });
        users.createIndex('by-username', 'username', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_SALES)) {
        const sales = db.createObjectStore(STORE_LOCAL_SALES, { keyPath: 'saleId' });
        sales.createIndex('by-committedAt', 'committedAtMillis');
        sales.createIndex('by-receiptNumber', 'receiptNumber');
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_COUNTERS)) {
        db.createObjectStore(STORE_LOCAL_COUNTERS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_SETTINGS)) {
        db.createObjectStore(STORE_LOCAL_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_ROLES)) {
        db.createObjectStore(STORE_LOCAL_ROLES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_OPENING_CASH)) {
        const opening = db.createObjectStore(STORE_LOCAL_OPENING_CASH, { keyPath: 'id' });
        // By cashier because the gate asks about one person; by time because the
        // back office lists everyone in date order.
        opening.createIndex('by-cashier', 'cashierId');
        opening.createIndex('by-confirmedAt', 'confirmedAtMillis');
      }
      // One index each, and only where something reads through it. The stores
      // above carry several that nothing has ever queried; adding one back
      // later is a version bump, which this file does routinely.
      if (!db.objectStoreNames.contains(STORE_LOCAL_LOTS)) {
        const lots = db.createObjectStore(STORE_LOCAL_LOTS, { keyPath: 'id' });
        // Every read of this store starts from one product.
        lots.createIndex('by-product', 'productId');
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_MOVEMENTS)) {
        const moves = db.createObjectStore(STORE_LOCAL_MOVEMENTS, { keyPath: 'id' });
        moves.createIndex('by-product', 'productId');
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_RECEIPTS)) {
        const receipts = db.createObjectStore(STORE_LOCAL_RECEIPTS, { keyPath: 'id' });
        // Drafts are found by status, not by time: the receiving screen asks
        // "is a delivery half-entered?" every time it opens.
        receipts.createIndex('by-status', 'status');
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_CATEGORIES)) {
        db.createObjectStore(STORE_LOCAL_CATEGORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LOCAL_SUPPLIERS)) {
        db.createObjectStore(STORE_LOCAL_SUPPLIERS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // A second tab running a newer version will block this one forever
      // otherwise. Drop the handle so the next call reopens.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('Could not open the register database'));
    req.onblocked = () => reject(new Error('The register database is blocked by another tab'));
  }).catch((e: unknown) => {
    dbPromise = null;
    throw e;
  });

  dbPromise = opening;
  return opening;
}

/**
 * Run work inside one transaction and resolve when it has actually COMMITTED.
 *
 * Resolving on the last request's success would be a lie: the transaction can
 * still abort afterwards. For a queue whose entire promise is "the sale is on
 * disk before we try the network", that distinction is the whole feature.
 */
export async function posTx<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openPosDb();
  const names = Array.isArray(stores) ? stores : [stores];
  return new Promise<T>((resolve, reject) => {
    let out: T;
    let failed = false;
    const tx = db.transaction(names, mode);
    tx.oncomplete = () => {
      if (!failed) resolve(out);
    };
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    Promise.resolve(fn(tx))
      .then((value) => {
        out = value;
      })
      .catch((e) => {
        failed = true;
        try {
          tx.abort();
        } catch {
          /* already finishing */
        }
        reject(e);
      });
  });
}

export const idbGet = <T>(tx: IDBTransaction, store: StoreName, key: IDBValidKey) =>
  wrap<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);

export const idbPut = (tx: IDBTransaction, store: StoreName, value: unknown) =>
  wrap(tx.objectStore(store).put(value as never));

export const idbDelete = (tx: IDBTransaction, store: StoreName, key: IDBValidKey) =>
  wrap(tx.objectStore(store).delete(key));

export const idbGetAll = <T>(tx: IDBTransaction, store: StoreName) =>
  wrap<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);

export const idbCount = (tx: IDBTransaction, store: StoreName) =>
  wrap<number>(tx.objectStore(store).count());

export function idbGetAllByIndex<T>(
  tx: IDBTransaction,
  store: StoreName,
  index: string,
  key: IDBValidKey,
): Promise<T[]> {
  return wrap<T[]>(tx.objectStore(store).index(index).getAll(key) as IDBRequest<T[]>);
}

/**
 * Wipe the cloud register's caches and outbox. An explicit operator action only.
 *
 * Deliberately does NOT touch `openTicket` or the `local*` stores. Everything cleared here can
 * be rebuilt from Firestore; a standalone till's catalogue, users and sales
 * cannot be rebuilt from anywhere, so a support engineer clearing a stuck
 * offline queue must not be able to delete a shop's trading history by
 * accident. Resetting a standalone till is `factoryResetLocalStore`, which is a
 * separate call with its own confirmation.
 */
export async function clearPosDb(): Promise<void> {
  // `openTicket` is excluded: a support engineer clearing a stuck queue must not
  // wipe the sale the cashier is standing there ringing up.
  await posTx([STORE_QUEUE, STORE_LEASES, STORE_CATALOG, STORE_META], 'readwrite', (tx) => {
    for (const s of [STORE_QUEUE, STORE_LEASES, STORE_CATALOG, STORE_META]) {
      tx.objectStore(s).clear();
    }
  });
}
