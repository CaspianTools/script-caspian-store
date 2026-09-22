import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { SearchTerm } from '../types';

const MAX_TERM_LENGTH = 120;

function docToSearchTerm(snap: QueryDocumentSnapshot): SearchTerm {
  const data = snap.data();
  return {
    id: snap.id,
    term: data.term ?? snap.id,
    count: typeof data.count === 'number' ? data.count : 0,
    firstSearchedAt: data.firstSearchedAt,
    lastSearchedAt: data.lastSearchedAt,
  };
}

/**
 * Normalize a raw search query into a stable Firestore doc id + display term.
 * Lowercases, trims, collapses whitespace, strips `/` (illegal in doc ids),
 * and caps length. Returns null for empty input.
 */
export function normalizeSearchTerm(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TERM_LENGTH);
  // `.`, `..` and `__x__` are reserved document ids; `doc()` throws on them.
  if (cleaned === '.' || cleaned === '..' || /^__.*__$/.test(cleaned)) return null;
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Record a customer search. Upserts a `searchTerms/{normalized}` doc with a
 * monotonically increasing count and timestamps. Fire-and-forget from UI —
 * catch + console.warn so a rules denial or network blip never breaks the
 * actual search navigation.
 */
export async function logSearchTerm(db: Firestore, rawTerm: string): Promise<void> {
  const term = normalizeSearchTerm(rawTerm);
  if (!term) return;
  const ref = doc(db, 'searchTerms', term);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, {
      count: increment(1),
      lastSearchedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      term,
      count: 1,
      firstSearchedAt: serverTimestamp(),
      lastSearchedAt: serverTimestamp(),
    });
  }
}

export type SearchTermSortBy = 'count' | 'lastSearchedAt';

export async function listSearchTerms(
  db: Firestore,
  options: { sortBy?: SearchTermSortBy } = {},
): Promise<SearchTerm[]> {
  const sortBy: SearchTermSortBy = options.sortBy ?? 'count';
  const q = query(caspianCollections(db).searchTerms, orderBy(sortBy, 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToSearchTerm);
}

export async function deleteSearchTerm(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'searchTerms', id));
}

export async function clearAllSearchTerms(db: Firestore): Promise<number> {
  const snap = await getDocs(caspianCollections(db).searchTerms);
  if (snap.empty) return 0;
  // A write batch holds at most 500 operations.
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}
