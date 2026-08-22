import type { Product, ProductImage } from '../../../types';
import {
  createProduct,
  listAllProducts,
  updateProduct,
  type ProductWriteInput,
} from '../../product-service';
import { listAllBrands } from '../../brand-service';
import { listAllCategories } from '../../category-service';
import { listTerms } from '../../taxonomy-term-service';
import { GENERIC_TAXONOMY_IDS } from '../../../taxonomies/catalog';
import {
  makeBrandResolver,
  makeCategoryResolver,
  makeTaxonomyTermResolver,
  type NameResolver,
} from '../resolvers';
import {
  duplicatePlan,
  errMsg,
  invalidPlan,
  joinList,
  joinStock,
  newPlan,
  parseBool,
  parseList,
  parseNumber,
  parseStock,
  summarize,
} from '../helpers';
import type {
  ColumnMeta,
  DatasetDescriptor,
  DecidedRow,
  RowPlan,
  RowResult,
} from '../types';

/**
 * Generic taxonomies that get a CSV column here — every generic taxonomy except
 * `sizes`, which already has its own `sizes`/`stock` columns. Brand is handled
 * by the `brand` column. Each column holds `;`-separated term names that
 * round-trip via {@link makeTaxonomyTermResolver}.
 */
const TAXONOMY_COLUMN_IDS = GENERIC_TAXONOMY_IDS.filter((id) => id !== 'sizes');

interface ProductPayload {
  base: ProductWriteInput;
  brandRef: string;
  categoryRef: string;
  /** taxonomy id → raw term name/id/slug refs from the CSV cell. */
  taxonomyRefs: Record<string, string[]>;
  explicitId?: string;
}

const columns: ColumnMeta[] = [
  { header: 'id', sample: '', help: 'Leave blank to create a new product; fill to target an existing one.' },
  { header: 'name', required: true, sample: 'Black Leather Jacket' },
  { header: 'slug', sample: 'black-leather-jacket', help: 'Auto-generated from name when blank.' },
  { header: 'brand', sample: 'Acme', help: 'Brand name or id — created automatically if it does not exist.' },
  { header: 'sku', sample: 'JKT-001' },
  {
    header: 'barcode',
    sample: '5901234123457',
    help: 'Scannable EAN / UPC / Code 128 payload. This is what the POS register looks up first.',
  },
  { header: 'shortDescription', sample: 'A timeless wardrobe staple.' },
  { header: 'description', sample: 'Full-grain leather, fully lined.' },
  { header: 'details', sample: '' },
  { header: 'price', required: true, sample: '199' },
  { header: 'category', sample: 'Outerwear', help: 'Category name or id — created automatically if it does not exist.' },
  { header: 'sizes', sample: 'S;M;L', help: 'Separated by ;' },
  { header: 'color', sample: 'Black', help: 'Legacy single color (pre-taxonomy). Prefer the colors column.' },
  { header: 'weightKg', sample: '1.2' },
  { header: 'stock', sample: 'S:3;M:5;L:0', help: 'size:quantity pairs, separated by ;' },
  { header: 'isActive', sample: 'true', help: 'Whether the product is visible on the storefront.' },
  { header: 'isNew', sample: 'false' },
  { header: 'limited', sample: 'false' },
  { header: 'images', sample: 'https://example.com/jacket.jpg', help: 'Public image URLs, separated by ; (stored as-is).' },
  ...TAXONOMY_COLUMN_IDS.map(
    (id): ColumnMeta => ({
      header: id,
      sample: '',
      help: `"${id}" taxonomy term names, separated by ; — created automatically if missing (only applied when the taxonomy is enabled).`,
    }),
  ),
];

function buildPayload(rec: Record<string, string>): { payload: ProductPayload } | { error: string } {
  const name = (rec.name ?? '').trim();
  if (!name) return { error: 'Missing required value: name' };
  const price = parseNumber(rec.price);
  if (price === null) return { error: 'Missing or invalid price' };

  const slug = (rec.slug ?? '').trim() || undefined;
  const sizes = parseList(rec.sizes);
  const stock = parseStock(rec.stock);
  const weightKg = parseNumber(rec.weightKg);
  const images: ProductImage[] = parseList(rec.images).map((url, idx) => ({
    id: `img-${idx + 1}`,
    url,
    alt: name,
    hint: '',
  }));

  const base: ProductWriteInput = {
    name,
    brand: '', // resolved at apply time
    description: (rec.description ?? '').trim(),
    price,
    images,
    category: '', // resolved at apply time
    isActive: parseBool(rec.isActive, true),
    isNew: parseBool(rec.isNew, false),
    limited: parseBool(rec.limited, false),
    ...(slug ? { slug } : {}),
    ...(rec.sku?.trim() ? { sku: rec.sku.trim() } : {}),
    ...(rec.barcode?.trim() ? { barcode: rec.barcode.trim() } : {}),
    ...(rec.shortDescription?.trim() ? { shortDescription: rec.shortDescription.trim() } : {}),
    ...(rec.details?.trim() ? { details: rec.details.trim() } : {}),
    ...(sizes.length ? { sizes } : {}),
    ...(rec.color?.trim() ? { color: rec.color.trim() } : {}),
    ...(weightKg !== null ? { weightKg } : {}),
    ...(Object.keys(stock).length ? { stock } : {}),
  };

  const taxonomyRefs: Record<string, string[]> = {};
  for (const id of TAXONOMY_COLUMN_IDS) {
    const refs = parseList(rec[id]);
    if (refs.length) taxonomyRefs[id] = refs;
  }

  return {
    payload: {
      base,
      brandRef: (rec.brand ?? '').trim(),
      categoryRef: (rec.category ?? '').trim(),
      taxonomyRefs,
      explicitId: (rec.id ?? '').trim() || undefined,
    },
  };
}

