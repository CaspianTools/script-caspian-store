'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { ProductCategoryDoc } from '../types';
import {
  createCategory,
  deleteCategory,
  listAllCategories,
  updateCategory,
  type CategoryWriteInput,
} from '../services/category-service';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { Input, Label, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { ImageUploadField } from '../ui/image-upload-field';
import { Skeleton } from '../ui/misc';
import { useToast } from '../ui/toast';
import { slugify } from '../utils/slugify';

export interface AdminCategoryEditorProps {
  /** Pass a category id to edit an existing category. Omit to create. */
  categoryId?: string;
  /** Where to go after save / delete / cancel. Default: `/admin/categories`. */
  afterSaveHref?: string;
  className?: string;
}

interface Draft {
  name: string;
  slug: string;
  description: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  imageUrl: string;
  parentId: string | null;
}

const EMPTY: Draft = {
  name: '',
  slug: '',
  description: '',
  order: 0,
  isActive: true,
  isFeatured: false,
  imageUrl: '',
  parentId: null,
};

const sectionStyle: CSSProperties = {
  padding: 16,
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
  marginTop: 16,
  marginBottom: 16,
};

/**
 * Full-page category editor (create + edit). Replaces the old in-list modal so
 * editing has its own URL (`/admin/categories/new`, `/admin/categories/{id}/edit`),
 * mirroring the product editor. A single `listAllCategories` read seeds the
 * form, the parent dropdown, and the cycle-prevention set.
 */
export function AdminCategoryEditor({
  categoryId,
  afterSaveHref = '/admin/categories',
  className,
}: AdminCategoryEditorProps) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();

  const [cats, setCats] = useState<ProductCategoryDoc[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(Boolean(categoryId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listAllCategories(db);
        if (!alive) return;
        setCats(list);
        if (categoryId) {
          const found = list.find((c) => c.id === categoryId);
          if (!found) {
            setNotFound(true);
          } else {
            setDraft({
              name: found.name,
              slug: found.slug,
              description: found.description ?? '',
              order: found.order,
              isActive: found.isActive,
              isFeatured: found.isFeatured ?? false,
              imageUrl: found.imageUrl ?? '',
              parentId: found.parentId ?? null,
            });
          }
        }
      } catch (error) {
        console.error('[caspian-store] Failed to load categories:', error);
        if (alive && categoryId) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, categoryId]);

  // Parent options exclude the category itself AND every descendant, so an
  // admin can't create a cycle (A → B → A) from the dropdown. The full list is
  // already loaded, so the walk is free.
  const parentOptions = useMemo(() => {
    const all = cats ?? [];
    const blocked = new Set<string>();
    if (categoryId) {
      blocked.add(categoryId);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of all) {
          if (c.parentId && blocked.has(c.parentId) && !blocked.has(c.id)) {
            blocked.add(c.id);
            grew = true;
          }
        }
      }
    }
    return [
      { value: '', label: '— None (top-level) —' },
      ...all.filter((c) => !blocked.has(c.id)).map((c) => ({ value: c.id, label: c.name })),
    ];
  }, [cats, categoryId]);

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const slug = draft.slug.trim() || slugify(draft.name);
    setSaving(true);
    try {
      const payload: CategoryWriteInput = { ...draft, slug };
      if (categoryId) {
        await updateCategory(db, categoryId, payload);
        toast({ title: 'Category updated' });
      } else {
        await createCategory(db, payload);
        toast({ title: 'Category created' });
      }
      nav.push(afterSaveHref);
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: 'Save failed', variant: 'destructive' });
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryId) return;
    if (!confirm(`Delete category "${draft.name || 'this category'}"?`)) return;
    setDeleting(true);
    try {
      await deleteCategory(db, categoryId);
      toast({ title: 'Category deleted' });
      nav.push(afterSaveHref);
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: 'Delete failed', variant: 'destructive' });
      setDeleting(false);
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
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Category not found</h1>
        <p style={{ color: '#666', marginTop: 8 }}>This category may have been deleted.</p>
        <Button variant="outline" onClick={() => nav.push(afterSaveHref)}>
          ← Back to categories
        </Button>
      </div>
    );
  }

  return (
    <div className={className} style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
        {categoryId ? 'Edit category' : 'New category'}
      </h1>

      <section style={sectionStyle}>
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={() => setDraft((d) => (d.slug ? d : { ...d, slug: slugify(d.name) }))}
          />
        </Field>
        <Field label="Slug (leave blank to auto-generate)">
          <Input
            value={draft.slug}
            onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase() }))}
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Parent category">
            <Select
              value={draft.parentId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value || null }))}
              options={parentOptions}
              style={{ width: '100%' }}
            />
          </Field>
          <Field label="Order">
            <Input
              type="number"
              value={draft.order}
              onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))}
            />
          </Field>
        </div>
      </section>

      <section style={sectionStyle}>
        <ImageUploadField
          label="Featured image"
          value={draft.imageUrl}
          onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
          storagePath={`categories/${categoryId ?? 'new'}`}
          aspectRatio="1 / 1"
          allowUrlFallback
        />
      </section>

      <section style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Switch
          checked={draft.isActive}
          onChange={(next) => setDraft((d) => ({ ...d, isActive: next }))}
          label="Active"
          description={
            <span style={{ fontSize: 12, color: '#888' }}>
              When off, the category is hidden from the storefront.
            </span>
          }
        />
        <Switch
          checked={draft.isFeatured}
          onChange={(next) => setDraft((d) => ({ ...d, isFeatured: next }))}
          label="Featured"
          description={
            <span style={{ fontSize: 12, color: '#888' }}>
              Featured categories appear in the homepage categories section.
            </span>
          }
        />
      </section>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        {categoryId ? (
          <Button variant="destructive" onClick={handleDelete} loading={deleting} disabled={saving}>
            {deleting ? 'Deleting…' : 'Delete category'}
          </Button>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={() => nav.push(afterSaveHref)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? 'Saving…' : categoryId ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
