/**
 * Shape of the composite-index manifest consumers deploy as
 * `firestore.indexes.json`. Declared by hand (rather than inferred from the
 * JSON) so `CASPIAN_FIRESTORE_INDEXES` keeps a stable, documented public type
 * even though its *value* is generated from disk at build time.
 */
export interface CaspianFirestoreIndexField {
  fieldPath: string;
  /** Present on ordered fields. Absent when `arrayConfig` is used instead. */
  order?: string;
  /** Present on array-contains fields (e.g. `CONTAINS`). */
  arrayConfig?: string;
}

export interface CaspianFirestoreIndex {
  collectionGroup: string;
  queryScope: string;
  fields: CaspianFirestoreIndexField[];
}

export interface CaspianFirestoreIndexes {
  indexes: CaspianFirestoreIndex[];
  /**
   * Single-field index exemptions. Empty today; typed loosely because the
   * Firebase CLI's schema for this key is broader than anything we emit.
   */
  fieldOverrides: unknown[];
}
