import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BuilderPage } from '../types';
import { caspianCollections } from '../firebase/collections';
import { cloneWithNewIds } from '../page-builder/block-factory';
import { getPageTemplate } from '../page-builder/page-templates';
import { getDraftLayout, getPageLayout, saveDraftLayout } from './page-layout-service';

/**
 * Registry of page-builder pages beyond the homepage (v9.4 Phase 3). A
 * `builderPages/{slug}` doc names the page (slug, title, draft/published); its
 * block layout lives in `pageLayouts/{slug}`. The router resolves a URL slug to
 * one of these; /admin/pages manages them.
 */

function toBuilderPage(id: string, data: Record<string, unknown>): BuilderPage {
  return {
    id,
    slug: typeof data.slug === 'string' ? data.slug : id,
    title: typeof data.title === 'string' ? data.title : id,
    status: data.status === 'published' ? 'published' : 'draft',
    updatedAt: data.updatedAt as BuilderPage['updatedAt'],
  };
}

export async function getBuilderPage(db: Firestore, slug: string): Promise<BuilderPage | null> {
  const snap = await getDoc(doc(db, 'builderPages', slug));
  return snap.exists() ? toBuilderPage(snap.id, snap.data()) : null;
}

export async function listBuilderPages(db: Firestore): Promise<BuilderPage[]> {
  const snap = await getDocs(query(caspianCollections(db).builderPages, orderBy('updatedAt', 'desc')));
  return snap.docs.map((d) => toBuilderPage(d.id, d.data()));
}

/**
 * Create a page (slug + title), starting as a draft. When `templateId` names a
 * starter template, its blocks seed the page's DRAFT layout (unpublished until
 * the admin publishes); otherwise the page starts empty.
 */
export async function createBuilderPage(
  db: Firestore,
  input: { slug: string; title: string; templateId?: string },
): Promise<void> {
  await setDoc(doc(db, 'builderPages', input.slug), {
    slug: input.slug,
    title: input.title,
    status: 'draft',
    updatedAt: Timestamp.now(),
  });
  const template = input.templateId ? getPageTemplate(input.templateId) : null;
  const blocks = template ? template.build() : [];
  if (blocks.length > 0) {
    await saveDraftLayout(db, input.slug, blocks, { baseDraftRev: 0, baseVersion: 0 });
  }
}

/**
 * Duplicate a page's content into a NEW draft page. Copies the source's draft
 * (its latest edits) if present, else its published layout, regenerating every
 * block id so the copy is fully independent. The copy starts unpublished.
 */
export async function duplicateBuilderPage(
  db: Firestore,
  sourceSlug: string,
  target: { slug: string; title: string },
): Promise<void> {
  const [draft, published] = await Promise.all([
    getDraftLayout(db, sourceSlug),
    getPageLayout(db, sourceSlug),
  ]);
  const source = draft?.blocks ?? published?.blocks ?? [];
  const blocks = source.map(cloneWithNewIds);
  await setDoc(doc(db, 'builderPages', target.slug), {
    slug: target.slug,
    title: target.title,
    status: 'draft',
    updatedAt: Timestamp.now(),
  });
  if (blocks.length > 0) {
    await saveDraftLayout(db, target.slug, blocks, { baseDraftRev: 0, baseVersion: 0 });
  }
}

export async function updateBuilderPage(
  db: Firestore,
  slug: string,
  patch: Partial<Pick<BuilderPage, 'title' | 'status'>>,
): Promise<void> {
  await updateDoc(doc(db, 'builderPages', slug), { ...patch, updatedAt: Timestamp.now() });
}

/** Delete the page registry doc, its published layout, and its working draft. */
export async function deleteBuilderPage(db: Firestore, slug: string): Promise<void> {
  await deleteDoc(doc(db, 'builderPages', slug));
  await deleteDoc(doc(db, 'pageLayouts', slug)).catch(() => {});
  await deleteDoc(doc(db, 'pageLayoutDrafts', slug)).catch(() => {});
}
