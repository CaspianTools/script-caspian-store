'use client';

import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { deleteField } from 'firebase/firestore';
import type {
  ColorVariant,
  ProductBrandDoc,
  ProductCategoryDoc,
  ProductImage,
  TaxonomyTermDoc,
} from '../types';
import {
  createProduct,
  getProductById,
  updateProduct,
  type ProductUpdateInput,
  type ProductWriteInput,
} from '../services/product-service';
import { listAllBrands } from '../services/brand-service';
import { listAllCategories } from '../services/category-service';
import { getSiteSettings } from '../services/site-settings-service';
import { createTerm, listActiveTerms } from '../services/taxonomy-term-service';
import { refreshTaxonomyTermsCache } from '../hooks/use-taxonomy-terms';
import {
  enabledTaxonomyDefs,
  resolveEnabledTaxonomies,
  TAXONOMY_BY_ID,
} from '../taxonomies/catalog';
import type { TaxonomyDef } from '../taxonomies/types';
import { cn } from '../utils/cn';
import { slugify } from '../utils/slugify';
import { useT } from '../i18n/locale-context';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { ImageUploadField } from '../ui/image-upload-field';
import { Input, Label, Textarea } from '../ui/input';
import { Skeleton } from '../ui/misc';
import { RichTextEditor } from '../ui/rich-text-editor';
import { Select } from '../ui/select';
import { useToast } from '../ui/toast';
import { MultiSelect, type MultiSelectItem } from './admin-multi-select';
import { isValidImageUrl, validateProductDraft } from './product-validation';

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
   * `/admin/brands`. Inactive brands are listed as "(hidden)" so a product
   * on one is never mistaken for a legacy string.
   */
  brand: string;
  /** Optional stock-keeping unit. Free text; not enforced unique. */
  sku: string;
  barcode: string;
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
  /** Legacy single-color value (pre-taxonomy). Preserved on save; no longer edited — superseded by `taxonomies.colors`. */
  color: string;
  /** Generic-taxonomy assignments: taxonomy id → term ids. Edited in the Attributes section. */
  taxonomies: Record<string, string[]>;
  /** Weight in kg as a string so the input can render an empty field; coerced on save. */
  weightKg: string;
  isNew: boolean;
  limited: boolean;
  isActive: boolean;
  images: ProductImage[];
  /** Image-swatch colour variants (`Product.colorVariants`), in display order. */
  colorVariants: ColorVariantDraft[];
}

/** A colour variant plus a client-only React key (stripped on save). */
interface ColorVariantDraft extends ColorVariant {
  key: string;
}

