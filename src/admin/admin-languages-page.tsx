'use client';

import { useEffect, useId, useState } from 'react';
import type { LanguageDoc } from '../types';
import {
  createLanguage,
  deleteLanguage,
  listLanguages,
  updateLanguage,
  type LanguageWriteInput,
} from '../services/language-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog } from '../ui/dialog';
import { Input, Label } from '../ui/input';
import { Select } from '../ui/select';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

const emptyDraft: LanguageWriteInput = {
  code: '',
  name: '',
  nativeName: '',
  flag: '',
  isDefault: false,
  isActive: true,
  direction: 'ltr',
  order: 0,
};

export function AdminLanguagesPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [languages, setLanguages] = useState<LanguageDoc[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LanguageWriteInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LanguageDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const formId = useId();
  const codeId = `${formId}-code`;
  const flagId = `${formId}-flag`;
  const nameId = `${formId}-name`;
  const nativeNameId = `${formId}-native`;
  const directionId = `${formId}-direction`;
  const orderId = `${formId}-order`;

  const load = async () => {
    try {
      setLanguages(await listLanguages(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list languages:', error);
      setLanguages((prev) => prev ?? []);
      toast({ title: t('admin.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, order: (languages?.length ?? 0) + 1 });
    setOpen(true);
  };

  const openEdit = (l: LanguageDoc) => {
    setEditingId(l.id);
    setDraft({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      flag: l.flag ?? '',
      isDefault: l.isDefault,
      isActive: l.isActive,
      direction: l.direction,
      order: l.order,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast({ title: 'Code and name are required', variant: 'destructive' });
      return;
    }
    const code = draft.code.trim().toLowerCase();
    if ((languages ?? []).some((l) => l.code === code && l.id !== editingId)) {
      toast({ title: t('admin.languages.errors.duplicateCode', { code }), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: LanguageWriteInput = { ...draft, code };
      if (editingId) {
        await updateLanguage(db, editingId, payload);
        toast({ title: 'Language updated' });
      } else {
        await createLanguage(db, payload);
        toast({ title: 'Language created' });
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

  const requestDelete = (l: LanguageDoc) => {
    if (l.isDefault) {
      toast({ title: "Can't delete the default language", variant: 'destructive' });
      return;
    }
    setDeleteTarget(l);
  };

  const handleDelete = async () => {
    const l = deleteTarget;
    if (!l) return;
    setDeleting(true);
    try {
      await deleteLanguage(db, l.id);
      setLanguages((prev) => (prev ? prev.filter((x) => x.id !== l.id) : prev));
      toast({ title: 'Language deleted' });
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
        className="caspian-admin-page-head"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Languages</h1>
          <p style={{ color: '#666', marginTop: 4 }}>
            Locale registry — code, native name, direction, default flag.
          </p>
        </div>
        <Button onClick={openCreate}>+ New language</Button>
      </header>

      {languages === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : languages.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No languages yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Order</TH>
              <TH>Code</TH>
              <TH>Name</TH>
              <TH>Native name</TH>
              <TH>Direction</TH>
              <TH>Status</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {languages.map((l) => (
              <TR key={l.id}>
                <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{l.order}</TD>
                <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>
                  {l.flag ? `${l.flag} ` : ''}
                  {l.code}
                </TD>
                <TD className="caspian-td-primary" style={{ fontWeight: 500 }}>{l.name}</TD>
                <TD>{l.nativeName}</TD>
                <TD style={{ fontSize: 12, color: '#666' }}>{l.direction.toUpperCase()}</TD>
                <TD>
                  {l.isDefault && <Badge variant="secondary">Default</Badge>}{' '}
                  <Badge variant={l.isActive ? 'default' : 'secondary'}>
                    {l.isActive ? 'Active' : 'Hidden'}
                  </Badge>
                </TD>
                <TD data-label="" style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(l)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => requestDelete(l)}
                      disabled={l.isDefault}
                    >
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
        title={editingId ? 'Edit language' : 'New language'}
        maxWidth={520}
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
          <div className="caspian-admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label htmlFor={codeId}>Code (BCP 47, e.g. `en`, `ar`)</Label>
              <Input
                id={codeId}
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor={flagId}>Flag emoji</Label>
              <Input
                id={flagId}
                value={draft.flag ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, flag: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={nameId}>Name (English)</Label>
            <Input
              id={nameId}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={nativeNameId}>Native name</Label>
            <Input
              id={nativeNameId}
              value={draft.nativeName}
              onChange={(e) => setDraft((d) => ({ ...d, nativeName: e.target.value }))}
            />
          </div>
          <div className="caspian-admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label htmlFor={directionId}>Direction</Label>
              <Select
                id={directionId}
                value={draft.direction}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, direction: e.target.value as 'ltr' | 'rtl' }))
                }
                options={[
                  { value: 'ltr', label: 'Left-to-right' },
                  { value: 'rtl', label: 'Right-to-left' },
                ]}
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
              Active (visible to shoppers)
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
              />
              Default language
            </label>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={t('admin.confirm.deleteTitle')}
        description={t('admin.languages.confirmDelete', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('admin.confirm.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
