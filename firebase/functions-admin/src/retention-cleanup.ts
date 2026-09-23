import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { reportFunctionError } from './error-report';

/**
 * Daily personal-data retention cleanup. Reads `settings/site` for the
 * `privacy` block (mirrors `SiteSettings.privacy` on the client) and deletes:
 *
 *   - Inactive user accounts older than `retainInactiveAccountsDays`
 *     (deletes both the Firestore `users/{uid}` doc *and* the matching Auth
 *     record so they can't sign back in).
 *   - Orders in status `'cancelled'` older than `retainCancelledOrdersDays`.
 *   - Orders in a failed state older than `retainFailedOrdersDays`.
 *   - Orders in status `'delivered'` older than `retainCompletedOrdersDays`.
 *   - Error log docs older than `retainErrorLogsDays` (mod1182).
 *
 * Every retention field is optional — `undefined` means "keep indefinitely",
 * and the function silently skips that bucket. When the entire `privacy`
 * block is absent the function logs and exits without touching anything,
 * so stores that haven't opted in are untouched.
 *
 * Logged once per bucket: `"deleted N <kind> docs older than D days"`.
 */
export const runRetentionCleanup = onSchedule(
  {
    // Run once a day at 03:15 in the deploy region. Daily is granular enough
    // for retention; the off-hours slot keeps it away from peak storefront
    // traffic. Override via the Firebase console schedule editor if needed.
    schedule: '15 3 * * *',
    timeZone: 'Etc/UTC',
    // Cap retries so a transient Firestore hiccup doesn't burn through
    // budget; the function re-runs in 24h regardless.
    retryCount: 1,
  },
  async () => {
    const db = getFirestore();
    const settingsDoc = await db.collection('settings').doc('site').get();
    const privacy =
      (settingsDoc.exists ? (settingsDoc.data()?.privacy as RetentionConfig | undefined) : undefined) ??
      undefined;

    if (!privacy) {
      logger.info('[retention] No privacy retention policy configured; skipping.');
      return;
    }

    const now = Date.now();
    const cutoff = (days: number) => now - days * 24 * 60 * 60 * 1000;

    if (typeof privacy.retainInactiveAccountsDays === 'number') {
      const cutoffMs = cutoff(privacy.retainInactiveAccountsDays);
      // Isolated so a failure here (the query needs the `users (role,
      // createdAt)` composite index — a missing index throws) still lets the
      // order and error-log buckets below run.
      try {
        const deleted = await deleteInactiveAccounts(db, cutoffMs);
        logger.info(
          `[retention] Deleted ${deleted} inactive accounts older than ${privacy.retainInactiveAccountsDays} days.`,
        );
      } catch (err) {
        logger.warn(`[retention] Inactive-account cleanup failed: ${String(err)}`);
        void reportFunctionError('retention-cleanup.inactiveAccounts', err);
      }
    }

    if (typeof privacy.retainCancelledOrdersDays === 'number') {
      const cutoffMs = cutoff(privacy.retainCancelledOrdersDays);
      const deleted = await deleteOrdersWithStatus(db, ['cancelled'], cutoffMs);
      logger.info(
        `[retention] Deleted ${deleted} cancelled orders older than ${privacy.retainCancelledOrdersDays} days.`,
      );
    }

    if (typeof privacy.retainFailedOrdersDays === 'number') {
      const cutoffMs = cutoff(privacy.retainFailedOrdersDays);
      // The OrderStatus union doesn't have a single 'failed' value — we treat
      // both `pending` (never paid) and `on-hold` (manual payment never
      // confirmed) as failed for retention purposes. Tweak per your workflow.
      const deleted = await deleteOrdersWithStatus(db, ['pending', 'on-hold'], cutoffMs);
      logger.info(
        `[retention] Deleted ${deleted} failed/pending orders older than ${privacy.retainFailedOrdersDays} days.`,
      );
    }

    if (typeof privacy.retainCompletedOrdersDays === 'number') {
      const cutoffMs = cutoff(privacy.retainCompletedOrdersDays);
      const deleted = await deleteOrdersWithStatus(db, ['delivered'], cutoffMs);
      logger.info(
        `[retention] Deleted ${deleted} completed orders older than ${privacy.retainCompletedOrdersDays} days.`,
      );
    }

    if (typeof privacy.retainErrorLogsDays === 'number') {
      const cutoffMs = cutoff(privacy.retainErrorLogsDays);
      try {
        const deleted = await deleteErrorLogs(db, cutoffMs);
        logger.info(
          `[retention] Deleted ${deleted} error logs older than ${privacy.retainErrorLogsDays} days.`,
        );
      } catch (err) {
        logger.warn(`[retention] Error-log cleanup failed: ${String(err)}`);
        void reportFunctionError('retention-cleanup.errorLogs', err);
      }
    }
  },
);

interface RetentionConfig {
  retainInactiveAccountsDays?: number;
  retainCancelledOrdersDays?: number;
  retainFailedOrdersDays?: number;
  retainCompletedOrdersDays?: number;
  retainErrorLogsDays?: number;
}

const BATCH_SIZE = 200;

/**
 * "Inactive" = `createdAt` is older than the cutoff and the account is not
 * an admin. Updating to track real "last activity" would require populating
 * `lastActiveAt` on every user action — out of scope here. Until then,
 * `createdAt` is the closest signal we ship by default.
 */
async function deleteInactiveAccounts(
  db: FirebaseFirestore.Firestore,
  cutoffMs: number,
): Promise<number> {
  const cutoffTs = Timestamp.fromMillis(cutoffMs);
  const snap = await db
    .collection('users')
    .where('createdAt', '<', cutoffTs)
    .where('role', '==', 'customer')
    .limit(BATCH_SIZE)
    .get();

  if (snap.empty) return 0;

  let count = 0;
  for (const doc of snap.docs) {
    try {
      await getAuth().deleteUser(doc.id).catch((err) => {
        // Auth user may already be gone; not a hard failure.
        logger.warn(`[retention] Auth.deleteUser failed for ${doc.id}: ${String(err)}`);
      });
      await doc.ref.delete();
      count += 1;
    } catch (err) {
      logger.warn(`[retention] Failed to delete user ${doc.id}: ${String(err)}`);
    }
  }
  return count;
}

async function deleteOrdersWithStatus(
  db: FirebaseFirestore.Firestore,
  statuses: string[],
  cutoffMs: number,
): Promise<number> {
  const cutoffTs = Timestamp.fromMillis(cutoffMs);
  let total = 0;

  for (const status of statuses) {
    const snap = await db
      .collection('orders')
      .where('status', '==', status)
      .where('createdAt', '<', cutoffTs)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) continue;

    // Firestore batches max 500 writes; BATCH_SIZE keeps us well under.
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

/** Trim the errorLogs collection for mod1182. One BATCH_SIZE pass per daily run. */
async function deleteErrorLogs(
  db: FirebaseFirestore.Firestore,
  cutoffMs: number,
): Promise<number> {
  const cutoffTs = Timestamp.fromMillis(cutoffMs);
  const snap = await db
    .collection('errorLogs')
    .where('timestamp', '<', cutoffTs)
    .limit(BATCH_SIZE)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

