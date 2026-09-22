'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { Product, ProductCollectionDoc } from '../types';
import {
  createProductCollection,
  deleteProductCollection,
  listProductCollections,
  updateProductCollection,
  type ProductCollectionWriteInput,
} from '../services/product-collection-service';
import { listAllProducts } from '../services/product-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog } from '../ui/dialog';
import { Input, Label, Textarea } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';
import { slugify } from '../utils/slugify';

const emptyDraft: ProductCollectionWriteInput = {
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  productIds: [],
  isActive: true,
  isFeatured: false,
  order: 0,
};

export function AdminProductCollectionsPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [collections, setCollections] = useState<ProductCollectionDoc[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductCollectionWriteInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProductCollectionDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const formId = useId();
  const nameId = `${formId}-name`;
  const slugId = `${formId}-slug`;
  const descriptionId = `${formId}-description`;
  const imageUrlId = `${formId}-image`;
  const orderId = `${formId}-order`;
  const productSearchId = `${formId}-product-search`;

  const load = async () => {
    try {
      const [cols, prods] = await Promise.all([
        listProductCollections(db),
        listAllProducts(db),
      ]);
      setCollections(cols);
      setProducts(prods);
    } catch (error) {
      console.error('[caspian-store] Failed to load collections:', error);
      setCollections((prev) => prev ?? []);
      setProducts((prev) => prev ?? []);
      toast({ title: t('admin.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    (products ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, order: (collections?.length ?? 0) + 1 });
    setProductQuery('');
    setOpen(true);
  };

  const openEdit = (c: ProductCollectionDoc) => {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      imageUrl: c.imageUrl ?? '',
      productIds: c.productIds ?? [],
      isActive: c.isActive,
      isFeatured: c.isFeatured ?? false,
      order: c.order,
    });
    setProductQuery('');
    setOpen(true);
  };

  const toggleProduct = (id: string) => {
    setDraft((d) => {
      const has = d.productIds.includes(id);
      return {
        ...d,
        productIds: has ? d.productIds.filter((x) => x !== id) : [...d.productIds, id],
      };
    });
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const slug = draft.slug || slugify(draft.name);
    setSaving(true);
    try {
      if (editingId) {
        await updateProductCollection(db, editingId, { ...draft, slug });
        toast({ title: 'Collection updated' });
      } else {
        await createProductCollection(db, { ...draft, slug });
        toast({ title: 'Collection created' });
      }
      setOpen(false);
      await load();
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const c = deleteTarget;
    if (!c) return;
    setDeleting(true);
    try {
      await deleteProductCollection(db, c.id);
      setCollections((prev) => (prev ? prev.filter((x) => x.id !== c.id) : prev));
      toast({ title: 'Collection deleted' });
      setDeleteTarget(null);
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={className}>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Product collections</h1>
          <p style={{ color: '#666', marginTop: 4 }}>
            Curated groups of products (e.g. "Summer essentials", "Gifts under $50").
          </p>
        </div>
        <Button onClick={openCreate}>+ New collection</Button>
      </header>

      {collections === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : collections.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No collections yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Order</TH>
              <TH>Name</TH>
              <TH>Slug</TH>
              <TH>Products</TH>
              <TH>Status</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {collections.map((c) => (
              <TR key={c.id}>
                <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.order}</TD>
                <TD style={{ fontWeight: 500 }}>{c.name}</TD>
                <TD style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{c.slug}</TD>
                <TD style={{ color: '#666' }}>{c.productIds?.length ?? 0}</TD>
                <TD>
                  {c.isFeatured && <Badge variant="secondary">Featured</Badge>}{' '}
                  <Badge variant={c.isActive ? 'default' : 'secondary'}>
                    {c.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                </TD>
                <TD style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(c)}>
                      Delete
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editingId ? 'Edit collection' : 'New collection'}
        maxWidth={720}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div>
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={slugId}>Slug (leave blank to auto-generate)</Label>
            <Input
              id={slugId}
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={descriptionId}>Description</Label>
            <Textarea
              id={descriptionId}
              rows={2}
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label htmlFor={imageUrlId}>Image URL</Label>
              <Input
                id={imageUrlId}
                value={draft.imageUrl ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor={orderId}>Order</Label>
              <Input
                id={orderId}
                type="number"
                value={draft.order}
                onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              />
              Active
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={draft.isFeatured ?? false}
                onChange={(e) => setDraft((d) => ({ ...d, isFeatured: e.target.checked }))}
              />
              Featured (homepage)
            </label>
          </div>

          <div>
            <Label htmlFor={productSearchId}>
              Products in this collection ({draft.productIds.length} selected)
            </Label>
            <Input
              id={productSearchId}
              placeholder="Search products…"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              // Enter here filters; it must not submit the surrounding form.
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              style={{ marginBottom: 8 }}
            />
            {draft.productIds.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 8,
                  padding: 8,
                  background: '#f6f6f6',
                  borderRadius: 6,
                }}
              >
                {draft.productIds.map((id) => {
                  const p = productById.get(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleProduct(id)}
                      style={{
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: 999,
                        padding: '2px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {p?.name ?? id} ✕
                    </button>
                  );
                })}
              </div>
            )}
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid #e5e5e5',
                borderRadius: 6,
              }}
            >
              {products === null ? (
                <Skeleton style={{ height: 100 }} />
              ) : filteredProducts.length === 0 ? (
                <p style={{ color: '#888', padding: 16, textAlign: 'center', margin: 0 }}>
                  No products match.
                </p>
              ) : (
                filteredProducts.map((p) => {
                  const selected = draft.productIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderBottom: '1px solid #f0f0f0',
                        fontSize: 14,
                        cursor: 'pointer',
                        background: selected ? '#f0f7ff' : undefined,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProduct(p.id)}
                      />
                      <span>{p.name}</span>
                      <span style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
                        ${p.price?.toFixed?.(2) ?? p.price}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={t('admin.confirm.deleteTitle')}
        description={t('admin.collections.confirmDelete', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('admin.confirm.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
