'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductBrandDoc, ProductCategoryDoc } from '../types';
import { deleteProduct, listAllProducts } from '../services/product-service';
import { listAllBrands } from '../services/brand-service';
import { listAllCategories } from '../services/category-service';
import {
  useCaspianFirebase,
  useCaspianLink,
  useCaspianNavigation,
} from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { EditIcon, ExternalLinkIcon, MoreHorizontalIcon, TrashIcon } from '../ui/icons';
import { Input } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { Select } from '../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

export interface AdminProductsListProps {
  newProductHref?: string;
  getEditHref?: (productId: string) => string;
  /** Storefront PDP URL for "View on storefront". Default: `/product/{id}`. */
  getViewHref?: (productId: string) => string;
  formatPrice?: (n: number) => string;
  className?: string;
}

type StatusFilter = 'all' | 'active' | 'hidden';

export function AdminProductsList({
  newProductHref = '/admin/products/new',
  getEditHref = (id) => `/admin/products/${id}/edit`,
  getViewHref = (id) => `/product/${id}`,
  formatPrice = (n) => `$${n.toFixed(2)}`,
  className,
}: AdminProductsListProps) {
  const { db } = useCaspianFirebase();
  const Link = useCaspianLink();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategoryDoc[]>([]);
  const [brands, setBrands] = useState<ProductBrandDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'masonry'>('table');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [productList, categoryList, brandList] = await Promise.all([
        listAllProducts(db),
        listAllCategories(db),
        listAllBrands(db),
      ]);
      setProducts(productList);
      setCategories(categoryList);
      setBrands(brandList);
    } catch (error) {
      console.error('[caspian-store] Failed to load products:', error);
      toast({ title: 'Failed to load products', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [db, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const brandNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brands) map.set(b.id, b.name);
    return map;
  }, [brands]);

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All categories' },
      ...[...categories]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
      { value: '__unknown__', label: 'Unresolved (legacy names)' },
    ],
    [categories],
  );

  const brandOptions = useMemo(
    () => [
      { value: '', label: 'All brands' },
      ...[...brands].map((b) => ({ value: b.id, label: b.name })),
      { value: '__unknown__', label: 'Unresolved (legacy text)' },
    ],
    [brands],
  );

  const resolveCategoryLabel = useCallback(
    (stored: string): string => {
      if (!stored) return '—';
      return categoryNameById.get(stored) ?? stored;
    },
    [categoryNameById],
  );

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setBusy(product.id);
    try {
      await deleteProduct(db, product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast({ title: 'Product deleted' });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === 'active' && p.isActive === false) return false;
      if (statusFilter === 'hidden' && p.isActive !== false) return false;
      if (categoryFilter === '__unknown__') {
        if (!p.category) return false;
        if (categoryNameById.has(p.category)) return false;
      } else if (categoryFilter && p.category !== categoryFilter) {
        return false;
      }
      if (brandFilter === '__unknown__') {
        if (!p.brand) return false;
        if (brandNameById.has(p.brand)) return false;
      } else if (brandFilter && p.brand !== brandFilter) {
        return false;
      }
      if (q) {
        const categoryLabel = resolveCategoryLabel(p.category).toLowerCase();
        const brandLabel = (brandNameById.get(p.brand) ?? p.brand).toLowerCase();
        const hay = `${p.name} ${brandLabel} ${categoryLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, statusFilter, categoryFilter, brandFilter, categoryNameById, brandNameById, resolveCategoryLabel]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('');
    setBrandFilter('');
  };

  const hasActiveFilter =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    categoryFilter !== '' ||
    brandFilter !== '';

  const renderMasonry = () => (
    <div className="caspian-pmasonry">
      {filtered.map((p) => {
        const viewHref = getViewHref(p.slug ?? p.id);
        const editHref = getEditHref(p.id);
        const categoryLabel = resolveCategoryLabel(p.category);
        const brandLabel = brandNameById.get(p.brand) ?? p.brand;
        const thumb = p.images?.[0]?.url;
        const colorCount = p.colorVariants?.length ?? (p.color ? 1 : 0);
        return (
          <article key={p.id} className="caspian-pcard">
            <span className="caspian-pcard__status">
              <Badge variant={p.isActive === false ? 'secondary' : 'default'}>
                {p.isActive === false ? 'Hidden' : 'Active'}
              </Badge>
            </span>
            <button
              type="button"
              className="caspian-pcard__media"
              onClick={() => nav.push(editHref)}
              aria-label={`Edit ${p.name}`}
            >
              {thumb ? (
                <img src={thumb} alt="" loading="lazy" />
              ) : (
                <span className="caspian-pcard__noimg" aria-hidden="true" />
              )}
            </button>
            <div className="caspian-pcard__body">
              <button
                type="button"
                className="caspian-pcard__title"
                onClick={() => nav.push(editHref)}
                title={p.name}
              >
                {p.name}
              </button>
              <span className="caspian-pcard__sub">
                {colorCount} colors · {p.sizes?.length ?? 0} sizes
              </span>
              <div className="caspian-pcard__meta">
                <span>{brandLabel || '—'}</span>
                <span>{categoryLabel}</span>
              </div>
            </div>
            <div className="caspian-pcard__foot">
              <strong className="caspian-pcard__price">{formatPrice(p.price)}</strong>
              <DropdownMenu
                trigger={
                  <button
                    type="button"
                    aria-label={`Actions for ${p.name}`}
                    disabled={busy === p.id}
                    style={{
                      width: 32,
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: '#fff',
                      cursor: busy === p.id ? 'not-allowed' : 'pointer',
                      color: 'inherit',
                    }}
                  >
                    <MoreHorizontalIcon />
                  </button>
                }
              >
                <DropdownMenuItem
                  icon={<EditIcon size={14} />}
                  onSelect={() => nav.push(editHref)}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<ExternalLinkIcon size={14} />}
                  onSelect={() => window.open(viewHref, '_blank', 'noreferrer')}
                >
                  View on storefront
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<TrashIcon size={14} />}
                  destructive
                  onSelect={() => handleDelete(p)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenu>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className={className}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Products</h1>
          <p style={{ color: '#666', marginTop: 4 }}>
            {filtered.length} of {products.length} shown
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <ViewToggle view={view} onChange={setView} />
          <Link href={newProductHref}>
            <Button>+ New product</Button>
          </Link>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 220px 180px auto',
          gap: 8,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <Input
          placeholder="Search name, brand, or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active only' },
            { value: 'hidden', label: 'Hidden only' },
          ]}
          style={{ width: '100%' }}
        />
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={categoryOptions}
          style={{ width: '100%' }}
        />
        <Select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          options={brandOptions}
          style={{ width: '100%' }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          disabled={!hasActiveFilter}
        >
          Clear
        </Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 40 }} />
          <Skeleton style={{ height: 40 }} />
          <Skeleton style={{ height: 40 }} />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>
          {products.length === 0 ? 'No products in catalog yet.' : 'No products match your filters.'}
        </p>
      ) : view === 'masonry' ? (
        renderMasonry()
      ) : (
        <Table>
          <THead>
            <TR>
              <TH style={{ width: 48 }}>#</TH>
              <TH>Name</TH>
              <TH>Brand</TH>
              <TH>Category</TH>
              <TH>Price</TH>
              <TH>Status</TH>
              <TH style={{ textAlign: 'right', width: 60 }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((p, idx) => {
              const viewHref = getViewHref(p.slug ?? p.id);
              const editHref = getEditHref(p.id);
              const categoryLabel = resolveCategoryLabel(p.category);
              const categoryIsLegacy = p.category && !categoryNameById.has(p.category);
              const brandLabel = brandNameById.get(p.brand) ?? p.brand;
              const brandIsLegacy = p.brand && !brandNameById.has(p.brand);
              return (
                <TR key={p.id}>
                  <TD style={{ color: '#888', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</TD>
                  <TD style={{ fontWeight: 500 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {p.name}
                      <a
                        href={viewHref}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View "${p.name}" on storefront`}
                        title="View on storefront"
                        style={{
                          color: '#666',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <ExternalLinkIcon size={14} />
                      </a>
                    </span>
                  </TD>
                  <TD style={{ color: brandIsLegacy ? '#b45309' : '#666' }}>
                    {brandLabel}
                    {brandIsLegacy && (
                      <span
                        title="This product stores a legacy free-text brand instead of a brand-doc id. Run Migrate now on the Brands page, or edit + save it to clean up."
                        style={{ marginLeft: 6, fontSize: 11 }}
                      >
                        ⚠
                      </span>
                    )}
                  </TD>
                  <TD style={{ color: categoryIsLegacy ? '#b45309' : '#666' }}>
                    {categoryLabel}
                    {categoryIsLegacy && (
                      <span
                        title="This product stores a legacy category name instead of an id. Edit + save it to migrate."
                        style={{ marginLeft: 6, fontSize: 11 }}
                      >
                        ⚠
                      </span>
                    )}
                  </TD>
                  <TD>{formatPrice(p.price)}</TD>
                  <TD>
                    <Badge variant={p.isActive === false ? 'secondary' : 'default'}>
                      {p.isActive === false ? 'Hidden' : 'Active'}
                    </Badge>
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <DropdownMenu
                      trigger={
                        <button
                          type="button"
                          aria-label={`Actions for ${p.name}`}
                          disabled={busy === p.id}
                          style={{
                            width: 32,
                            height: 32,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            border: '1px solid rgba(0,0,0,0.12)',
                            background: '#fff',
                            cursor: busy === p.id ? 'not-allowed' : 'pointer',
                            color: 'inherit',
                          }}
                        >
                          <MoreHorizontalIcon />
                        </button>
                      }
                    >
                      <DropdownMenuItem
                        icon={<EditIcon size={14} />}
                        onSelect={() => nav.push(editHref)}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        icon={<ExternalLinkIcon size={14} />}
                        onSelect={() => window.open(viewHref, '_blank', 'noreferrer')}
                      >
                        View on storefront
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        icon={<TrashIcon size={14} />}
                        destructive
                        onSelect={() => handleDelete(p)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: 'table' | 'masonry';
  onChange: (v: 'table' | 'masonry') => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Products view"
      style={{
        display: 'inline-flex',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: 'var(--caspian-radius, 6px)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {(['table', 'masonry'] as const).map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              border: 0,
              cursor: 'pointer',
              background: active ? 'var(--caspian-primary, #111)' : '#fff',
              color: active ? 'var(--caspian-primary-foreground, #fff)' : 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
