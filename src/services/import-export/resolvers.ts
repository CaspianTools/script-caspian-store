import type { Firestore } from 'firebase/firestore';
import { createBrand, listAllBrands } from '../brand-service';
import { createCategory, listAllCategories } from '../category-service';
import { createTerm, listTerms } from '../taxonomy-term-service';
import { slugify } from '../../utils/slugify';

/**
 * Resolve a brand/category reference (an id, a name, or a slug) to a document
 * id, auto-creating the doc when the reference doesn't exist yet. Built once
 * per import run so repeated references reuse the same created doc — mirrors
 * the spirit of `migrateLegacyBrandStrings`.
 */
export interface NameResolver {
  resolve: (ref: string) => Promise<string>;
}

export async function makeBrandResolver(db: Firestore): Promise<NameResolver> {
  const brands = await listAllBrands(db);
  const byId = new Set(brands.map((b) => b.id));
  const byLowerName = new Map(brands.map((b) => [b.name.trim().toLowerCase(), b.id]));
  return {
    async resolve(ref) {
      const value = ref.trim();
      if (!value) return '';
      if (byId.has(value)) return value;
      const lower = value.toLowerCase();
      const existing = byLowerName.get(lower);
      if (existing) return existing;
      const id = await createBrand(db, { name: value, isActive: true });
      byId.add(id);
      byLowerName.set(lower, id);
      return id;
    },
  };
}

export async function makeCategoryResolver(db: Firestore): Promise<NameResolver> {
  const cats = await listAllCategories(db);
  const byId = new Set(cats.map((c) => c.id));
  const byLower = new Map<string, string>();
  for (const c of cats) {
    byLower.set(c.name.trim().toLowerCase(), c.id);
    if (c.slug) byLower.set(c.slug.trim().toLowerCase(), c.id);
  }
  return {
    async resolve(ref) {
      const value = ref.trim();
      if (!value) return '';
      if (byId.has(value)) return value;
      const lower = value.toLowerCase();
      const existing = byLower.get(lower);
      if (existing) return existing;
      const slug = slugify(value);
      const id = await createCategory(db, { name: value, slug, order: 0, isActive: true });
      byId.add(id);
      byLower.set(lower, id);
      if (slug) byLower.set(slug, id);
      return id;
    },
  };
}

/**
 * Resolve a generic taxonomy term reference (a term id, name, or slug) to a
 * `taxonomyTerms` doc id under `type`, auto-creating the term when it doesn't
 * exist yet. One resolver per taxonomy type per import run.
 */
export async function makeTaxonomyTermResolver(
  db: Firestore,
  type: string,
): Promise<NameResolver> {
  const terms = await listTerms(db, type);
  const byId = new Set(terms.map((t) => t.id));
  const byLower = new Map<string, string>();
  for (const t of terms) {
    byLower.set(t.name.trim().toLowerCase(), t.id);
    if (t.slug) byLower.set(t.slug.trim().toLowerCase(), t.id);
  }
  return {
    async resolve(ref) {
      const value = ref.trim();
      if (!value) return '';
      if (byId.has(value)) return value;
      const lower = value.toLowerCase();
      const existing = byLower.get(lower);
      if (existing) return existing;
      const id = await createTerm(db, type, { name: value, isActive: true });
      byId.add(id);
      byLower.set(lower, id);
      return id;
    },
  };
}
