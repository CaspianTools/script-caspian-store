export { PosGuard, type PosGuardProps } from './pos-guard';
export { PosRoot, PosShell } from './pos-root';
export { PosRegister, type PosRegisterProps } from './pos-register';
export { PosSettingsPage, type PosSettingsPageProps } from './pos-settings-page';
export { PosTenderDialog, parseAmount, type PosTenderDialogProps } from './pos-tender-dialog';
export { usePosTicket, type PosTicket, type PosTicketTotals } from './use-pos-ticket';
export {
  useBarcodeScanner,
  POS_BARCODE_FORMATS,
  DEFAULT_SCAN_GAP_MS,
  type BarcodeScannerApi,
  type BarcodeScannerOptions,
} from './hardware/use-barcode-scanner';
export {
  getPosDeviceId,
  getPosDeviceLabel,
  setPosDeviceLabel,
  nextPosSaleId,
} from './pos-device';
export { readScannerGapMs, writeScannerGapMs, resolvePosStorageMode } from './pos-preferences';
export {
  PosAdapterProvider,
  usePosAdapter,
  type PosAdapterValue,
} from './pos-adapter-context';
export { PosCloudAdapter } from './storage/cloud-adapter';
export { PosLocalAdapter } from './storage/local-adapter';
export { PosQueuedCloudAdapter } from './storage/queued-cloud-adapter';
export type {
  PosStorageAdapter,
  PosStorageMode,
  PosSaleDraft,
  PosSaleLine,
  PosSoldLine,
  PosTenderInput,
  PosCommittedSale,
} from './storage/types';
export {
  buildReceiptModel,
  summariseSoldLines,
  type PosReceiptModel,
  type PosReceiptLine,
  type PosReceiptTender,
  type BuildReceiptArgs,
} from './receipt/build-receipt-model';
export { PosReceipt, type PosReceiptProps } from './receipt/pos-receipt';
// --- Standalone: a till with no shop, no website and no Firebase project ---
export {
  PosLocalSessionProvider,
  usePosLocalSession,
  type PosLocalSessionValue,
} from './standalone/local-session-context';
export { PosLocalSignIn } from './standalone/pos-local-sign-in';
export {
  PosOpeningCashProvider,
  usePosOpeningCash,
  type PosOpeningCashValue,
} from './standalone/opening-cash-context';
export {
  PosOpeningCashGate,
  PosOpeningCashPanel,
  type PosOpeningCashGateProps,
  type PosOpeningCashPanelProps,
  type PosOpeningCashReason,
} from './standalone/pos-opening-cash-gate';
export {
  priceLocalSale,
  toMinor,
  fromMinor,
  type PricedSale,
  type PricedLineInput,
} from './standalone/price-local-sale';
export {
  DEFAULT_SIZE_KEY,
  LOT_EXPIRY_WARNING_DAYS,
  sortLotsFefo,
  allocateFefo,
  summariseProductMovements,
  receiptTotals,
  lotExpiryState,
  saleStockMovements,
  type LotDraw,
  type LotAllocation,
  type ProductMovementSummary,
  type ReceiptTotals,
  type LotExpiryState,
} from './standalone/lot-allocation';
export {
  evaluateOpeningCashGate,
  localDayKey,
  msUntilNextLocalDay,
  latestOpeningCash,
  type OpeningCashGate,
  type OpeningCashGateInput,
} from './standalone/opening-cash';
export { LocalSalesPanel, LocalSalesPage } from './standalone/admin/local-sales-panel';
export { LocalStorePanel } from './standalone/admin/local-store-panel';
export { LocalProductPage } from './standalone/admin/local-product-page';
export { LocalReceiveStockPage } from './standalone/admin/local-receive-stock-page';
export { LocalCategoriesPanel } from './standalone/admin/local-categories-panel';
export { LocalSuppliersPanel } from './standalone/admin/local-suppliers-panel';
export {
  LocalStockAdjustDialog,
  type LocalStockAdjustDialogProps,
} from './standalone/admin/local-stock-adjust-dialog';
export { StoreScreenNav, type StoreScreen } from './standalone/admin/store-screen-nav';
export {
  PosShopSettingsProvider,
  usePosShopSettings,
  type PosShopSettingsValue,
} from './standalone/shop-settings-context';
export { LocalPeoplePanel, LocalPeoplePage } from './standalone/admin/local-people-panel';
export {
  LOCAL_PRODUCT_COLUMNS,
  localProductsToCsv,
  localProductTemplateCsv,
  planLocalProductImport,
  type LocalColumnMeta,
  type LocalImportPlan,
  type LocalImportRow,
} from './standalone/local-csv';
export {
  buildLocalBackup,
  restoreLocalBackup,
  parseLocalBackup,
  localBackupFilename,
  saveTextFile,
  LOCAL_BACKUP_VERSION,
  type LocalBackup,
  type RestoreResult,
} from './standalone/local-backup';
export {
  can,
  canAccess,
  capabilitiesFromAreas,
  POS_LOCAL_ROLES,
  POS_LOCAL_AREAS,
  POS_LOCAL_CAPABILITIES,
  CAPABILITY_GROUPS,
  BUILTIN_ROLES,
  DEFAULT_LOCAL_SHOP_SETTINGS,
  type PosLocalRole,
  type PosLocalArea,
  type PosLocalCapability,
  type RoleDefinition,
  type LocalUser,
  type LocalProduct,
  type LocalSale,
  type LocalSaleLine,
  type LocalShopSettings,
  type LocalOpeningCash,
  LOCAL_STOCK_ADJUST_REASONS,
  type LocalStockLot,
  type LocalStockMovement,
  type LocalStockMovementKind,
  type LocalStockAdjustReason,
  type LocalStockReceipt,
  type LocalStockReceiptLine,
  type LocalCategory,
  type LocalSupplier,
} from './standalone/types';
export {
  localStoreAvailable,
  newLocalId,
  makeLocalProduct,
  toProduct as localProductToProduct,
  listLocalProducts,
  getLocalProduct,
  saveLocalProduct,
  saveLocalProducts,
  deleteLocalProduct,
  localProductCount,
  lookupLocalByCode,
  searchLocalProducts,
  listLocalUsers,
  getLocalUser,
  getLocalUserByUsername,
  saveLocalUser,
  deleteLocalUser,
  localUserCount,
  getLocalSale,
  listLocalSales,
  commitLocalSale,
  peekLocalReceiptCounter,
  readLocalShopSettings,
  writeLocalShopSettings,
  recordLocalOpeningCash,
  latestLocalOpeningCash,
  listLocalOpeningCash,
  factoryResetLocalStore,
  localRolesRow,
  lookupLocalProductByCode,
  listLocalLots,
  listAllLocalLots,
  listLocalMovements,
  listLocalStockReceipts,
  getLocalStockReceipt,
  readLocalStockReceiptDraft,
  writeLocalStockReceiptDraft,
  discardLocalStockReceiptDraft,
  postLocalStockReceipt,
  adjustLocalStock,
  backfillLocalStockMovements,
  makeLocalCategory,
  listLocalCategories,
  saveLocalCategory,
  renameLocalCategory,
  deleteLocalCategory,
  adoptLocalCategoriesFromProducts,
  makeLocalSupplier,
  listLocalSuppliers,
  saveLocalSupplier,
  deleteLocalSupplier,
  type LocalLookup,
  type LocalCommitInput,
  type LocalCommitLine,
  type LocalStockAdjustInput,
} from './standalone/local-db';
export {
  hashLocalPassword,
  verifyLocalPassword,
  createLocalUser,
  setLocalPassword,
  signInLocal,
  isCommissioned,
  restoreLocalSession,
  clearLocalSession,
  readLocalSignInId,
  writeLocalSignInId,
  normaliseUsername,
  MIN_LOCAL_PASSWORD_LENGTH,
  type LocalCredentials,
  type CreateLocalUserResult,
} from './standalone/local-auth';

