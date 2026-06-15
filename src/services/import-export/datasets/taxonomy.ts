import type { ProductCategoryDoc, ProductCollectionDoc } from '../../../types';
import {
  createCategory,
  listAllCategories,
  updateCategory,
  type CategoryWriteInput,
} from '../../category-service';
import {
  createProductCollection,
  listProductCollections,
  updateProductCollection,
  type ProductCollectionWriteInput,
} from '../../product-collection-service';
import {
  createBrand,
  listAllBrands,
  updateBrand,
  type BrandWriteInput,
} from '../../brand-service';
import {
  createTerm,
  listTerms,
  taxonomyTermId,
  updateTerm,
  type TaxonomyTermWriteInput,
} from '../../taxonomy-term-service';
import { GENERIC_TAXONOMY_IDS, TAXONOMY_BY_ID } from '../../../taxonomies/catalog';
import type { TaxonomyTermDoc } from '../../../types';
import { slugify } from '../../../utils/slugify';
import {
  applyWrites,
  duplicatePlan,
  invalidPlan,
  joinList,
  newPlan,
  parseBool,
  parseList,
  parseNumber,
} from '../helpers';
import type { ColumnMeta, DatasetDescriptor, RowPlan } from '../types';

// --- Categories -------------------------------------------------------------

interface CategoryPayload {
  input: CategoryWriteInput;
  explicitId?: string;
}

const categoryColumns: ColumnMeta[] = [
  { header: 'id', sample: '', help: 'Leave blank to create; fill to target an existing category.' },
  { header: 'name', required: true, sample: 'Outerwear' },
  { header: 'slug', sample: 'outerwear', help: 'Auto-generated from name when blank.' },
  { header: 'description', sample: 'Coats and jackets.' },
  { header: 'order', sample: '0' },
  { header: 'isActive', sample: 'true' },
  { header: 'isFeatured', sample: 'false' },
  { header: 'parentId', sample: '', help: 'Id of the parent category, or blank for a top-level one.' },
  { header: 'imageUrl', sample: '' },
];

export const CATEGORIES_DATASET: DatasetDescriptor = {
  id: 'categories',
  labelKey: 'admin.importExport.dataset.categories',
  descriptionKey: 'admin.importExport.dataset.categories.desc',
  canExport: true,
  canImport: true,
  columns: categoryColumns,

  async exportMatrix(db) {
    const cats = await listAllCategories(db);
    return cats.map((c) => [
      c.id,
      c.name,
      c.slug,
      c.description ?? '',
      c.order ?? 0,
      c.isActive ?? true,
      c.isFeatured ?? false,
      c.parentId ?? '',
      c.imageUrl ?? '',
    ]);
  },

  async analyzeRows(db, records) {
    const existing = await listAllCategories(db);
    const byId = new Map(existing.map((c) => [c.id, c]));
    const bySlug = new Map<string, ProductCategoryDoc>();
    for (const c of existing) if (c.slug) bySlug.set(c.slug, c);

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const name = (rec.name ?? '').trim();
      if (!name) return invalidPlan(row, 'Missing required value: name');
      const slug = (rec.slug ?? '').trim() || slugify(name);
      const input: CategoryWriteInput = {
        name,
        slug,
        order: parseNumber(rec.order) ?? 0,
        isActive: parseBool(rec.isActive, true),
        isFeatured: parseBool(rec.isFeatured, false),
        ...(rec.description?.trim() ? { description: rec.description.trim() } : {}),
        ...(rec.parentId?.trim() ? { parentId: rec.parentId.trim() } : {}),
        ...(rec.imageUrl?.trim() ? { imageUrl: rec.imageUrl.trim() } : {}),
      };
      const explicitId = (rec.id ?? '').trim() || undefined;
      const payload: CategoryPayload = { input, explicitId };
      let match = explicitId ? byId.get(explicitId) : undefined;
      if (!match) match = bySlug.get(slug);
      const key = explicitId ?? slug;
      return match
        ? duplicatePlan(row, key, name, match.id, payload, ['skip', 'overwrite', 'create'])
        : newPlan(row, key, name, payload);
    });
  },

  applyRows: (db, decided) =>
    applyWrites(decided, async (payload: CategoryPayload, action, existingId, isNew) => {
      if (action === 'overwrite' && existingId) {
        await updateCategory(db, existingId, payload.input);
        return { status: 'updated', key: existingId };
      }
      const id = await createCategory(db, payload.input, isNew ? payload.explicitId : undefined);
      return { status: 'created', key: id };
    }),
};

