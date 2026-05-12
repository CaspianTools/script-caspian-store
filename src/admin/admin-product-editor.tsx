'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductBrandDoc, ProductCategoryDoc, ProductImage } from '../types';
import {
  createProduct,
  getProductById,
  updateProduct,
  type ProductWriteInput,
} from '../services/product-service';
import { listActiveBrands } from '../services/brand-service';
import { listAllCategories } from '../services/category-service';
import { slugify } from '../utils/slugify';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { ImageUploadField } from '../ui/image-upload-field';
import { Input, Label, Textarea } from '../ui/input';
import { Skeleton } from '../ui/misc';
import { RichTextEditor } from '../ui/rich-text-editor';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';

export interface AdminProductEditorProps {
  /** Pass a product id to edit an existing product. Omit to create. */
  productId?: string;
  /** Where to go after save. Default: `/admin/products`. */
  afterSaveHref?: string;
  className?: string;
}

interface FormState {
  name: string;
  /** URL-safe slug. Auto-filled from `name` on blur when empty; admin-editable. */
  slug: string;
  /**
   * Brand document id (not the display name). Mirrors `category` — the
   * dropdown writes a `productBrands` doc id; legacy products created
   * before v8.4 may store a free-text brand name here, in which case the
   * editor synthesises a "(legacy — not migrated)" option to preserve
   * the value until an admin reselects or runs the migration banner on
   * `/admin/brands`.
   */
  brand: string;
  description: string;
  shortDescription: string;
  /** Rich-text HTML produced by `<RichTextEditor>`. Sanitized on render. */
  details: string;
  price: string;
  /** Category document id (not the display name). */
  category: string;
  sizes: string; // comma-separated
  /**
   * Per-size stock counts as input strings (so the field can render an empty value).
   * Coerced to integers on save and persisted to `Product.stock`. Added in v2.9.
   */
  sizeStock: Record<string, string>;
  color: string;
  /** Weight in kg as a string so the input can render an empty field; coerced on save. */
  weightKg: string;
  isNew: boolean;
  limited: boolean;
  isActive: boolean;
  images: ProductImage[];
}

const empty: FormState = {
  name: '',
  slug: '',
  brand: '',
  description: '',
  shortDescription: '',
  details: '',
  price: '0',
  category: '',
  sizes: '',
  sizeStock: {},
  color: '',
  weightKg: '',
  isNew: false,
  limited: false,
  isActive: true,
  images: [],
};

function parseSizeList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Maximum number of images a product can carry. The storefront treats
 * `images[0]` as the featured image (product card thumbnail + initial slot in
 * `<ProductGallery>`), so the admin's chosen featured image is whichever one
 * sits at index 0 after drag-reorder / "Make featured".
 */
const MAX_PRODUCT_IMAGES = 10;

/**
 * Fixed palette of named product colors. Keep in sync with the storefront
 * swatch rendering if you add custom renderers. If you need brand-specific
 * colors later, swap this for a Firestore-backed `productColors` collection.
 */
const COLOR_PALETTE = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Purple',
  'Orange',
  'Brown',
  'Grey',
  'Beige',
  'Multi',
] as const;

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— No color —' },
  ...COLOR_PALETTE.map((c) => ({ value: c, label: c })),
];

/**
 * Accepts a legacy stored color string (any case) and returns the matching
 * palette entry, or `''` if it doesn't match. Callers should still render the
 * legacy value in a small hint if non-empty but unmatched.
 */
function normalizeLegacyColor(raw: string): string {
  if (!raw) return '';
  const match = COLOR_PALETTE.find(
    (c) => c.toLowerCase() === raw.toLowerCase(),
  );
  return match ?? '';
}

/**
 * Builds category Select options indented by depth via an em-dash prefix.
 * Example: `"Shoes"`, `"— Sneakers"`, `"—— Low-top"`. Inactive categories
 * are surfaced because admins need to reassign products off of them.
 */
function buildCategoryOptions(
  categories: ProductCategoryDoc[],
): { value: string; label: string }[] {
  const byParent = new Map<string, ProductCategoryDoc[]>();
  for (const cat of categories) {
    const key = cat.parentId ?? '__root__';
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }
  for (const [, list] of byParent) list.sort((a, b) => a.order - b.order);

  const out: { value: string; label: string }[] = [
    { value: '', label: '— Uncategorised —' },
  ];
  const walk = (parentKey: string, depth: number) => {
    const children = byParent.get(parentKey) ?? [];
    for (const cat of children) {
      const prefix = depth === 0 ? '' : '— '.repeat(depth);
      const inactiveTag = cat.isActive === false ? ' (hidden)' : '';
      out.push({ value: cat.id, label: `${prefix}${cat.name}${inactiveTag}` });
      walk(cat.id, depth + 1);
    }
  };
  walk('__root__', 0);
  return out;
}