export {
  usePosLicense,
  verifyLicenseKey,
  parseLicenseKey,
  formatLicenseKey,
  isLicensingConfigured,
  POS_LICENSE_PUBLIC_KEY,
  LICENSE_KEY_PREFIX,
  PosLicenseBanner,
  PosLicenseSection,
  type PosLicenseState,
  type PosLicenseCheck,
  type PosLicenseStatus,
  type PosLicensePayload,
  type PosSeatState,
  type PosLicenseBannerProps,
  type PosLicenseSectionProps,
} from './license';

// --- Keeping a standalone till's data (v13.2.0) ---

export {
  PosOpenSaleProvider,
  usePosOpenSale,
  type PosOpenSale,
  type RecoveredOpenSale,
} from './open-sale-context';
export { PosOpenSaleBanner } from './open-sale-banner';
export {
  readOpenSale,
  writeOpenSale,
  clearOpenSale,
  OPEN_SALE_KEY,
  type PersistedOpenSale,
} from './open-sale-store';

export {
  ensurePosStoragePersisted,
  readPosStorageHealth,
  probePosDb,
  formatBytes,
  storageIsTight,
  type PosStorageHealth,
  type PosDbProbe,
} from './pos-storage-durability';
export { PosStorageHealthCard } from './pos-storage-health-card';

export {
  backupFolderSupported,
  pickBackupFolder,
  readBackupFolder,
  forgetBackupFolder,
  backupFolderPermission,
  writeBackupFile,
  pruneDatedBackups,
  LATEST_BACKUP_FILENAME,
  RECENT_BACKUPS_KEPT,
  DAILY_BACKUPS_KEPT,
  type BackupDirectoryHandle,
  type BackupFolderPermission,
} from './standalone/local-backup-folder';
export {
  usePosAutoBackup,
  announcePosSaleCommitted,
  BACKUP_STALE_MS,
  type PosAutoBackupState,
} from './standalone/use-pos-auto-backup';
export { PosAutoBackupProvider, usePosAutoBackupState } from './standalone/auto-backup-context';