// --- Collections ------------------------------------------------------------

interface CollectionPayload {
  input: ProductCollectionWriteInput;
  explicitId?: string;
}

const collectionColumns: ColumnMeta[] = [
  { header: 'id', sample: '', help: 'Leave blank to create; fill to target an existing collection.' },
  { header: 'name', required: true, sample: 'Summer Edit' },
  { header: 'slug', sample: 'summer-edit', help: 'Auto-generated from name when blank.' },
  { header: 'description', sample: 'Our warm-weather picks.' },
  { header: 'imageUrl', sample: '' },
  { header: 'productIds', sample: 'abc123;def456', help: 'Product document ids, separated by ;' },
  { header: 'isActive', sample: 'true' },
  { header: 'isFeatured', sample: 'false' },
  { header: 'order', sample: '0' },
];

export const COLLECTIONS_DATASET: DatasetDescriptor = {
  id: 'collections',
  labelKey: 'admin.importExport.dataset.collections',
  descriptionKey: 'admin.importExport.dataset.collections.desc',
  canExport: true,
  canImport: true,
  columns: collectionColumns,

  async exportMatrix(db) {
    const list = await listProductCollections(db);
    return list.map((c) => [
      c.id,
      c.name,
      c.slug,
      c.description ?? '',
      c.imageUrl ?? '',
      joinList(c.productIds),
      c.isActive ?? true,
      c.isFeatured ?? false,
      c.order ?? 0,
    ]);
  },

  async analyzeRows(db, records) {
    const existing = await listProductCollections(db);
    const byId = new Map(existing.map((c) => [c.id, c]));
    const bySlug = new Map<string, ProductCollectionDoc>();
    for (const c of existing) if (c.slug) bySlug.set(c.slug, c);

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const name = (rec.name ?? '').trim();
      if (!name) return invalidPlan(row, 'Missing required value: name');
      const slug = (rec.slug ?? '').trim() || slugify(name);
      const input: ProductCollectionWriteInput = {
        name,
        slug,
        productIds: parseList(rec.productIds),
        isActive: parseBool(rec.isActive, true),
        isFeatured: parseBool(rec.isFeatured, false),
        order: parseNumber(rec.order) ?? 0,
        ...(rec.description?.trim() ? { description: rec.description.trim() } : {}),
        ...(rec.imageUrl?.trim() ? { imageUrl: rec.imageUrl.trim() } : {}),
      };
      const explicitId = (rec.id ?? '').trim() || undefined;
      const payload: CollectionPayload = { input, explicitId };
      let match = explicitId ? byId.get(explicitId) : undefined;
      if (!match) match = bySlug.get(slug);
      const key = explicitId ?? slug;
      return match
        ? duplicatePlan(row, key, name, match.id, payload, ['skip', 'overwrite', 'create'])
        : newPlan(row, key, name, payload);
    });
  },

  applyRows: (db, decided) =>
    applyWrites(decided, async (payload: CollectionPayload, action, existingId, isNew) => {
      if (action === 'overwrite' && existingId) {
        await updateProductCollection(db, existingId, payload.input);
        return { status: 'updated', key: existingId };
      }
      const id = await createProductCollection(db, payload.input, isNew ? payload.explicitId : undefined);
      return { status: 'created', key: id };
    }),
};

// --- Brands -----------------------------------------------------------------

interface BrandPayload {
  input: BrandWriteInput;
  explicitId?: string;
}

const brandColumns: ColumnMeta[] = [
  { header: 'id', sample: '', help: 'Defaults to a slug of the name when blank.' },
  { header: 'name', required: true, sample: 'Acme' },
  { header: 'isActive', sample: 'true' },
];

