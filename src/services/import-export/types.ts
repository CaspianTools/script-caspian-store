import type { Firestore } from 'firebase/firestore';
import type { CsvCell } from '../../utils/csv';

/**
 * Import / Export dataset catalog contract. Mirrors the plugin-catalog pattern
 * (shipping/payments/email) — a static record of descriptors, each describing
 * one exportable (and optionally importable) store dataset.
 *
 * Engine-safe: server-importable, no `next/*`, no browser globals. The admin
 * page reads these descriptors; writes go through the existing per-entity
 * services so all slug/uniqueness/`stripUndefined` logic is reused.
 */

export type DatasetId =
  | 'products'
  | 'categories'
  | 'collections'
  | 'brands'
  | 'promo-codes'
  | 'subscribers'
  | 'orders'
  | 'users'
  | 'reviews';

/** What to do with a single uploaded row at apply time. */
export type RowAction = 'skip' | 'overwrite' | 'create';

/** One CSV column: drives the export header, the template, and the import column reference. */
export interface ColumnMeta {
  header: string;
  required?: boolean;
  /** Example value shown in the downloadable template's single sample row. */
  sample: string;
  /** Short hint surfaced in the import column reference. */
  help?: string;
}

/**
 * The result of validating + classifying one uploaded row, before any write.
 * The user picks an action per duplicate; `payload` is the validated write
 * input carried forward to `applyRows` so it isn't re-parsed.
 */
export interface RowPlan {
  /** 1-based row number in the uploaded file body (header excluded). */
  row: number;
  kind: 'new' | 'duplicate' | 'invalid';
  /** Resolved dedupe key (slug/code/email/id/name) when known. */
  key: string | null;
  /** Short human label for the row (product name, code, email, …). */
  summary: string;
  /** Set when `kind === 'duplicate'`: the existing doc id this row matches. */
  existingId?: string;
  /** Set when `kind === 'invalid'`: why the row can't be imported. */
  error?: string;
  /** Actions the user may pick for this row. */
  allowedActions: RowAction[];
  /** Pre-selected action (create for new, skip for duplicate). */
  defaultAction: RowAction;
  /** Opaque validated write input, reused by `applyRows`. */
  payload?: unknown;
}

/** A plan paired with the user's chosen action. */
export interface DecidedRow {
  plan: RowPlan;
  action: RowAction;
}

export interface RowResult {
  row: number;
  status: 'created' | 'updated' | 'skipped' | 'error';
  key?: string;
  message?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: RowResult[];
}

export interface DatasetDescriptor {
  id: DatasetId;
  /** i18n key for the dataset's display name. */
  labelKey: string;
  /** i18n key for the dataset's one-line description. */
  descriptionKey: string;
  canExport: boolean;
  canImport: boolean;
  /** Column definitions (header order). Drives export header, template, and column reference. */
  columns: ColumnMeta[];
  /** Pull every row for export, already serialized to CSV cells (header NOT included). */
  exportMatrix: (db: Firestore) => Promise<CsvCell[][]>;
  /** Validate + classify uploaded records without writing. Present iff `canImport`. */
  analyzeRows?: (db: Firestore, records: Record<string, string>[]) => Promise<RowPlan[]>;
  /** Execute the user's per-row decisions. Present iff `canImport`. */
  applyRows?: (db: Firestore, decided: DecidedRow[]) => Promise<ImportSummary>;
}
