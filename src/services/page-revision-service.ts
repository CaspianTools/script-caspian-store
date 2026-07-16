import { doc, getDoc, getDocs, orderBy, query, type Firestore } from 'firebase/firestore';
import type { PageBlock, PageRevisionMeta } from '../types';
import { pageLayoutRevisions } from '../firebase/collections';

/**
 * Read access to a page's published-layout revision history
 * (`pageLayouts/{id}/revisions`, admin-only). Snapshots are written on publish
 * by `publishLayout`; restoring loads a version's blocks back into the editor's
 * draft (see the editor context), so a restore is previewed then re-published
 * rather than clobbering the live page.
 */

export async function listRevisions(db: Firestore, pageId: string): Promise<PageRevisionMeta[]> {
  const snap = await getDocs(query(pageLayoutRevisions(db, pageId), orderBy('version', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      version: typeof data.version === 'number' ? data.version : Number(d.id),
      createdAt: data.createdAt,
      createdByName: typeof data.createdByName === 'string' ? data.createdByName : undefined,
      source: data.source === 'restore' ? 'restore' : 'publish',
    };
  });
}

export async function getRevisionBlocks(
  db: Firestore,
  pageId: string,
  version: number,
): Promise<PageBlock[] | null> {
  const snap = await getDoc(doc(pageLayoutRevisions(db, pageId), String(version)));
  if (!snap.exists()) return null;
  const data = snap.data();
  return Array.isArray(data.blocks) ? (data.blocks as PageBlock[]) : [];
}