export function AdminProductEditor({
  productId,
  afterSaveHref = '/admin/products',
  className,
}: AdminProductEditorProps) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ProductCategoryDoc[]>([]);
  const [brands, setBrands] = useState<ProductBrandDoc[] | null>(null);
  const [legacyColor, setLegacyColor] = useState<string>('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [categoryList, brandList] = await Promise.all([
          listAllCategories(db),
          listActiveBrands(db),
        ]);
        if (!alive) return;
        setCategories(categoryList);
        setBrands(brandList);
      } catch (error) {
        console.error('[caspian-store] Failed to load editor reference data:', error);
        if (alive) setBrands([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    (async () => {
      try {
        const p = await getProductById(db, productId);
        if (!alive) return;
        if (!p) {
          toast({ title: 'Product not found', variant: 'destructive' });
          return;
        }
        const normalizedColor = normalizeLegacyColor(p.color ?? '');
        if (!normalizedColor && p.color) setLegacyColor(p.color);
        const sizeList = p.sizes ?? [];
        const sizeStock: Record<string, string> = {};
        for (const size of sizeList) {
          const qty = p.stock?.[size];
          sizeStock[size] = qty === undefined ? '' : String(qty);
        }
        setForm({
          name: p.name,
          slug: p.slug ?? '',
          brand: p.brand,
          description: p.description,
          shortDescription: p.shortDescription ?? '',
          details: p.details ?? '',
          price: String(p.price),
          category: p.category,
          sizes: sizeList.join(', '),
          sizeStock,
          color: normalizedColor,
          weightKg: p.weightKg !== undefined ? String(p.weightKg) : '',
          isNew: Boolean(p.isNew),
          limited: Boolean(p.limited),
          isActive: p.isActive !== false,
          images: p.images,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, productId, toast]);

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories),
    [categories],
  );

  const brandsLoaded = brands !== null;
  const knownBrandIds = useMemo(
    () => new Set((brands ?? []).map((b) => b.id)),
    [brands],
  );
  const brandIsLegacyUnknown =
    brandsLoaded && form.brand !== '' && !knownBrandIds.has(form.brand);

  const brandOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [
      { value: '', label: '— Select brand —' },
    ];
    for (const b of brands ?? []) {
      out.push({ value: b.id, label: b.name });
    }
    if (brandIsLegacyUnknown) {
      out.push({
        value: form.brand,
        label: `${form.brand} (legacy — not migrated)`,
      });
    }
    return out;
  }, [brands, brandIsLegacyUnknown, form.brand]);

  const legacyCategoryUnknown =
    productId &&
    form.category &&
    categories.length > 0 &&
    !categories.some((c) => c.id === form.category);

  const handleAddImageUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setForm((s) => {
      if (s.images.length >= MAX_PRODUCT_IMAGES) {
        toast({
          title: `Maximum of ${MAX_PRODUCT_IMAGES} images per product`,
          variant: 'destructive',
        });
        return s;
      }
      return {
        ...s,
        images: [...s.images, { id, url: trimmed, alt: s.name, hint: s.name }],
      };
    });
  };

  const handleAddUrlClick = () => {
    if (!newImageUrl.trim()) return;
    handleAddImageUrl(newImageUrl);
    setNewImageUrl('');
  };

  const handleRemoveImage = (id: string) => {
    setForm((s) => ({ ...s, images: s.images.filter((img) => img.id !== id) }));
  };

  const handleMakeFeatured = (id: string) => {
    setForm((s) => {
      const idx = s.images.findIndex((img) => img.id === id);
      if (idx <= 0) return s;
      const next = s.images.slice();
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return { ...s, images: next };
    });
  };

  const handleDragStart = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingId(id);
    // Required for Firefox to start a drag; payload itself is unused.
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOverTile = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnTile = (targetId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null);
    if (!sourceId || sourceId === targetId) return;
    setForm((s) => {
      const from = s.images.findIndex((img) => img.id === sourceId);
      const to = s.images.findIndex((img) => img.id === targetId);
      if (from === -1 || to === -1 || from === to) return s;
      const next = s.images.slice();
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return { ...s, images: next };
    });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.brand.trim()) {
      toast({ title: 'Name and brand are required', variant: 'destructive' });
      return;
    }
    const priceNum = Number(form.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast({ title: 'Enter a valid price', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const weightTrimmed = form.weightKg.trim();
      let weightKg: number | undefined;
      if (weightTrimmed !== '') {
        const parsed = Number(weightTrimmed);
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast({ title: 'Enter a valid weight (kg)', variant: 'destructive' });
          setSaving(false);
          return;
        }
        weightKg = parsed;
      }
      const shortDescTrimmed = form.shortDescription.trim();
      const detailsTrimmed = form.details.trim();
      const cleanSizes = parseSizeList(form.sizes);
      // Persist stock entries only for sizes that actually exist on the product,
      // so stale rows can't pile up after sizes are renamed/removed.
      const stockMap: Record<string, number> = {};
      let hasAnyStock = false;
      for (const size of cleanSizes) {
        const raw = (form.sizeStock[size] ?? '').trim();
        if (raw === '') continue;
        const qty = Math.max(0, Math.floor(Number(raw)));
        if (Number.isFinite(qty)) {
          stockMap[size] = qty;
          hasAnyStock = true;
        }
      }
      const payload: ProductWriteInput = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        brand: form.brand.trim(),
        description: form.description.trim(),
        shortDescription: shortDescTrimmed || undefined,
        details: detailsTrimmed || undefined,
        price: priceNum,
        category: form.category,
        sizes: cleanSizes,
        stock: hasAnyStock ? stockMap : undefined,
        color: form.color,
        weightKg,
        isNew: form.isNew,
        limited: form.limited,
        isActive: form.isActive,
        images: form.images,
      };
      if (productId) {
        await updateProduct(db, productId, payload);
        toast({ title: 'Product updated' });
      } else {
        await createProduct(db, payload);
        toast({ title: 'Product created' });
      }
      nav.push(afterSaveHref);
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 24, width: 200 }} />
        <Skeleton style={{ height: 14, width: '100%' }} />
        <Skeleton style={{ height: 14, width: '80%' }} />
      </div>
    );
  }

  return (
    <div className={className} style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
        {productId ? 'Edit product' : 'New product'}
      </h1>

      <section style={sectionStyle}>
        <div style={gridStyle}>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              onBlur={() =>
                setForm((s) => (s.slug ? s : { ...s, slug: slugify(s.name) }))
              }
            />
          </Field>
          <Field label="Brand">
            <Select
              value={form.brand}
              onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))}
              options={brandOptions}
              disabled={!brandsLoaded}
              style={{ width: '100%' }}
            />
            {brandIsLegacyUnknown && (
              <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                Stored brand <code>{form.brand}</code> doesn&apos;t match any brand record. Pick
                one from the list — or run <em>Migrate now</em> on the Brands page to clean up
                every legacy product at once.
              </p>
            )}
          </Field>
        </div>
        <Field label="URL slug">
          <Input
            value={form.slug}
            onChange={(e) =>
              setForm((s) => ({ ...s, slug: e.target.value.toLowerCase() }))
            }
            placeholder="auto-generated from name on save"
          />
          <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Used in the product URL: <code>/product/{form.slug || 'your-slug-here'}</code>.
            Leave blank to auto-generate from the name. Changing an existing slug
            will break old links — only edit if you really mean to.
          </p>
        </Field>
        <Field label="Description">
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          />
        </Field>
        <Field label="Short description (PDP hero blurb)">
          <Textarea
            rows={2}
            placeholder="Punchy 1–3 line pitch shown above Add to Cart. Falls back to the first paragraph of Description when empty."
            value={form.shortDescription}
            onChange={(e) => setForm((s) => ({ ...s, shortDescription: e.target.value }))}
            maxLength={280}
          />
        </Field>
        <Field label="Details (bullets, specs, dimensions)">
          <RichTextEditor
            value={form.details}
            onChange={(html) => setForm((s) => ({ ...s, details: html }))}
            placeholder="Dimensions, materials, finish, compatibility, care instructions — use the bullet button to list specs."
            ariaLabel="Product details"
            minHeight={140}
          />
        </Field>
        <div style={gridStyle}>
          <Field label="Price">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
            />
          </Field>
          <Field label="Weight (kg)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.weightKg}
              onChange={(e) => setForm((s) => ({ ...s, weightKg: e.target.value }))}
              placeholder="Leave blank unless using weight-based shipping"
            />
          </Field>
        </div>
        <div style={gridStyle}>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
              options={categoryOptions}
              style={{ width: '100%' }}
            />
            {legacyCategoryUnknown && (
              <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                Stored category <code>{form.category}</code> doesn&apos;t match any known
                category. Pick one from the list and save to migrate this product.
              </p>
            )}
          </Field>
        </div>
        <div style={gridStyle}>
          <Field label="Sizes (comma-separated)">
            <Input
              value={form.sizes}
              onChange={(e) => setForm((s) => ({ ...s, sizes: e.target.value }))}
              placeholder="S, M, L, XL"
            />
          </Field>
          <Field label="Color">
            <Select
              value={form.color}
              onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
              options={COLOR_OPTIONS}
              style={{ width: '100%' }}
            />
            {legacyColor && (
              <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                Stored color <code>{legacyColor}</code> isn&apos;t in the palette. Pick
                the closest match from the list and save to normalise.
              </p>
            )}
          </Field>
        </div>
        <ProductStockGrid
          sizes={parseSizeList(form.sizes)}
          values={form.sizeStock}
          onChange={(size, value) =>
            setForm((s) => ({ ...s, sizeStock: { ...s.sizeStock, [size]: value } }))
          }
        />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Check label="New arrival" checked={form.isNew} onChange={(v) => setForm((s) => ({ ...s, isNew: v }))} />
          <Check label="Limited edition" checked={form.limited} onChange={(v) => setForm((s) => ({ ...s, limited: v }))} />
          <Check label="Active (visible in store)" checked={form.isActive} onChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>
          Images ({form.images.length} / {MAX_PRODUCT_IMAGES})
        </h2>
        <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
          The first image is the featured image shown on the storefront. Drag thumbnails
          to reorder, or click <strong>Make featured</strong> to promote one to the front.
          Files land under <code>products/{productId ?? 'new'}/</code> in Firebase Storage.
        </p>
        {form.images.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {form.images.map((img, i) => {
              const isFeatured = i === 0;
              const isDragging = draggingId === img.id;
              return (
                <div
                  key={img.id}
                  draggable
                  onDragStart={handleDragStart(img.id)}
                  onDragOver={handleDragOverTile}
                  onDrop={handleDropOnTile(img.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    position: 'relative',
                    aspectRatio: '3 / 4',
                    background: '#f5f5f5',
                    borderRadius: 6,
                    overflow: 'hidden',
                    cursor: 'grab',
                    opacity: isDragging ? 0.4 : 1,
                    outline: isFeatured ? '2px solid var(--caspian-primary, #111)' : 'none',
                    outlineOffset: isFeatured ? -2 : 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt}
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  />
                  {isFeatured && (
                    <span
                      aria-label="Featured image"
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--caspian-primary, #111)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        lineHeight: 1.4,
                      }}
                    >
                      ★ Featured
                    </span>
                  )}
                  {!isFeatured && (
                    <button
                      type="button"
                      onClick={() => handleMakeFeatured(img.id)}
                      aria-label="Make this image the featured image"
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: 0,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 11,
                        cursor: 'pointer',
                        lineHeight: 1.4,
                      }}
                    >
                      Make featured
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    aria-label="Remove image"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: 0,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {form.images.length < MAX_PRODUCT_IMAGES ? (
          <>
            <ImageUploadField
              value=""
              onChange={handleAddImageUrl}
              storagePath={`products/${productId ?? 'new'}`}
              label={form.images.length === 0 ? 'First image' : 'Add another image'}
              aspectRatio="3 / 4"
              previewMaxWidth={180}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Label style={{ fontSize: 12, color: '#666' }}>or paste image URL</Label>
                <Input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUrlClick();
                    }
                  }}
                  placeholder="https://…"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddUrlClick}
                disabled={!newImageUrl.trim()}
              >
                Add URL
              </Button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
            Maximum of {MAX_PRODUCT_IMAGES} images reached. Remove one to add another.
          </p>
        )}
      </section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={() => nav.push(afterSaveHref)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          {saving ? 'Saving…' : productId ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ProductStockGrid({
  sizes,
  values,
  onChange,
}: {
  sizes: string[];
  values: Record<string, string>;
  onChange: (size: string, value: string) => void;
}) {
  if (sizes.length === 0) {
    return (
      <Field label="Stock per size">
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
          Add at least one size above to track stock per size.
        </p>
      </Field>
    );
  }
  return (
    <Field label="Stock per size">
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 8px' }}>
        Number of units available for each size. Leave blank to mark a size as untracked
        (always available).
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
        }}
      >
        {sizes.map((size) => (
          <label
            key={size}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 'var(--caspian-radius, 6px)',
              padding: '6px 10px',
              background: '#fff',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#444',
                minWidth: 32,
              }}
            >
              {size}
            </span>
            <Input
              type="number"
              min={0}
              value={values[size] ?? ''}
              placeholder="—"
              onChange={(e) => onChange(size, e.target.value)}
              style={{ flex: 1 }}
            />
          </label>
        ))}
      </div>
    </Field>
  );
}

const sectionStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
  marginTop: 16,
  marginBottom: 16,
};
const h2Style: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 12 };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
