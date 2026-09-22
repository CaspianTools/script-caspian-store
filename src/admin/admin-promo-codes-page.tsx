'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { PromoCode } from '../types';
import {
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  updatePromoCode,
  validatePromoCodeInput,
  type PromoCodeWriteInput,
} from '../services/promo-code-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useScriptSettings } from '../context/script-settings-context';
import { useFormatCurrency, useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog } from '../ui/dialog';
import { Input, Label } from '../ui/input';
import { Select } from '../ui/select';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

const emptyDraft: PromoCodeWriteInput = {
  code: '',
  type: 'percentage',
  value: 10,
  minOrderAmount: undefined,
  maxDiscount: undefined,
  isActive: true,
};

export function AdminPromoCodesPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const { settings } = useScriptSettings();
  const currency = settings.defaultCurrency || 'USD';
  const fmtCurrency = useFormatCurrency(currency);
  const formId = useId();
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromoCodeWriteInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setCodes(await listPromoCodes(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list promo codes:', error);
      setCodes((prev) => prev ?? []);
      toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFieldError(null);
    setOpen(true);
  };

  const openEdit = (code: PromoCode) => {
    setEditingId(code.id);
    setDraft({
      code: code.code,
      type: code.type,
      value: code.value,
      minOrderAmount: code.minOrderAmount,
      maxDiscount: code.maxDiscount,
      isActive: code.isActive,
    });
    setFieldError(null);
    setOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (!draft.code.trim()) {
      toast({ title: t('admin.promoCodes.codeRequired'), variant: 'destructive' });
      return;
    }
    const problem = validatePromoCodeInput(draft);
    if (problem) {
      setFieldError(t(`admin.promoCodes.error.${problem}`));
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      if (editingId) {
        await updatePromoCode(db, editingId, draft);
        toast({ title: t('admin.promoCodes.updated') });
      } else {
        await createPromoCode(db, draft);
        toast({ title: t('admin.promoCodes.created') });
      }
      setOpen(false);
      await load();
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: t('admin.common.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const code = pendingDelete;
    if (!code) return;
    setDeleting(true);
    try {
      await deletePromoCode(db, code.id);
      setCodes((prev) => (prev ? prev.filter((c) => c.id !== code.id) : prev));
      setPendingDelete(null);
      toast({ title: t('admin.promoCodes.deleted') });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const valueErrorId = `${formId}-value-error`;

  return (
    <div className={className}>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.promoCodes.title')}</h1>
          <p style={{ color: '#666', marginTop: 4 }}>{t('admin.promoCodes.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>{t('admin.promoCodes.new')}</Button>
      </header>

      {codes === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : codes.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>{t('admin.promoCodes.empty')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.promoCodes.col.code')}</TH>
              <TH>{t('admin.promoCodes.col.type')}</TH>
              <TH>{t('admin.promoCodes.col.value')}</TH>
              <TH>{t('admin.promoCodes.col.minOrder')}</TH>
              <TH>{t('admin.promoCodes.col.maxDiscount')}</TH>
              <TH>{t('admin.promoCodes.col.status')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.promoCodes.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {codes.map((c) => (
              <TR key={c.id}>
                <TD style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.code}</TD>
                <TD>
                  {c.type === 'percentage'
                    ? t('admin.promoCodes.type.percentage')
                    : t('admin.promoCodes.type.fixed')}
                </TD>
                <TD>{c.type === 'percentage' ? `${c.value}%` : fmtCurrency.format(c.value)}</TD>
                <TD>{c.minOrderAmount ? fmtCurrency.format(c.minOrderAmount) : '—'}</TD>
                <TD>{c.maxDiscount ? fmtCurrency.format(c.maxDiscount) : '—'}</TD>
                <TD>
                  <Badge variant={c.isActive ? 'default' : 'secondary'}>
                    {c.isActive ? t('admin.promoCodes.active') : t('admin.promoCodes.inactive')}
                  </Badge>
                </TD>
                <TD style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setPendingDelete(c)}>
                      {t('common.delete')}
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
        title={editingId ? t('admin.promoCodes.editTitle') : t('admin.promoCodes.newTitle')}
        maxWidth={560}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label htmlFor={`${formId}-code`}>{t('admin.promoCodes.field.code')}</Label>
            <Input
              id={`${formId}-code`}
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
              placeholder="SPRING20"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label htmlFor={`${formId}-type`}>{t('admin.promoCodes.field.type')}</Label>
              <Select
                id={`${formId}-type`}
                value={draft.type}
                onChange={(e) => {
                  setFieldError(null);
                  setDraft((d) => ({ ...d, type: e.target.value as PromoCodeWriteInput['type'] }));
                }}
                options={[
                  { value: 'percentage', label: t('admin.promoCodes.type.percentage') },
                  { value: 'fixed', label: t('admin.promoCodes.type.fixed') },
                ]}
              />
            </div>
            <div>
              <Label htmlFor={`${formId}-value`}>
                {t('admin.promoCodes.field.value', {
                  unit: draft.type === 'percentage' ? '%' : currency,
                })}
              </Label>
              <Input
                id={`${formId}-value`}
                type="number"
                step="0.01"
                min={0}
                max={draft.type === 'percentage' ? 100 : undefined}
                value={draft.value}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? valueErrorId : undefined}
                onChange={(e) => {
                  setFieldError(null);
                  setDraft((d) => ({ ...d, value: Number(e.target.value) || 0 }));
                }}
              />
              {fieldError && (
                <p id={valueErrorId} role="alert" style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>
                  {fieldError}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label htmlFor={`${formId}-min`}>
                {t('admin.promoCodes.field.minOrder', { currency })}
              </Label>
              <Input
                id={`${formId}-min`}
                type="number"
                step="0.01"
                min={0}
                value={draft.minOrderAmount ?? ''}
                onChange={(e) => {
                  setFieldError(null);
                  setDraft((d) => ({
                    ...d,
                    minOrderAmount: e.target.value ? Number(e.target.value) : undefined,
                  }));
                }}
              />
            </div>
            <div>
              <Label htmlFor={`${formId}-max`}>
                {t('admin.promoCodes.field.maxDiscount', { currency })}
              </Label>
              <Input
                id={`${formId}-max`}
                type="number"
                step="0.01"
                min={0}
                value={draft.maxDiscount ?? ''}
                onChange={(e) => {
                  setFieldError(null);
                  setDraft((d) => ({
                    ...d,
                    maxDiscount: e.target.value ? Number(e.target.value) : undefined,
                  }));
                }}
              />
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
            />
            {t('admin.promoCodes.active')}
          </label>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.confirm.deleteNamedTitle', { name: pendingDelete?.code ?? '' })}
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
