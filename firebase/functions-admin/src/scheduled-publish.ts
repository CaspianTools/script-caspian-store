import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { reportFunctionError } from './error-report';

/**
 * Scheduled publish / unpublish for the page builder (v9.5). Every 5 minutes it
 * reads `pageLayoutSchedules` and:
 *
 *   - `publishAt <= now`  → move the page's DRAFT into the public `pageLayouts`
 *     doc (bump `version`, snapshot a revision, delete the draft); for a custom
 *     page, flip its `builderPages` status to `published`. Clears `publishAt`.
 *   - `unpublishAt <= now` → take the page down: a custom page's route flips back
 *     to `draft`; the homepage / content pages delete their published layout
 *     (reverting to the catalog seed / legacy text). Clears `unpublishAt`.
 *
 * Content never enters the public doc before its `publishAt` — the draft stays
 * admin-only until fire time. Both queries are single-inequality (auto-indexed).
 *
 * This runs with the Admin SDK (bypasses security rules). Kept deliberately
 * simple and idempotent; up to ~5 min latency on a flip is acceptable for
 * scheduled marketing content.
 */
export const runScheduledPublish = onSchedule(
  {
    region: 'us-central1',
    schedule: '*/5 * * * *',
    timeZone: 'Etc/UTC',
    retryCount: 1,
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    const duePublish = await db.collection('pageLayoutSchedules').where('publishAt', '<=', now).get();
    for (const doc of duePublish.docs) {
      const pageId = (doc.data().pageId as string) || doc.id;
      try {
        await publishFromDraft(db, pageId);
        await doc.ref.update({ publishAt: null, lastFiredAt: now });
        logger.info(`[scheduled-publish] Published ${pageId}.`);
      } catch (err) {
        logger.warn(`[scheduled-publish] Publish failed for ${pageId}: ${String(err)}`);
        void reportFunctionError('scheduled-publish.publish', err);
      }
    }

    const dueUnpublish = await db.collection('pageLayoutSchedules').where('unpublishAt', '<=', now).get();
    for (const doc of dueUnpublish.docs) {
      const pageId = (doc.data().pageId as string) || doc.id;
      try {
        await unpublishPage(db, pageId);
        await doc.ref.update({ unpublishAt: null, lastFiredAt: now });
        logger.info(`[scheduled-publish] Unpublished ${pageId}.`);
      } catch (err) {
        logger.warn(`[scheduled-publish] Unpublish failed for ${pageId}: ${String(err)}`);
        void reportFunctionError('scheduled-publish.unpublish', err);
      }
    }
  },
);

const MAX_REVISIONS = 30;

async function publishFromDraft(db: FirebaseFirestore.Firestore, pageId: string): Promise<void> {
  const draftRef = db.collection('pageLayoutDrafts').doc(pageId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) return; // nothing staged to publish
  const blocks = Array.isArray(draftSnap.data()?.blocks) ? draftSnap.data()!.blocks : [];

  const pubRef = db.collection('pageLayouts').doc(pageId);
  const now = Timestamp.now();
  const nextVersion = await db.runTransaction(async (tx) => {
    const pubSnap = await tx.get(pubRef);
    const current = pubSnap.exists && typeof pubSnap.data()?.version === 'number' ? pubSnap.data()!.version : 0;
    const version = current + 1;
    tx.set(pubRef, { id: pageId, schemaVersion: 2, blocks, version, publishedAt: now, updatedAt: now });
    tx.set(pubRef.collection('revisions').doc(String(version)), {
      version,
      schemaVersion: 2,
      blocks,
      createdAt: now,
      source: 'publish',
    });
    tx.delete(draftRef);
    return version;
  });

  // For a custom page, publishing also opens its route.
  const pageRef = db.collection('builderPages').doc(pageId);
  const pageSnap = await pageRef.get();
  if (pageSnap.exists && pageSnap.data()?.status !== 'published') {
    await pageRef.update({ status: 'published', updatedAt: now });
  }

  await pruneRevisions(db, pageId, nextVersion).catch(() => {});
}

async function unpublishPage(db: FirebaseFirestore.Firestore, pageId: string): Promise<void> {
  const pageRef = db.collection('builderPages').doc(pageId);
  const pageSnap = await pageRef.get();
  if (pageSnap.exists) {
    // Custom page: take the route offline (draft) without destroying its layout.
    await pageRef.update({ status: 'draft', updatedAt: Timestamp.now() });
    return;
  }
  // Homepage / content page: delete the published layout → reverts to the seed.
  await db.collection('pageLayouts').doc(pageId).delete().catch(() => {});
}

async function pruneRevisions(
  db: FirebaseFirestore.Firestore,
  pageId: string,
  latestVersion: number,
): Promise<void> {
  const cutoff = latestVersion - MAX_REVISIONS;
  if (cutoff < 1) return;
  const snap = await db
    .collection('pageLayouts')
    .doc(pageId)
    .collection('revisions')
    .where('version', '<=', cutoff)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