export const PRODUCTS_DATASET: DatasetDescriptor = {
  id: 'products',
  labelKey: 'admin.importExport.dataset.products',
  descriptionKey: 'admin.importExport.dataset.products.desc',
  canExport: true,
  canImport: true,
  columns,

  async exportMatrix(db) {
    const [products, brands, categories, ...termLists] = await Promise.all([
      listAllProducts(db),
      listAllBrands(db),
      listAllCategories(db),
      ...TAXONOMY_COLUMN_IDS.map((id) => listTerms(db, id)),
    ]);
    const brandName = new Map(brands.map((b) => [b.id, b.name]));
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    // Per-taxonomy term id → name maps, aligned with TAXONOMY_COLUMN_IDS.
    const termNameByType = new Map<string, Map<string, string>>();
    TAXONOMY_COLUMN_IDS.forEach((id, i) => {
      termNameByType.set(id, new Map(termLists[i].map((t) => [t.id, t.name])));
    });
    return products.map((p) => [
      p.id,
      p.name,
      p.slug ?? '',
      brandName.get(p.brand) ?? p.brand,
      p.sku ?? '',
      p.barcode ?? '',
      p.shortDescription ?? '',
      p.description ?? '',
      p.details ?? '',
      p.price,
      catName.get(p.category) ?? p.category,
      joinList(p.sizes),
      p.color ?? '',
      p.weightKg ?? '',
      joinStock(p.stock),
      p.isActive ?? true,
      p.isNew ?? false,
      p.limited ?? false,
      joinList(p.images.map((i) => i.url)),
      ...TAXONOMY_COLUMN_IDS.map((id) => {
        const names = termNameByType.get(id)!;
        return joinList((p.taxonomies?.[id] ?? []).map((tid) => names.get(tid) ?? tid));
      }),
    ]);
  },

  async analyzeRows(db, records) {
    const existing = await listAllProducts(db);
    const byId = new Map(existing.map((p) => [p.id, p]));
    const bySlug = new Map<string, Product>();
    for (const p of existing) if (p.slug) bySlug.set(p.slug, p);

    return records.map((rec, idx): RowPlan => {
      const row = idx + 1;
      const built = buildPayload(rec);
      if ('error' in built) return invalidPlan(row, built.error, (rec.name ?? '').trim());
      const { payload } = built;
      const slug = payload.base.slug;
      let match = payload.explicitId ? byId.get(payload.explicitId) : undefined;
      if (!match && slug) match = bySlug.get(slug);
      const key = payload.explicitId ?? slug ?? null;
      const name = payload.base.name;
      return match
        ? duplicatePlan(row, key, name, match.id, payload, ['skip', 'overwrite', 'create'])
        : newPlan(row, key, name, payload);
    });
  },

  async applyRows(db, decided: DecidedRow[]) {
    const brandResolver = await makeBrandResolver(db);
    const categoryResolver = await makeCategoryResolver(db);
    // Built lazily per taxonomy type — only for types that actually appear.
    const termResolvers = new Map<string, NameResolver>();
    const getTermResolver = async (type: string): Promise<NameResolver> => {
      let resolver = termResolvers.get(type);
      if (!resolver) {
        resolver = await makeTaxonomyTermResolver(db, type);
        termResolvers.set(type, resolver);
      }
      return resolver;
    };
    const results: RowResult[] = [];
    for (const { plan, action } of decided) {
      if (plan.kind === 'invalid') {
        results.push({ row: plan.row, status: 'error', message: plan.error });
        continue;
      }
      if (action === 'skip') {
        results.push({ row: plan.row, status: 'skipped', key: plan.key ?? undefined });
        continue;
      }
      try {
        const p = plan.payload as ProductPayload;
        const brand = await brandResolver.resolve(p.brandRef);
        const category = await categoryResolver.resolve(p.categoryRef);
        const taxonomies: Record<string, string[]> = {};
        for (const [type, refs] of Object.entries(p.taxonomyRefs)) {
          if (!refs.length) continue;
          const resolver = await getTermResolver(type);
          const ids: string[] = [];
          for (const ref of refs) {
            const id = await resolver.resolve(ref);
            if (id) ids.push(id);
          }
          if (ids.length) taxonomies[type] = ids;
        }
        const input: ProductWriteInput = {
          ...p.base,
          brand,
          category,
          ...(Object.keys(taxonomies).length ? { taxonomies } : {}),
        };
        if (action === 'overwrite' && plan.existingId) {
          await updateProduct(db, plan.existingId, input);
          results.push({ row: plan.row, status: 'updated', key: plan.existingId });
        } else {
          const id = await createProduct(db, input, plan.kind === 'new' ? p.explicitId : undefined);
          results.push({ row: plan.row, status: 'created', key: id });
        }
      } catch (err) {
        results.push({ row: plan.row, status: 'error', message: errMsg(err) });
      }
    }
    return summarize(results);
  },
};