export const BRANDS_DATASET: DatasetDescriptor = {
  id: 'brands',
  labelKey: 'admin.importExport.dataset.brands',
  descriptionKey: 'admin.importExport.dataset.brands.desc',
  canExport: true,
  canImport: true,
  columns: brandColumns,

  async exportMatrix(db) {
    const brands = await listAllBrands(db);
    return brands.map((b) => [b.id, b.name, b.isActive ?? true]);
  },

  async analyzeRows(db, records) {
    const existing = await listAllBrands(db);
    const byId = new Map(existing.map((b) => [b.id, b]));
    const byLowerName = new Map(existing.map((b) => [b.name.trim().toLowerCase(), b]));

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const name = (rec.name ?? '').trim();
      if (!name) return invalidPlan(row, 'Missing required value: name');
      const input: BrandWriteInput = { name, isActive: parseBool(rec.isActive, true) };
      const explicitId = (rec.id ?? '').trim() || undefined;
      const computedId = explicitId ?? slugify(name);
      const payload: BrandPayload = { input, explicitId };
      const match = byId.get(computedId) ?? byLowerName.get(name.toLowerCase());
      // Brand ids are derived from the name, so "create new" would collide — only skip/overwrite.
      return match
        ? duplicatePlan(row, computedId, name, match.id, payload, ['skip', 'overwrite'])
        : newPlan(row, computedId, name, payload);
    });
  },

  applyRows: (db, decided) =>
    applyWrites(decided, async (payload: BrandPayload, action, existingId) => {
      if (action === 'overwrite' && existingId) {
        await updateBrand(db, existingId, payload.input);
        return { status: 'updated', key: existingId };
      }
      const id = await createBrand(db, payload.input, payload.explicitId);
      return { status: 'created', key: id };
    }),
};

// --- Generic taxonomy terms -------------------------------------------------

interface TaxonomyTermPayload {
  type: string;
  input: TaxonomyTermWriteInput;
  computedId: string;
}

const taxonomyTermColumns: ColumnMeta[] = [
  {
    header: 'type',
    required: true,
    sample: 'materials',
    help: `Taxonomy id. One of: ${GENERIC_TAXONOMY_IDS.join(', ')}.`,
  },
  { header: 'name', required: true, sample: 'Cotton' },
  { header: 'slug', sample: 'cotton', help: 'Auto-generated from name when blank.' },
  { header: 'isActive', sample: 'true' },
  { header: 'order', sample: '0' },
];

export const TAXONOMY_TERMS_DATASET: DatasetDescriptor = {
  id: 'taxonomy-terms',
  labelKey: 'admin.importExport.dataset.taxonomy-terms',
  descriptionKey: 'admin.importExport.dataset.taxonomy-terms.desc',
  canExport: true,
  canImport: true,
  columns: taxonomyTermColumns,

  async exportMatrix(db) {
    const perType = await Promise.all(GENERIC_TAXONOMY_IDS.map((type) => listTerms(db, type)));
    return perType
      .flat()
      .map((term) => [term.type, term.name, term.slug, term.isActive ?? true, term.order ?? 0]);
  },

  async analyzeRows(db, records) {
    const perType = await Promise.all(GENERIC_TAXONOMY_IDS.map((type) => listTerms(db, type)));
    const byId = new Map<string, TaxonomyTermDoc>();
    for (const term of perType.flat()) byId.set(term.id, term);

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const type = (rec.type ?? '').trim();
      if (!type) return invalidPlan(row, 'Missing required value: type');
      if (!(type in TAXONOMY_BY_ID) || !GENERIC_TAXONOMY_IDS.includes(type)) {
        return invalidPlan(row, `Unknown taxonomy type: ${type}`);
      }
      const name = (rec.name ?? '').trim();
      if (!name) return invalidPlan(row, 'Missing required value: name');
      const slug = (rec.slug ?? '').trim() || slugify(name);
      const computedId = taxonomyTermId(type, slug);
      const order = parseNumber(rec.order);
      const input: TaxonomyTermWriteInput = {
        name,
        slug,
        isActive: parseBool(rec.isActive, true),
        ...(typeof order === 'number' ? { order } : {}),
      };
      const payload: TaxonomyTermPayload = { type, input, computedId };
      const match = byId.get(computedId);
      // Ids are derived from type+slug, so "create new" would collide — only skip/overwrite.
      return match
        ? duplicatePlan(row, computedId, `${type}: ${name}`, match.id, payload, ['skip', 'overwrite'])
        : newPlan(row, computedId, `${type}: ${name}`, payload);
    });
  },

  applyRows: (db, decided) =>
    applyWrites(decided, async (payload: TaxonomyTermPayload, action, existingId) => {
      if (action === 'overwrite' && existingId) {
        await updateTerm(db, existingId, payload.input);
        return { status: 'updated', key: existingId };
      }
      const id = await createTerm(db, payload.type, payload.input, payload.computedId);
      return { status: 'created', key: id };
    }),
};
