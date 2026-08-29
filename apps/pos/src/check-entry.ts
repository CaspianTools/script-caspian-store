/**
 * What `scripts/check-standalone.mjs` reaches for.
 *
 * The guard runs in plain Node against a bundle, because the things worth
 * guarding here -- what a customer is charged, what a CSV round-trip does to a
 * catalogue, whether a password verifies, what the backup pruner deletes -- are
 * pure functions extracted from the IndexedDB and React layers precisely so
 * they could be checked without a browser.
 *
 * It used to import them from the library's own `dist/index.mjs`, back when the
 * till shipped inside that package. It does not any more, so the till builds
 * its own small bundle: `npm run build:check`.
 *
 * This file is the guard's surface and nothing else's. It is not the till's
 * public API -- the till has no public API -- so add to it only when a check
 * needs something, and delete from it when one stops.
 */

export { POS_MESSAGES_EN, POS_OVERLAYS } from './i18n';
export { formatPosMessage } from './i18n/plural';
export { OPEN_SALE_KEY } from './pos/open-sale-store';
export { resolvePosStorageMode } from './pos/pos-preferences';
export {
  formatBytes,
  storageIsTight,
} from './pos/pos-storage-durability';
export {
  displayAmount,
  fromMinor,
  roundCashMinor,
  toMinor,
  usableCurrency,
} from './pos/money';
export { parseAmount, parseAmountStrict } from './pos/parse-amount';
export { splitTenders } from './pos/tender-allocation';
export { buildReceiptModel, summariseSoldLines } from './pos/receipt/build-receipt-model';
export {
  MIN_LOCAL_PASSWORD_LENGTH,
  canDisableLocalUser,
  canRemoveLocalUser,
  credentialStampOf,
  hashLocalPassword,
  needsRehash,
  normaliseUsername,
  parseLocalSession,
  passwordIsWeak,
  verifyLocalPassword,
  verifyStoredCredentials,
} from './pos/standalone/local-auth';
export {
  localBackupFilename,
  parseLocalBackup,
} from './pos/standalone/local-backup';
export {
  DAILY_BACKUPS_KEPT,
  LATEST_BACKUP_FILENAME,
  RECENT_BACKUPS_KEPT,
  pruneDatedBackups,
} from './pos/standalone/local-backup-folder';
export {
  LOCAL_PRODUCT_COLUMNS,
  localProductTemplateCsv,
  localProductsToCsv,
  planLocalProductImport,
} from './pos/standalone/local-csv';
export {
  toProduct as localProductToProduct,
  localRolesRow,
  makeLocalProduct,
} from './pos/standalone/local-db';
export { validateProductDraft } from './pos/standalone/admin/quick-add/validate-product-draft';
export { hasRecoveryCode } from './pos/standalone/local-recovery';
export {
  DEFAULT_SIZE_KEY,
  addReceiptLine,
  allocateFefo,
  ensureReceiptLine,
  lotExpiryState,
  receiptTotals,
  saleStockMovements,
  sortLotsFefo,
  summariseProductMovements,
} from './pos/standalone/lot-allocation';
export {
  evaluateOpeningCashGate,
  latestOpeningCash,
  localDayKey,
  msUntilNextLocalDay,
} from './pos/standalone/opening-cash';
export { priceLocalSale } from './pos/standalone/price-local-sale';
export {
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_PREFIX,
  RECOVERY_CODE_SYMBOLS,
  formatRecoveryCode,
  isRecoveryCodeShaped,
  mintRecoveryCode,
  normaliseRecoveryCode,
} from './pos/standalone/recovery-code';
export {
  evaluateShiftGate,
  openShiftForDevice,
} from './pos/standalone/shift-gate';
export {
  salesForShift,
  shiftVariance,
  summariseShift,
} from './pos/standalone/shift-totals';
export {
  SIGN_IN_DELAY_LADDER_MS,
  SIGN_IN_FREE_ATTEMPTS,
  SIGN_IN_THROTTLE_FORGET_MS,
  evaluateSignInThrottle,
  pruneSignInThrottle,
  recordSignInFailure,
  throttleWaitSeconds,
} from './pos/standalone/sign-in-throttle';
export {
  categoryTotals,
  productSaleRows,
  rangeStart,
  salesByProduct,
  supplierTotals,
} from './pos/standalone/store-stats';
export {
  TERMINAL_CODE_PREFIX,
  TERMINAL_CODE_SYMBOLS,
  formatTerminalCode,
  isTerminalCodeShaped,
  mintTerminalCode,
  normaliseTerminalCode,
} from './pos/standalone/terminal-code';
export {
  DEFAULT_LOCAL_SHOP_SETTINGS,
  POS_LOCAL_ROLES,
  canAccess,
} from './pos/standalone/types';
