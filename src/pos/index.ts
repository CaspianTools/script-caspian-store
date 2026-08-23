export { PosGuard, type PosGuardProps } from './pos-guard';
export { PosRoot, PosShell } from './pos-root';
export { PosRegister, type PosRegisterProps } from './pos-register';
export { PosSettingsPage, type PosSettingsPageProps } from './pos-settings-page';
export { PosTenderDialog, type PosTenderDialogProps } from './pos-tender-dialog';
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
export {
  readScannerGapMs,
  writeScannerGapMs,
  readPrinterTransport,
  writePrinterTransport,
  readStorageMode,
  writeStorageMode,
  resolvePosStorageMode,
} from './pos-preferences';
export { PosCloudAdapter } from './storage/cloud-adapter';
export { PosLocalAdapter } from './storage/local-adapter';
export type {
  PosStorageAdapter,
  PosStorageMode,
  PosSaleDraft,
  PosSaleLine,
  PosTenderInput,
  PosCommittedSale,
} from './storage/types';
export {
  buildReceiptModel,
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
  priceLocalSale,
  toMinor,
  fromMinor,
  type PricedSale,
  type PricedLineInput,
} from './standalone/price-local-sale';
export {
  PosLocalAdminPage,
  type PosLocalAdminPageProps,
} from './standalone/admin/pos-local-admin-page';
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
  canAccess,
  POS_LOCAL_ROLES,
  DEFAULT_LOCAL_SHOP_SETTINGS,
  type PosLocalRole,
  type PosLocalArea,
  type LocalUser,
  type LocalProduct,
  type LocalSale,
  type LocalSaleLine,
  type LocalShopSettings,
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
  factoryResetLocalStore,
  type LocalLookup,
  type LocalCommitInput,
  type LocalCommitLine,
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
