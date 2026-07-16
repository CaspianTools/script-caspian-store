import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { DraftLayout, PageBlock, PageLayout, SectionInstance } from '../types';
import { pageLayoutRevisions } from '../firebase/collections';
import { stripUndefinedDeep } from '../utils/strip-undefined';

/**
 * Page-builder layout persistence with a draft/publish split (v9.5).
 *
 *  - `pageLayouts/{id}` — the PUBLISHED layout, the only doc the storefront
 *    reads. One `getDoc` to render. Carries a monotonic `version`.
 *  - `pageLayoutDrafts/{id}` — the working draft (admin-only). The editor's
 *    Save writes here; the storefront never reads it, so unpublished content
 *    never leaks. Publishing copies the draft's blocks into the published doc,
 *    snapshots a revision, and clears the draft.
 *  - `pageLayouts/{id}/revisions/{version}` — published-layout history.
 *
 * Schema versions of the block data are unchanged (v2 = block tree; v1 = legacy
 * flat `sections`, lifted on read).
 */

const SCHEMA_VERSION = 2;
/** Keep at most this many published revisions per page (older ones are pruned). */
const MAX_REVISIONS = 30;

/** Thrown by `saveDraftLayout` / `publishLayout` when another admin wrote first. */
export class LayoutConflictError extends Error {
  constructor(public readonly by?: string) {
    super('layout-conflict');
    this.name = 'LayoutConflictError';
  }
}

/** Lift one legacy `SectionInstance` to a `PageBlock` (a structural superset). */
function sectionToBlock(s: SectionInstance): PageBlock {
  return { id: s.id, type: s.type, visible: s.visible, variant: s.variant, props: s.props ?? {} };
}

/** Read a block array from a doc in either the v2 (`blocks`) or v1 (`sections`) shape. */
function blocksFrom(data: Record<string, unknown>): PageBlock[] {
  if (Array.isArray(data.blocks)) return data.blocks as PageBlock[];
  if (Array.isArray(data.sections)) return (data.sections as SectionInstance[]).map(sectionToBlock);
  return [];
}

/** Load a page's PUBLISHED layout. Returns null if the page has never been published. */
export async function getPageLayout(db: Firestore, pageId: string): Promise<PageLayout | null> {
  const snap = await getDoc(doc(db, 'pageLayouts', pageId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 1,
    blocks: blocksFrom(data),
    updatedAt: data.updatedAt,
    version: typeof data.version === 'number' ? data.version : 0,
    publishedAt: data.publishedAt,
  };
}

/** Load a page's working DRAFT (admin-only). Returns null when no draft is saved. */
export async function getDraftLayout(db: Firestore, pageId: string): Promise<DraftLayout | null> {
  const snap = await getDoc(doc(db, 'pageLayoutDrafts', pageId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : SCHEMA_VERSION,
    blocks: blocksFrom(data),
    updatedAt: data.updatedAt,
    baseVersion: typeof data.baseVersion === 'number' ? data.baseVersion : 0,
    draftRev: typeof data.draftRev === 'number' ? data.draftRev : 0,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    updatedByName: typeof data.updatedByName === 'string' ? data.updatedByName : undefined,
  };
}

/**
 * Save the working draft (create or update). Optimistic concurrency: rejects
 * with {@link LayoutConflictError} if the stored `draftRev` moved past the
 * `baseDraftRev` the editor loaded (another admin saved in between). Returns the
 * new `draftRev` so the caller can advance its base.
 */
export async function saveDraftLayout(
  db: Firestore,
  pageId: string,
  blocks: PageBlock[],
  meta: { baseDraftRev: number; baseVersion: number; uid?: string; name?: string },
): Promise<{ draftRev: number }> {
  const ref = doc(db, 'pageLayoutDrafts', pageId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const currentRev = data && typeof data.draftRev === 'number' ? data.draftRev : 0;
    if (currentRev !== meta.baseDraftRev) {
      throw new LayoutConflictError(data && typeof data.updatedByName === 'string' ? data.updatedByName : undefined);
    }
    const nextRev = currentRev + 1;
    tx.set(
      ref,
      stripUndefinedDeep({
        id: pageId,
        schemaVersion: SCHEMA_VERSION,
        blocks,
        baseVersion: meta.baseVersion,
        draftRev: nextRev,
        updatedBy: meta.uid,
        updatedByName: meta.name,
        updatedAt: Timestamp.now(),
      }),
    );
    return { draftRev: nextRev };
  });
}

/** Delete the working draft without publishing. */
export async function discardDraft(db: Firestore, pageId: string): Promise<void> {
  await deleteDoc(doc(db, 'pageLayoutDrafts', pageId));
}

/** Delete old revisions beyond `MAX_REVISIONS` (best-effort, outside the publish txn). */
async function pruneRevisions(db: Firestore, pageId: string): Promise<void> {
  const snap = await getDocs(query(pageLayoutRevisions(db, pageId), orderBy('version', 'desc')));
  const overflow = snap.docs.slice(MAX_REVISIONS);
  if (overflow.length === 0) return;
  const batch = writeBatch(db);
  overflow.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Publish `blocks` to the live `pageLayouts/{id}` doc: bump `version`, snapshot a
 * revision, and clear the working draft — atomically. Optimistic concurrency:
 * rejects with {@link LayoutConflictError} if the published `version` moved past
 * `baseVersion` (another admin published in between). Returns the new version.
 */
export async function publishLayout(
  db: Firestore,
  pageId: string,
  blocks: PageBlock[],
  meta: { baseVersion: number; uid?: string; name?: string; source?: 'publish' | 'restore' },
): Promise<{ version: number }> {
  const pubRef = doc(db, 'pageLayouts', pageId);
  const draftRef = doc(db, 'pageLayoutDrafts', pageId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(pubRef);
    const data = snap.exists() ? snap.data() : null;
    const currentVersion = data && typeof data.version === 'number' ? data.version : 0;
    if (currentVersion !== meta.baseVersion) {
      throw new LayoutConflictError(data && typeof data.publishedBy === 'string' ? data.publishedBy : undefined);
    }
    const nextVersion = currentVersion + 1;
    const now = Timestamp.now();
    tx.set(
      pubRef,
      stripUndefinedDeep({
        id: pageId,
        schemaVersion: SCHEMA_VERSION,
        blocks,
        version: nextVersion,
        publishedAt: now,
        publishedBy: meta.uid,
        updatedAt: now,
      }),
    );
    tx.set(
      doc(pageLayoutRevisions(db, pageId), String(nextVersion)),
      stripUndefinedDeep({
        version: nextVersion,
        schemaVersion: SCHEMA_VERSION,
        blocks,
        createdAt: now,
        createdBy: meta.uid,
        createdByName: meta.name,
        source: meta.source ?? 'publish',
      }),
    );
    tx.delete(draftRef);
    return { version: nextVersion };
  });
  await pruneRevisions(db, pageId).catch(() => {});
  return result;
}

/**
 * Publish `blocks` immediately, bypassing the draft (back-compat public API —
 * kept for external consumers of `src/index.ts`). Reads the current version and
 * force-publishes on top of it.
 */
export async function savePageLayout(db: Firestore, pageId: string, blocks: PageBlock[]): Promise<void> {
  const current = await getPageLayout(db, pageId);
  await publishLayout(db, pageId, blocks, { baseVersion: current?.version ?? 0 });
}
