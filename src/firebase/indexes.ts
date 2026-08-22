/**
 * Composite Firestore indexes for a Caspian Store installation.
 *
 * The value is generated from `firebase/firestore.indexes.json` — the file
 * consumers actually deploy — by the pre-step in `tsup.config.ts`, so the
 * exported constant and the deployed manifest cannot drift. Add new indexes
 * to the JSON, not here.
 */
export { CASPIAN_FIRESTORE_INDEXES } from './indexes.generated';
export type {
  CaspianFirestoreIndex,
  CaspianFirestoreIndexField,
  CaspianFirestoreIndexes,
} from './indexes-types';
