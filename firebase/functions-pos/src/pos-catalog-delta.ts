import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { assertStaff } from './auth';

const PAGE_SIZE = 500;

/**
 * Products changed since a timestamp, for the register's local catalog cache.
 *
 * The register needs the whole catalog on disk to look up a scanned barcode
 * with no network, and re-downloading it on every shift open is wasteful once
 * a store has thousands of SKUs. Callers pass the `updatedAt` high-water mark
 * they already hold and get back only what moved.
 *
 * Products are public-read, so this endpoint is not what protects the catalog
 * — it exists because a delta query needs an `updatedAt` index and a stable
 * page contract, and because v10.2.0's standalone local mode needs one place
 * to pull from. It is still staff-gated so an anonymous visitor cannot page
 * the entire catalog, including inactive products, through one cheap call.
 *
 * `hasMore` means "call again with the returned cursor", not "you are behind":
 * the client should keep paging until it is false, then persist `cursorMillis`
 * as its new high-water mark.
 */
export const getPosCatalogDelta = onCall({ cors: true }, async (request: CallableRequest) => {
  await assertStaff(request);

  const data = (request.data ?? {}) as { sinceMillis?: unknown; limit?: unknown };
  const since =
    typeof data.sinceMillis === 'number' && Number.isFinite(data.sinceMillis) && data.sinceMillis > 0
      ? data.sinceMillis
      : 0;
  const limit =
    typeof data.limit === 'number' && data.limit > 0 ? Math.min(data.limit, PAGE_SIZE) : PAGE_SIZE;

  const db = getFirestore();
  let query = db.collection('products').orderBy('updatedAt', 'asc').limit(limit);
  if (since > 0) {
    query = db
      .collection('products')
      .orderBy('updatedAt', 'asc')
      .startAfter(Timestamp.fromMillis(since))
      .limit(limit);
  }

  let snap;
  try {
    snap = await query.get();
  } catch (error) {
    // `orderBy('updatedAt')` silently drops documents that have no `updatedAt`
    // field, which is every product written before v1.x backfilled it. Surface
    // that as an actionable error rather than a mysteriously short catalog.
    throw new HttpsError(
      'failed-precondition',
      'Catalog delta query failed. Products missing an `updatedAt` field are not returned — ' +
        're-save them in the admin product editor to backfill.',
      { cause: String(error) },
    );
  }

  const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const last = snap.docs[snap.docs.length - 1];
  const lastUpdatedAt = last?.get('updatedAt') as Timestamp | undefined;

  return {
    products,
    cursorMillis: lastUpdatedAt ? lastUpdatedAt.toMillis() : since,
    hasMore: snap.size === limit,
  };
});
