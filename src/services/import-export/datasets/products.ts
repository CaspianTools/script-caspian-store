import type { Product, ProductImage } from '../../../types';
import {
  createProduct,
  listAllProducts,
  updateProduct,
  type ProductWriteInput,
} from '../../product-service';
import { listAllBrands } from '../../brand-service';
import { listAllCategories } from '../../category-service';
import { makeBrandResolver, makeCategoryResolver } from '../resolvers';
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

interface ProductPayload {
  base: ProductWriteInput;
  brandRef: string;
  categoryRef: string;
  explicitId?: string;
}

const columns: ColumnMeta[] = [
  { header: 'id', sample: '', help: 'Leave blank to create a new product; fill to target an existing one.' },
  { header: 'name', required: true, sample: 'Black Leather Jacket' },
  { header: 'slug', sample: 'black-leather-jacket', help: 'Auto-generated from name when blank.' },
  { header: 'brand', sample: 'Acme', help: 'Brand name or id — created automatically if it does not exist.' },
  { header: 'sku', sample: 'JKT-001' },
  { header: 'shortDescription', sample: 'A timeless wardrobe staple.' },
  { header: 'description', sample: 'Full-grain leather, fully lined.' },
  { header: 'details', sample: '' },
  { header: 'price', required: true, sample: '199' },
  { header: 'category', sample: 'Outerwear', help: 'Category name or id — created automatically if it does not exist.' },
  { header: 'sizes', sample: 'S;M;L', help: 'Separated by ;' },
  { header: 'color', sample: 'Black' },
  { header: 'weightKg', sample: '1.2' },
  { header: 'stock', sample: 'S:3;M:5;L:0', help: 'size:quantity pairs, separated by ;' },
  { header: 'isActive', sample: 'true', help: 'Whether the product is visible on the storefront.' },
  { header: 'isNew', sample: 'false' },
  { header: 'limited', sample: 'false' },
  { header: 'images', sample: 'https://example.com/jacket.jpg', help: 'Public image URLs, separated by ; (stored as-is).' },
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
    ...(rec.shortDescription?.trim() ? { shortDescription: rec.shortDescription.trim() } : {}),
    ...(rec.details?.trim() ? { details: rec.details.trim() } : {}),
    ...(sizes.length ? { sizes } : {}),
    ...(rec.color?.trim() ? { color: rec.color.trim() } : {}),
    ...(weightKg !== null ? { weightKg } : {}),
    ...(Object.keys(stock).length ? { stock } : {}),
  };

  return {
    payload: {
      base,
      brandRef: (rec.brand ?? '').trim(),
      categoryRef: (rec.category ?? '').trim(),
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
    const [products, brands, categories] = await Promise.all([
      listAllProducts(db),
      listAllBrands(db),
      listAllCategories(db),
    ]);
    const brandName = new Map(brands.map((b) => [b.id, b.name]));
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    return products.map((p) => [
      p.id,
      p.name,
      p.slug ?? '',
      brandName.get(p.brand) ?? p.brand,
      p.sku ?? '',
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
        const input: ProductWriteInput = { ...p.base, brand, category };
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
