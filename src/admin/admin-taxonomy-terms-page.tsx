'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { TaxonomyTermDoc } from '../types';
import {
  createTerm,
  deleteTerm,
  listTerms,
  termExists,
  updateTerm,
  type TaxonomyTermWriteInput,
} from '../services/taxonomy-term-service';
import { TAXONOMY_BY_ID } from '../taxonomies/catalog';
import { slugify } from '../utils/slugify';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog } from '../ui/dialog';
import { Input, Label } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

const emptyDraft: TaxonomyTermWriteInput = { name: '', isActive: true };

/**
 * Generic CRUD page for a single taxonomy `type` (materials, seasons, …),
 * mounted by the Taxonomies shell for every enabled `kind: 'generic'` entry.
 * Modeled on the Brands page but backed by the shared `taxonomyTerms`
 * collection and free of the brand-specific legacy migration.
 */
export function AdminTaxonomyTermsPage({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const formId = useId();
  const [terms, setTerms] = useState<TaxonomyTermDoc[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TaxonomyTermDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaxonomyTermWriteInput>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const def = TAXONOMY_BY_ID[type];
  const title = def ? t(def.labelKey) : type;

  const load = async () => {
    setTerms(null);
    try {
      setTerms(await listTerms(db, type));
    } catch (error) {
      console.error('[caspian-store] Failed to list taxonomy terms:', error);
      setTerms([]);
      toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const openEdit = (term: TaxonomyTermDoc) => {
    setEditingId(term.id);
    setDraft({ name: term.name, isActive: term.isActive });
    setOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    const name = draft.name.trim();
    if (!name) {
      toast({ title: t('admin.taxonomies.terms.nameRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateTerm(db, editingId, { name, isActive: draft.isActive });
        toast({ title: t('admin.taxonomies.terms.updated') });
      } else {
        if (await termExists(db, type, slugify(name))) {
          toast({ title: t('admin.taxonomies.terms.duplicate'), variant: 'destructive' });
          setSaving(false);
          return;
        }
        await createTerm(db, type, { name, isActive: draft.isActive });
        toast({ title: t('admin.taxonomies.terms.created') });
      }
      setOpen(false);
      await load();
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: t('admin.taxonomies.terms.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const term = pendingDelete;
    if (!term) return;
    setDeleting(true);
    try {
      await deleteTerm(db, term.id);
      setTerms((prev) => (prev ? prev.filter((x) => x.id !== term.id) : prev));
      setPendingDelete(null);
      toast({ title: t('admin.taxonomies.terms.deleted') });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: t('admin.taxonomies.terms.deleteFailed'), variant: 'destructive' });
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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{title}</h1>
          <p style={{ color: '#666', marginTop: 4 }}>{t('admin.taxonomies.terms.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>{t('admin.taxonomies.terms.add')}</Button>
      </header>

      {terms === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : terms.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>
          {t('admin.taxonomies.terms.empty')}
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.taxonomies.terms.colName')}</TH>
              <TH>{t('admin.taxonomies.terms.colStatus')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.taxonomies.terms.colActions')}</TH>
            </TR>
          </THead>
          <TBody>
            {terms.map((term) => (
              <TR key={term.id}>
                <TD style={{ fontWeight: 500 }}>{term.name}</TD>
                <TD>
                  <Badge variant={term.isActive ? 'default' : 'secondary'}>
                    {term.isActive
                      ? t('admin.taxonomies.terms.active')
                      : t('admin.taxonomies.terms.hidden')}
                  </Badge>
                </TD>
                <TD style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(term)}>
                      {t('admin.taxonomies.terms.edit')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setPendingDelete(term)}>
                      {t('admin.taxonomies.terms.delete')}
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
        title={editingId ? t('admin.taxonomies.terms.editTitle') : t('admin.taxonomies.terms.newTitle')}
        maxWidth={460}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t('admin.taxonomies.terms.cancel')}
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {t('admin.taxonomies.terms.save')}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label htmlFor={`${formId}-name`}>{t('admin.taxonomies.terms.nameLabel')}</Label>
            <Input
              id={`${formId}-name`}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={t('admin.taxonomies.terms.namePlaceholder')}
              autoFocus
            />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
            />
            {t('admin.taxonomies.terms.activeLabel')}
          </label>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.taxonomies.terms.confirmDelete', { name: pendingDelete?.name ?? '' })}
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('admin.taxonomies.terms.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
