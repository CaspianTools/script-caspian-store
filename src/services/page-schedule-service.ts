import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';

/**
 * Publish-schedule control docs (`pageLayoutSchedules/{pageId}`, admin-only,
 * v9.5). The admin sets a future `publishAt` (and optional `unpublishAt`); the
 * `runScheduledPublish` Cloud Function moves the DRAFT into the public doc at
 * fire time, so content never enters the public doc before its scheduled time.
 */

export interface PageSchedule {
  pageId: string;
  publishAt: Timestamp | null;
  unpublishAt: Timestamp | null;
}

export async function getPageSchedule(db: Firestore, pageId: string): Promise<PageSchedule | null> {
  const snap = await getDoc(doc(db, 'pageLayoutSchedules', pageId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    pageId,
    publishAt: data.publishAt instanceof Timestamp ? data.publishAt : null,
    unpublishAt: data.unpublishAt instanceof Timestamp ? data.unpublishAt : null,
  };
}

export async function setPageSchedule(
  db: Firestore,
  pageId: string,
  when: { publishAt?: Date | null; unpublishAt?: Date | null; uid?: string },
): Promise<void> {
  await setDoc(
    doc(db, 'pageLayoutSchedules', pageId),
    {
      pageId,
      publishAt: when.publishAt ? Timestamp.fromDate(when.publishAt) : null,
      unpublishAt: when.unpublishAt ? Timestamp.fromDate(when.unpublishAt) : null,
      updatedAt: Timestamp.now(),
      createdBy: when.uid ?? null,
    },
    { merge: true },
  );
}
