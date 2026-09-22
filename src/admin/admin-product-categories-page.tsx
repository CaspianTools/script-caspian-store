'use client';

import { useEffect, useState } from 'react';
import type { ProductCategoryDoc } from '../types';
import { deleteCategory, listAllCategories } from '../services/category-service';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

export function AdminProductCategoriesPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const t = useT();
  const [cats, setCats] = useState<ProductCategoryDoc[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductCategoryDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setCats(await listAllCategories(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list categories:', error);
      setCats([]);
      toast({ title: t('admin.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    const c = deleteTarget;
    if (!c) return;
    setDeleting(true);
    try {
      await deleteCategory(db, c.id);
      // Children were promoted to top level server-side; mirror that locally.
      setCats((prev) =>
        prev
          ? prev
              .filter((x) => x.id !== c.id)
              .map((x) => (x.parentId === c.id ? { ...x, parentId: null } : x))
          : prev,
      );
      toast({ title: 'Category deleted' });
      setDeleteTarget(null);
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const deleteChildCount = deleteTarget
    ? (cats ?? []).filter((x) => x.parentId === deleteTarget.id).length
    : 0;

  const nameById = new Map<string, string>();
  (cats ?? []).forEach((c) => nameById.set(c.id, c.name));

  return (
    <div className={className}>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Product categories</h1>
          <p style={{ color: '#666', marginTop: 4 }}>
            Supports parent/child hierarchy via the `parentId` field.
          </p>
        </div>
        <Button onClick={() => nav.push('/admin/categories/new')}>+ New category</Button>
      </header>

      {cats === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : cats.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No categories yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Order</TH>
              <TH>Name</TH>
              <TH>Slug</TH>
              <TH>Parent</TH>
              <TH>Status</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {cats.map((c) => (
              <TR key={c.id}>
                <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.order}</TD>
                <TD style={{ fontWeight: 500 }}>
                  <button
                    type="button"
                    onClick={() => nav.push(`/admin/categories/${c.id}/edit`)}
                    title={`Edit ${c.name}`}
                    style={{
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      font: 'inherit',
                      fontWeight: 500,
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    {c.name}
                  </button>
                </TD>
                <TD style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{c.slug}</TD>
                <TD style={{ color: '#666' }}>
                  {c.parentId ? nameById.get(c.parentId) ?? '—' : '—'}
                </TD>
                <TD>
                  {c.isFeatured && <Badge variant="secondary">Featured</Badge>}{' '}
                  <Badge variant={c.isActive ? 'default' : 'secondary'}>
                    {c.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                </TD>
                <TD style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nav.push(`/admin/categories/${c.id}/edit`)}
                    >
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={t('admin.confirm.deleteTitle')}
        description={
          deleteChildCount > 0
            ? t('admin.categories.confirmDeleteWithChildren', {
                name: deleteTarget?.name ?? '',
                count: deleteChildCount,
              })
            : t('admin.categories.confirmDelete', { name: deleteTarget?.name ?? '' })
        }
        confirmLabel={t('admin.confirm.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
