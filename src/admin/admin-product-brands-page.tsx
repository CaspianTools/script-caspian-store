'use client';

import { useEffect, useId, useState } from 'react';
import type { ProductBrandDoc } from '../types';
import {
  countLegacyBrandStrings,
  createBrand,
  deleteBrand,
  listAllBrands,
  migrateLegacyBrandStrings,
  updateBrand,
  type BrandWriteInput,
} from '../services/brand-service';
import { refreshBrandsCache } from '../hooks/use-brands';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog } from '../ui/dialog';
import { Input, Label } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

const emptyDraft: BrandWriteInput = {
  name: '',
  isActive: true,
};

export function AdminProductBrandsPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [brands, setBrands] = useState<ProductBrandDoc[] | null>(null);
  const [legacyCount, setLegacyCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BrandWriteInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductBrandDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const formId = useId();
  const nameId = `${formId}-name`;

  const load = async () => {
    try {
      const [list, legacy] = await Promise.all([
        listAllBrands(db),
        countLegacyBrandStrings(db),
      ]);
      setBrands(list);
      setLegacyCount(legacy);
    } catch (error) {
      console.error('[caspian-store] Failed to list brands:', error);
      setBrands((prev) => prev ?? []);
      toast({ title: t('admin.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const openEdit = (b: ProductBrandDoc) => {
    setEditingId(b.id);
    setDraft({ name: b.name, isActive: b.isActive });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateBrand(db, editingId, { ...draft, name: draft.name.trim() });
        toast({ title: 'Brand updated' });
      } else {
        await createBrand(db, { ...draft, name: draft.name.trim() });
        toast({ title: 'Brand created' });
      }
      refreshBrandsCache();
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
    const b = deleteTarget;
    if (!b) return;
    setDeleting(true);
    try {
      await deleteBrand(db, b.id);
      refreshBrandsCache();
      setBrands((prev) => (prev ? prev.filter((x) => x.id !== b.id) : prev));
      toast({ title: 'Brand deleted' });
      setDeleteTarget(null);
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const result = await migrateLegacyBrandStrings(db);
      refreshBrandsCache();
      toast({
        title: 'Migration complete',
        description: `Created ${result.brandsCreated} brand${result.brandsCreated === 1 ? '' : 's'}, updated ${result.productsUpdated} product${result.productsUpdated === 1 ? '' : 's'}.`,
      });
      await load();
    } catch (error) {
      console.error('[caspian-store] Migration failed:', error);
      toast({ title: 'Migration failed', variant: 'destructive' });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className={className}>
      <header
        className="caspian-admin-page-head"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Product brands</h1>
          <p style={{ color: '#666', marginTop: 4 }}>
            Brands appear as a dropdown on the product editor and as a filter on the products list.
          </p>
        </div>
        <Button onClick={openCreate}>+ New brand</Button>
      </header>

      {legacyCount > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: 'var(--caspian-radius, 6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <strong style={{ color: '#92400e', display: 'block', marginBottom: 2 }}>
              Legacy brand text detected
            </strong>
            <span style={{ fontSize: 13, color: '#78350f' }}>
              {legacyCount}
              {legacyCount >= 200 ? '+' : ''} product{legacyCount === 1 ? '' : 's'} store a free-text
              brand instead of a brand-doc id. Click <em>Migrate now</em> to create matching brand
              records and update products in place.
            </span>
          </div>
          <Button onClick={handleMigrate} loading={migrating}>
            Migrate now
          </Button>
        </div>
      )}

      {brands === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : brands.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No brands yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Id</TH>
              <TH>Status</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {brands.map((b) => (
              <TR key={b.id}>
                <TD style={{ fontWeight: 500 }}>{b.name}</TD>
                <TD style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{b.id}</TD>
                <TD>
                  <Badge variant={b.isActive ? 'default' : 'secondary'}>
                    {b.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                </TD>
                <TD data-label="" style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(b)}>
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
        title={editingId ? 'Edit brand' : 'New brand'}
        maxWidth={460}
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
              placeholder="e.g. Acme"
              autoFocus
            />
            {!editingId && (
              <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                The brand id is derived from the name on save, so products reference a stable, human-readable value.
              </p>
            )}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
            />
            Active (shown in editor + filter dropdowns)
          </label>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={t('admin.confirm.deleteTitle')}
        description={t('admin.brands.confirmDelete', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('admin.confirm.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