const newVariantKey = () => `cv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type EditorMode = 'full' | 'steps';
const EDITOR_MODE_KEY = 'caspian:admin:productEditorMode';

/** Step-by-step mode: Basic info → Details → Review. */
const STEP_KEYS = ['basic', 'details', 'review'] as const;
const REVIEW_STEP = STEP_KEYS.length - 1;

/** Top-level validation fields rendered on the Basic info step; everything
 *  else (images, stock, colour variants) lives on Details. */
const BASIC_STEP_FIELDS = new Set(['name', 'brand', 'price', 'weightKg', 'category', 'description']);
function stepOfField(key: string): number {
  return BASIC_STEP_FIELDS.has(key.split('.')[0]) ? 0 : 1;
}

const empty: FormState = {
  name: '',
  slug: '',
  brand: '',
  sku: '',
  barcode: '',
  description: '',
  shortDescription: '',
  details: '',
  price: '0',
  category: '',
  sizes: '',
  sizeStock: {},
  color: '',
  taxonomies: {},
  weightKg: '',
  isNew: false,
  limited: false,
  isActive: true,
  images: [],
  colorVariants: [],
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

/** Generic taxonomies the Attributes section renders as term pickers — every
 *  enabled taxonomy except Brand (its own single-select + collection) and Sizes
 *  (owned by the comma-separated Sizes field + per-size stock grid). */
function isAttributeTaxonomy(def: TaxonomyDef): boolean {
  return def.kind === 'generic' && def.id !== 'sizes';
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
  // A category whose parent no longer exists (deleted before v-current
  // re-parented children, or imported with a bad id) is unreachable from
  // the root walk. Surface it at top level rather than dropping it.
  const seen = new Set(out.map((o) => o.value));
  for (const cat of categories) {
    if (seen.has(cat.id)) continue;
    const inactiveTag = cat.isActive === false ? ' (hidden)' : '';
    out.push({ value: cat.id, label: `${cat.name}${inactiveTag}` });
  }
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
  const t = useT();
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(Boolean(productId));
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ProductCategoryDoc[]>([]);
  const [brands, setBrands] = useState<ProductBrandDoc[] | null>(null);
  /** Enabled taxonomy ids (catalog-resolved). `null` until site settings load. */
  const [enabledTaxonomyIds, setEnabledTaxonomyIds] = useState<string[] | null>(null);
  /** Active terms per attribute taxonomy id, loaded for the enabled taxonomies. */
  const [taxonomyTermsByType, setTaxonomyTermsByType] = useState<Record<string, TaxonomyTermDoc[]>>({});
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageUrlInvalid, setNewImageUrlInvalid] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Inline errors stay hidden until the first Save / Next attempt. */
  const [showErrors, setShowErrors] = useState(false);
  /** Bumped to ask the post-render effect to focus the first invalid field. */
  const [focusRequest, setFocusRequest] = useState(0);
  const [mode, setMode] = useState<EditorMode>('full');
  const [step, setStep] = useState(0);
  /** Highest step reached — the stepper only jumps back or to reached steps. */
  const [furthestStep, setFurthestStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Remembered layout preference. Read after mount so SSR markup matches.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(EDITOR_MODE_KEY) === 'steps') setMode('steps');
    } catch {
      // Storage blocked (private mode, sandboxed iframe) — keep the default.
    }
  }, []);

  const changeMode = (next: EditorMode) => {
    setMode(next);
    setStep(0);
    setFurthestStep(0);
    try {
      window.localStorage.setItem(EDITOR_MODE_KEY, next);
    } catch {
      // Non-fatal: the choice just isn't remembered.
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      // Load each source independently — one failing query (e.g. a missing
      // composite index on a fresh project) must not blank the other dropdown.
      const [cats, brs, settings] = await Promise.allSettled([
        listAllCategories(db),
        listAllBrands(db),
        getSiteSettings(db),
      ]);
      if (!alive) return;
      const pick = <T,>(r: PromiseSettledResult<T[]>, label: string): T[] => {
        if (r.status === 'fulfilled') return r.value;
        console.error(`[caspian-store] editor reference data: ${label} failed to load`, r.reason);
        return [];
      };
      setCategories(pick(cats, 'categories'));
      setBrands(pick(brs, 'brands'));

      // Enabled taxonomies + their active terms drive the Attributes section.
      const enabledIds = resolveEnabledTaxonomies(
        settings.status === 'fulfilled' ? settings.value?.enabledTaxonomies : undefined,
      );
      setEnabledTaxonomyIds(enabledIds);
      const attrIds = enabledIds.filter((id) => {
        const def = TAXONOMY_BY_ID[id];
        return def ? isAttributeTaxonomy(def) : false;
      });
      const termResults = await Promise.allSettled(attrIds.map((id) => listActiveTerms(db, id)));
      if (!alive) return;
      const termsByType: Record<string, TaxonomyTermDoc[]> = {};
      attrIds.forEach((id, i) => {
        const r = termResults[i];
        if (r.status === 'fulfilled') termsByType[id] = r.value;
        else {
          console.error(`[caspian-store] editor: terms for "${id}" failed to load`, r.reason);
          termsByType[id] = [];
        }
      });
      setTaxonomyTermsByType(termsByType);
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
          setNotFound(true);
          return;
        }
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
          sku: p.sku ?? '',
          barcode: p.barcode ?? '',
          description: p.description,
          shortDescription: p.shortDescription ?? '',
          details: p.details ?? '',
          price: String(p.price),
          category: p.category,
          sizes: sizeList.join(', '),
          sizeStock,
          color: p.color ?? '',
          taxonomies: p.taxonomies ?? {},
          weightKg: p.weightKg !== undefined ? String(p.weightKg) : '',
          isNew: Boolean(p.isNew),
          limited: Boolean(p.limited),
          isActive: p.isActive !== false,
          images: p.images,
          colorVariants: (p.colorVariants ?? []).map((v) => ({
            key: newVariantKey(),
            name: v.name ?? '',
            imageUrl: v.imageUrl ?? '',
          })),
        });
      } catch (error) {
        console.error('[caspian-store] Failed to load product:', error);
        if (!alive) return;
        toast({ title: t('admin.loadFailed'), variant: 'destructive' });
        setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      out.push({ value: b.id, label: b.isActive === false ? `${b.name} (hidden)` : b.name });
    }
    if (brandIsLegacyUnknown) {
      out.push({
        value: form.brand,
        label: `${form.brand} (legacy — not migrated)`,
      });
    }
    return out;
  }, [brands, brandIsLegacyUnknown, form.brand]);

  // Enabled taxonomy defs in catalog order — drives the Attributes section.
  const enabledDefs = useMemo(
    () => (enabledTaxonomyIds ? enabledTaxonomyDefs(enabledTaxonomyIds) : []),
    [enabledTaxonomyIds],
  );
  const taxonomyItemsByType = useMemo(() => {
    const out: Record<string, MultiSelectItem[]> = {};
    for (const [type, terms] of Object.entries(taxonomyTermsByType)) {
      out[type] = terms.map((term) => ({ id: term.id, name: term.name }));
    }
    return out;
  }, [taxonomyTermsByType]);

  const setTaxonomyPicked = (type: string, ids: string[]) =>
    setForm((s) => ({ ...s, taxonomies: { ...s.taxonomies, [type]: ids } }));

  const handleCreateTaxonomyTerm = async (type: string, raw: string) => {
    const name = raw.trim();
    if (!name) return;
    // Reuse an existing term (case-insensitive) rather than creating a duplicate.
    const existing = (taxonomyTermsByType[type] ?? []).find(
      (term) => term.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      setForm((s) => {
        const cur = s.taxonomies[type] ?? [];
        if (cur.includes(existing.id)) return s;
        return { ...s, taxonomies: { ...s.taxonomies, [type]: [...cur, existing.id] } };
      });
      return;
    }
    try {
      const id = await createTerm(db, type, { name, isActive: true });
      refreshTaxonomyTermsCache(type);
      setTaxonomyTermsByType((prev) => {
        const list = prev[type] ?? [];
        if (list.some((term) => term.id === id)) return prev;
        const next = [
          ...list,
          { id, type, name, slug: '', isActive: true, createdAt: null as never },
        ];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return { ...prev, [type]: next };
      });
      setForm((s) => {
        const cur = s.taxonomies[type] ?? [];
        if (cur.includes(id)) return s;
        return { ...s, taxonomies: { ...s.taxonomies, [type]: [...cur, id] } };
      });
    } catch (error) {
      console.error('[caspian-store] Create taxonomy term failed:', error);
      toast({ title: 'Could not create term', variant: 'destructive' });
    }
  };

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
    if (!isValidImageUrl(newImageUrl)) {
      setNewImageUrlInvalid(true);
      return;
    }
    handleAddImageUrl(newImageUrl);
    setNewImageUrl('');
    setNewImageUrlInvalid(false);
  };

  const updateVariant = (index: number, patch: Partial<ColorVariant>) =>
    setForm((s) => ({
      ...s,
      colorVariants: s.colorVariants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));

  const addVariant = () =>
    setForm((s) => ({
      ...s,
      colorVariants: [...s.colorVariants, { key: newVariantKey(), name: '', imageUrl: '' }],
    }));

  const removeVariant = (index: number) =>
    setForm((s) => ({ ...s, colorVariants: s.colorVariants.filter((_, i) => i !== index) }));

  const moveVariant = (index: number, delta: -1 | 1) =>
    setForm((s) => {
      const to = index + delta;
      if (to < 0 || to >= s.colorVariants.length) return s;
      const next = s.colorVariants.slice();
      const [picked] = next.splice(index, 1);
      next.splice(to, 0, picked);
      return { ...s, colorVariants: next };
    });

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

  // Live validation; messages render only once `showErrors` is set.
  const errors = useMemo(() => {
    const stock: Record<string, string> = {};
    for (const size of parseSizeList(form.sizes)) stock[size] = form.sizeStock[size] ?? '';
    return validateProductDraft({
      name: form.name,
      brand: form.brand,
      price: form.price,
      weightKg: form.weightKg,
      description: form.description,
      category: form.category,
      images: form.images,
      stock,
      colorVariants: form.colorVariants,
    });
  }, [form]);
  const err = (key: string): string | undefined =>
    showErrors && errors[key] ? t(errors[key]) : undefined;

  // Focus the first invalid field in DOM order once the (possibly new) step
  // has rendered.
  useEffect(() => {
    if (focusRequest === 0) return;
    const root = rootRef.current;
    if (!root) return;
    const target = Array.from(root.querySelectorAll<HTMLElement>('[data-field]')).find(
      (el) => errors[el.dataset.field ?? ''],
    );
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
    // Only re-run on an explicit request, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const revealErrors = () => {
    setShowErrors(true);
    setFocusRequest((n) => n + 1);
  };

  /** First step (below `upTo`) that still has an invalid field, or -1. */
  const firstInvalidStepBefore = (upTo: number): number => {
    const steps = Object.keys(errors).map(stepOfField).filter((i) => i < upTo);
    return steps.length ? Math.min(...steps) : -1;
  };

  const goToStep = (target: number) => {
    if (target > step) {
      // Moving forward validates every step being skipped over.
      const blocked = firstInvalidStepBefore(target);
      if (blocked !== -1) {
        setStep(blocked);
        revealErrors();
        return;
      }
    }
    setStep(target);
    setFurthestStep((f) => Math.max(f, target));
    rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      if (mode === 'steps') setStep(firstInvalidStepBefore(REVIEW_STEP));
      revealErrors();
      toast({ title: t('admin.products.validation.fixErrors'), variant: 'destructive' });
      return;
    }
    const priceNum = Number(form.price);

    setSaving(true);
    try {
      const weightTrimmed = form.weightKg.trim();
      const weightKg = weightTrimmed === '' ? undefined : Number(weightTrimmed);
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
      const cleanedTaxonomies: Record<string, string[]> = {};
      for (const [type, ids] of Object.entries(form.taxonomies)) {
        if (ids && ids.length > 0) cleanedTaxonomies[type] = ids;
      }
      const colorVariants: ColorVariant[] = form.colorVariants.map((v) => ({
        name: v.name.trim(),
        imageUrl: v.imageUrl.trim(),
      }));
      const payload: ProductWriteInput = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        brand: form.brand.trim(),
        sku: form.sku.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        description: form.description.trim(),
        shortDescription: shortDescTrimmed || undefined,
        details: detailsTrimmed || undefined,
        price: priceNum,
        category: form.category,
        sizes: cleanSizes,
        stock: hasAnyStock ? stockMap : undefined,
        color: form.color || undefined,
        colorVariants: colorVariants.length ? colorVariants : undefined,
        taxonomies: Object.keys(cleanedTaxonomies).length ? cleanedTaxonomies : undefined,
        weightKg,
        isNew: form.isNew,
        limited: form.limited,
        isActive: form.isActive,
        images: form.images,
      };
      if (productId) {
        // A blank optional field means "remove it": `undefined` would be
        // stripped from the update and the stored value would survive.
        const update: ProductUpdateInput = {
          ...payload,
          sku: payload.sku ?? deleteField(),
          barcode: payload.barcode ?? deleteField(),
          shortDescription: payload.shortDescription ?? deleteField(),
          details: payload.details ?? deleteField(),
          weightKg: payload.weightKg ?? deleteField(),
          color: payload.color ?? deleteField(),
          colorVariants: payload.colorVariants ?? deleteField(),
          taxonomies: payload.taxonomies ?? deleteField(),
          stock: payload.stock ?? deleteField(),
        };
        await updateProduct(db, productId, update);
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

  if (notFound) {
    return (
      <div className={className} style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.products.notFound')}</h1>
        <p style={{ color: '#666', marginTop: 8 }}>{t('admin.products.notFoundHint')}</p>
        <Button variant="outline" onClick={() => nav.push(afterSaveHref)}>
          {t('admin.products.backToProducts')}
        </Button>
      </div>
    );
  }

  const saveLabel = saving ? 'Saving…' : productId ? 'Save changes' : 'Create product';
  const isStepMode = mode === 'steps';
  const onReview = isStepMode && step === REVIEW_STEP;
  const primaryAction =
    isStepMode && !onReview
      ? { label: t('admin.products.steps.next'), onClick: () => goToStep(step + 1) }
      : { label: saveLabel, onClick: handleSave };

  // Section bodies are declared once and placed by the layout below — the full
  // form stacks them all; step-by-step mode shows the current step's slice.
  const basicFields = (
    <>
      <div className="caspian-admin-grid-2" style={gridStyle}>
        <Field label="Name" fieldKey="name" error={err('name')}>
          <Input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            onBlur={() =>
              setForm((s) => (s.slug ? s : { ...s, slug: slugify(s.name) }))
            }
          />
        </Field>
        <Field label="Brand" fieldKey="brand" error={err('brand')}>
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
      <Field label="SKU">
        <Input
          value={form.sku}
          onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))}
          placeholder="Stock-keeping unit (optional)"
        />
      </Field>
      <Field label="Barcode">
        <Input
          value={form.barcode}
          onChange={(e) => setForm((s) => ({ ...s, barcode: e.target.value }))}
          placeholder="Scan or type the barcode (optional)"
        />
        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          EAN, UPC, or Code 128. With the field focused, most USB scanners fill this in
          directly — just scan the product. This is what the POS register matches first.
        </p>
      </Field>
      <Field label="Description" fieldKey="description" error={err('description')}>
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
      <div className="caspian-admin-grid-2" style={gridStyle}>
        <Field label="Price" fieldKey="price" error={err('price')}>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
          />
        </Field>
        <Field label="Weight (kg)" fieldKey="weightKg" error={err('weightKg')}>
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
      <div className="caspian-admin-grid-2" style={gridStyle}>
        <Field label="Category" fieldKey="category" error={err('category')}>
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
    </>
  );

  const detailFields = (
    <>
      <Field label="Sizes (comma-separated)">
        <Input
          value={form.sizes}
          onChange={(e) => setForm((s) => ({ ...s, sizes: e.target.value }))}
          placeholder="S, M, L, XL"
        />
      </Field>
      <ProductStockGrid
        sizes={parseSizeList(form.sizes)}
        values={form.sizeStock}
        errorFor={(size) => err(`stock.${size}`)}
        onChange={(size, value) =>
          setForm((s) => ({ ...s, sizeStock: { ...s.sizeStock, [size]: value } }))
        }
      />
      {enabledTaxonomyIds !== null && enabledDefs.some(isAttributeTaxonomy) && (
        <div style={{ marginTop: 12 }}>
          <h2 style={h2Style}>Attributes</h2>
          {enabledDefs.filter(isAttributeTaxonomy).map((def) => {
            const label = t(def.labelKey);
            const picked = form.taxonomies[def.id] ?? [];
            return (
              <Field key={def.id} label={label}>
                <MultiSelect
                  items={taxonomyItemsByType[def.id] ?? []}
                  picked={new Set(picked)}
                  onChange={(next) => setTaxonomyPicked(def.id, [...next])}
                  label={
                    picked.length === 0
                      ? `Select ${label.toLowerCase()}`
                      : `Edit ${label.toLowerCase()}`
                  }
                  placeholder="Search or create…"
                  allowCreate
                  onCreate={(name) => void handleCreateTaxonomyTerm(def.id, name)}
                  indent={false}
                />
              </Field>
            );
          })}
          {form.color && enabledTaxonomyIds.includes('colors') && (
            <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
              Legacy color <code>{form.color}</code> — re-pick it under{' '}
              <strong>Colors</strong> above to migrate. The old value is kept until you do.
            </p>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Check label="New arrival" checked={form.isNew} onChange={(v) => setForm((s) => ({ ...s, isNew: v }))} />
        <Check label="Limited edition" checked={form.limited} onChange={(v) => setForm((s) => ({ ...s, limited: v }))} />
        <Check label="Active (visible in store)" checked={form.isActive} onChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
      </div>
    </>
  );

  const imagesSection = (
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
            const invalid = Boolean(err(`images.${i}`));
            return (
              <div
                key={img.id}
                data-field={`images.${i}`}
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
                  outline: invalid
                    ? '2px solid #b91c1c'
                    : isFeatured
                      ? '2px solid var(--caspian-primary, #111)'
                      : 'none',
                  outlineOffset: invalid || isFeatured ? -2 : 0,
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
      {showErrors && form.images.some((_, i) => errors[`images.${i}`]) && (
        <div style={{ marginBottom: 12 }}>
          <FieldError message={t('admin.products.validation.imagesInvalid')} />
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
                onChange={(e) => {
                  setNewImageUrl(e.target.value);
                  setNewImageUrlInvalid(false);
                }}
                aria-invalid={newImageUrlInvalid || undefined}
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
          {newImageUrlInvalid && (
            <FieldError message={t('admin.products.validation.imageUrlInvalid')} />
          )}
        </>
      ) : (
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          Maximum of {MAX_PRODUCT_IMAGES} images reached. Remove one to add another.
        </p>
      )}
    </section>
  );

  const colorsSection = (
    <section style={sectionStyle}>
      <h2 style={h2Style}>{t('admin.products.colors.title')}</h2>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
        {t('admin.products.colors.hint')}
      </p>
      {form.colorVariants.map((variant, i) => {
        const imageError = err(`colorVariants.${i}.imageUrl`);
        return (
          <div
            key={variant.key}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'flex-start',
              padding: 12,
              marginBottom: 8,
              border: '1px solid #eee',
              borderRadius: 'var(--caspian-radius, 6px)',
            }}
          >
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <Field
                label={t('admin.products.colors.name')}
                fieldKey={`colorVariants.${i}.name`}
                error={err(`colorVariants.${i}.name`)}
              >
                <Input
                  value={variant.name}
                  onChange={(e) => updateVariant(i, { name: e.target.value })}
                  placeholder={t('admin.products.colors.namePlaceholder')}
                />
              </Field>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => moveVariant(i, -1)}
                  disabled={i === 0}
                  aria-label={t('admin.products.colors.moveUp')}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => moveVariant(i, 1)}
                  disabled={i === form.colorVariants.length - 1}
                  aria-label={t('admin.products.colors.moveDown')}
                >
                  ↓
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeVariant(i)}>
                  {t('admin.products.colors.remove')}
                </Button>
              </div>
            </div>
            <div data-field={`colorVariants.${i}.imageUrl`} style={{ flex: '0 0 160px' }}>
              <ImageUploadField
                value={variant.imageUrl}
                onChange={(url) => updateVariant(i, { imageUrl: url })}
                storagePath={`products/${productId ?? 'new'}`}
                label={t('admin.products.colors.image')}
                aspectRatio="1 / 1"
                previewMaxWidth={160}
                allowUrlFallback
              />
              {imageError && <FieldError message={imageError} />}
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addVariant}>
        {t('admin.products.colors.add')}
      </Button>
    </section>
  );

  const reviewSizes = parseSizeList(form.sizes);
  const reviewSection = (
    <section style={sectionStyle}>
      <ReviewGroup
        title={t('admin.products.steps.basic')}
        editLabel={t('admin.products.steps.edit')}
        onEdit={() => goToStep(0)}
      >
        <ReviewRow label={t('admin.products.review.name')}>{form.name.trim()}</ReviewRow>
        <ReviewRow label={t('admin.products.review.price')}>{form.price.trim()}</ReviewRow>
        <ReviewRow label={t('admin.products.review.brand')}>
          {brands?.find((b) => b.id === form.brand)?.name ?? form.brand}
        </ReviewRow>
        <ReviewRow label={t('admin.products.review.category')}>
          {categories.find((c) => c.id === form.category)?.name ??
            (form.category || t('admin.products.review.uncategorised'))}
        </ReviewRow>
      </ReviewGroup>
      <ReviewGroup
        title={t('admin.products.steps.details')}
        editLabel={t('admin.products.steps.edit')}
        onEdit={() => goToStep(1)}
      >
        <ReviewRow label={t('admin.products.review.images')}>
          {form.images.length === 0 ? (
            t('admin.products.review.none')
          ) : (
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {form.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.url} alt={img.alt} style={reviewThumbStyle} />
              ))}
            </span>
          )}
        </ReviewRow>
        <ReviewRow label={t('admin.products.review.sizes')}>
          {reviewSizes.length === 0
            ? t('admin.products.review.none')
            : reviewSizes
                .map((size) => {
                  const qty = (form.sizeStock[size] ?? '').trim();
                  return `${size}: ${qty === '' ? t('admin.products.review.untracked') : qty}`;
                })
                .join(', ')}
        </ReviewRow>
        <ReviewRow label={t('admin.products.review.colors')}>
          {form.colorVariants.length === 0 ? (
            t('admin.products.review.none')
          ) : (
            <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {form.colorVariants.map((v) => (
                <span key={v.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.imageUrl} alt="" style={{ ...reviewThumbStyle, width: 28, height: 28 }} />
                  {v.name.trim()}
                </span>
              ))}
            </span>
          )}
        </ReviewRow>
        <ReviewRow label={t('admin.products.review.status')}>
          {t(form.isActive ? 'admin.products.review.active' : 'admin.products.review.hidden')}
        </ReviewRow>
      </ReviewGroup>
    </section>
  );

  return (
    <div ref={rootRef} className={cn('caspian-has-sticky-cta', className)} style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {productId ? 'Edit product' : 'New product'}
        </h1>
        <div role="group" aria-label={t('admin.products.mode.label')} style={{ display: 'flex', gap: 4 }}>
          {(['full', 'steps'] as const).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={mode === m ? 'primary' : 'outline'}
              aria-pressed={mode === m}
              onClick={() => changeMode(m)}
            >
              {t(`admin.products.mode.${m}`)}
            </Button>
          ))}
        </div>
      </div>

      {isStepMode ? (
        <>
          <ol style={stepperStyle}>
            {STEP_KEYS.map((key, i) => {
              const reachable = i <= furthestStep;
              const current = i === step;
              return (
                <li key={key} style={{ flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={!reachable || current}
                    aria-current={current ? 'step' : undefined}
                    style={{
                      width: '100%',
                      padding: '8px 4px',
                      border: 0,
                      borderBottom: `3px solid ${current ? 'var(--caspian-primary, #111)' : reachable ? '#bbb' : '#eee'}`,
                      background: 'transparent',
                      color: reachable ? 'inherit' : '#aaa',
                      fontWeight: current ? 600 : 400,
                      fontSize: 13,
                      cursor: reachable && !current ? 'pointer' : 'default',
                    }}
                  >
                    {i + 1}. {t(`admin.products.steps.${key}`)}
                  </button>
                </li>
              );
            })}
          </ol>
          {step === 0 && <section style={sectionStyle}>{basicFields}</section>}
          {step === 1 && (
            <>
              <section style={sectionStyle}>{detailFields}</section>
              {imagesSection}
              {colorsSection}
            </>
          )}
          {onReview && reviewSection}
        </>
      ) : (
        <>
          <section style={sectionStyle}>
            {basicFields}
            {detailFields}
          </section>
          {imagesSection}
          {colorsSection}
        </>
      )}

      <div className="caspian-hide-mobile" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={() => nav.push(afterSaveHref)} disabled={saving}>
          Cancel
        </Button>
        {isStepMode && step > 0 && (
          <Button variant="outline" onClick={() => goToStep(step - 1)} disabled={saving}>
            {t('admin.products.steps.back')}
          </Button>
        )}
        <Button onClick={primaryAction.onClick} loading={saving}>
          {primaryAction.label}
        </Button>
      </div>
      <div className="caspian-sticky-cta">
        <Button onClick={primaryAction.onClick} loading={saving}>
          {primaryAction.label}
        </Button>
        {isStepMode && step > 0 ? (
          <Button variant="ghost" onClick={() => goToStep(step - 1)} disabled={saving}>
            {t('admin.products.steps.back')}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => nav.push(afterSaveHref)} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Labelled form row. When the child is a single component (Input, Select,
 * Textarea…) it receives a generated `id` so the label is clickable and
 * announced by screen readers; plain markup children are rendered as-is.
 */
function Field({
  label,
  children,
  fieldKey,
  error,
}: {
  label: string;
  children: React.ReactNode;
  /** Validation path (see `validateProductDraft`) — lets the editor scroll to it. */
  fieldKey?: string;
  /** Resolved inline error message, shown under the control. */
  error?: string;
}) {
  const generatedId = useId();
  const bindable =
    isValidElement<{ id?: string; 'aria-invalid'?: boolean }>(children) &&
    typeof children.type !== 'string';
  const controlId = bindable ? children.props.id ?? generatedId : undefined;
  return (
    <div data-field={fieldKey} style={{ marginBottom: 12 }}>
      <Label htmlFor={controlId}>{label}</Label>
      {bindable
        ? cloneElement(children, { id: controlId, 'aria-invalid': error ? true : undefined })
        : children}
      {error && <FieldError message={error} />}
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

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" style={{ fontSize: 12, color: '#b91c1c', margin: '4px 0 0' }}>
      {message}
    </p>
  );
}

function ReviewGroup({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ ...h2Style, marginBottom: 0 }}>{title}</h2>
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          {editLabel}
        </Button>
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(100px, 30%) 1fr', gap: '6px 12px', fontSize: 14 }}>
        {children}
      </dl>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: '#666' }}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</dd>
    </>
  );
}

function ProductStockGrid({
  sizes,
  values,
  errorFor,
  onChange,
}: {
  sizes: string[];
  values: Record<string, string>;
  /** Resolved inline error for a size's stock cell, if any. */
  errorFor: (size: string) => string | undefined;
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
        className="caspian-stock-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
        }}
      >
        {sizes.map((size) => {
          const error = errorFor(size);
          return (
            <div key={size} data-field={`stock.${size}`}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: `1px solid ${error ? '#b91c1c' : 'rgba(0,0,0,0.1)'}`,
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
                  aria-invalid={error ? true : undefined}
                  style={{ flex: 1 }}
                />
              </label>
              {error && <FieldError message={error} />}
            </div>
          );
        })}
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
const stepperStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  listStyle: 'none',
  padding: 0,
  margin: '16px 0 0',
};
const reviewThumbStyle: React.CSSProperties = {
  width: 48,
  height: 64,
  objectFit: 'cover',
  borderRadius: 4,
  background: '#f5f5f5',
};
