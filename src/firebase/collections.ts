import { collection, doc, type Firestore } from 'firebase/firestore';

/**
 * Lazily build collection references against a consumer-provided Firestore instance.
 * Consumers do not call these directly — the services do.
 */
export function caspianCollections(db: Firestore) {
  return {
    products: collection(db, 'products'),
    users: collection(db, 'users'),
    orders: collection(db, 'orders'),
    reviews: collection(db, 'reviews'),
    questions: collection(db, 'questions'),
    carts: collection(db, 'carts'),
    faqs: collection(db, 'faqs'),
    journal: collection(db, 'journal'),
    subscribers: collection(db, 'subscribers'),
    promoCodes: collection(db, 'promoCodes'),
    shippingPluginInstalls: collection(db, 'shippingPluginInstalls'),
    paymentPluginInstalls: collection(db, 'paymentPluginInstalls'),
    emailPluginInstalls: collection(db, 'emailPluginInstalls'),
    productCategories: collection(db, 'productCategories'),
    productBrands: collection(db, 'productBrands'),
    productCollections: collection(db, 'productCollections'),
    // Generic product-taxonomy terms (materials, seasons, colors, …) keyed by a
    // `type` field. Brands keep their own `productBrands` collection. Added in v9.13.0.
    taxonomyTerms: collection(db, 'taxonomyTerms'),
    pageContents: collection(db, 'pageContents'),
    // Page builder (v9.26.0). Published layouts (public read) + admin-only
    // working drafts + publish schedules; `builderPages` is the registry of
    // custom pages beyond the homepage.
    pageLayouts: collection(db, 'pageLayouts'),
    pageLayoutDrafts: collection(db, 'pageLayoutDrafts'),
    pageLayoutSchedules: collection(db, 'pageLayoutSchedules'),
    builderPages: collection(db, 'builderPages'),
    languages: collection(db, 'languages'),
    searchTerms: collection(db, 'searchTerms'),
    emailTemplates: collection(db, 'emailTemplates'),
    contacts: collection(db, 'contacts'),
    errorLogs: collection(db, 'errorLogs'),
    adminTodos: collection(db, 'adminTodos'),
    // v8.7.0: Setup-wizard email allowlist for the very first admin. Each
    // doc id is the lowercase, trimmed email; on signup `onUserCreate`
    // promotes the matching account to admin and deletes the doc.
    pendingSuperAdmin: collection(db, 'pendingSuperAdmin'),
    // v10.0.0 point of sale. `posSessions` and `posCounters` are written only
    // by the `caspian-pos` Cloud Functions (Admin SDK); clients read sessions
    // and never touch the counter. `posDevices` is the register registry —
    // staff read it, admins name/retire registers.
    posSessions: collection(db, 'posSessions'),
    posDevices: collection(db, 'posDevices'),
    posCounters: collection(db, 'posCounters'),
    scriptSettingsDoc: doc(db, 'scriptSettings', 'site'),
    siteSettingsDoc: doc(db, 'settings', 'site'),
    emailSettingsDoc: doc(db, 'emailSettings', 'site'),
  };
}

export type CaspianCollections = ReturnType<typeof caspianCollections>;

/** Published-layout revision history for one page (`pageLayouts/{id}/revisions`). */
export function pageLayoutRevisions(db: Firestore, pageId: string) {
  return collection(db, 'pageLayouts', pageId, 'revisions');
}
