'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { FaqItem } from '../types';
import { createFaq, deleteFaq, listFaqs, updateFaq, type FaqWriteInput } from '../services/faq-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Dialog } from '../ui/dialog';
import { Input, Label, Textarea } from '../ui/input';
import { Select, type SelectOption } from '../ui/select';
import { Skeleton, Badge } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

const emptyDraft: FaqWriteInput = {
  category: 'orders',
  question: '',
  answer: '',
  order: 0,
};

const DEFAULT_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'orders', label: 'Orders & Shipping' },
  { value: 'returns', label: 'Returns & Exchanges' },
  { value: 'products', label: 'Products & Sizing' },
  { value: 'account', label: 'Account & Payment' },
  { value: 'general', label: 'General' },
];

export interface AdminFaqsPageProps {
  categoryOptions?: SelectOption[];
  className?: string;
}

export function AdminFaqsPage({
  categoryOptions = DEFAULT_CATEGORY_OPTIONS,
  className,
}: AdminFaqsPageProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const formId = useId();
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FaqWriteInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FaqItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setFaqs(await listFaqs(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list FAQs:', error);
      setFaqs((prev) => prev ?? []);
      toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      order: (faqs?.length ?? 0) + 1,
    });
    setDialogOpen(true);
  };

  const openEdit = (faq: FaqItem) => {
    setEditingId(faq.id);
    setDraft({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (!draft.question.trim() || !draft.answer.trim()) {
      toast({ title: t('admin.faqs.requiredFields'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateFaq(db, editingId, draft);
        toast({ title: t('admin.faqs.updated') });
      } else {
        await createFaq(db, draft);
        toast({ title: t('admin.faqs.created') });
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      console.error('[caspian-store] FAQ save failed:', error);
      toast({ title: t('admin.common.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const faq = pendingDelete;
    if (!faq) return;
    setDeleting(true);
    try {
      await deleteFaq(db, faq.id);
      setFaqs((prev) => (prev ? prev.filter((f) => f.id !== faq.id) : prev));
      setPendingDelete(null);
      toast({ title: t('admin.faqs.deleted') });
    } catch (error) {
      console.error('[caspian-store] FAQ delete failed:', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.faqs.title')}</h1>
          <p style={{ color: '#666', marginTop: 4 }}>{t('admin.faqs.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>{t('admin.faqs.new')}</Button>
      </header>

      {faqs === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 48 }} />
          <Skeleton style={{ height: 48 }} />
        </div>
      ) : faqs.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>{t('admin.faqs.empty')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.faqs.col.order')}</TH>
              <TH>{t('admin.faqs.col.category')}</TH>
              <TH>{t('admin.faqs.col.question')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.faqs.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {faqs.map((faq) => (
              <TR key={faq.id}>
                <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{faq.order}</TD>
                <TD>
                  <Badge variant="secondary">{faq.category || 'general'}</Badge>
                </TD>
                <TD style={{ fontWeight: 500 }}>{faq.question}</TD>
                <TD style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(faq)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setPendingDelete(faq)}>
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? t('admin.faqs.editTitle') : t('admin.faqs.newTitle')}
        maxWidth={560}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
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
            <Label htmlFor={`${formId}-category`}>{t('admin.faqs.field.category')}</Label>
            <Select
              id={`${formId}-category`}
              options={categoryOptions}
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-question`}>{t('admin.faqs.field.question')}</Label>
            <Input
              id={`${formId}-question`}
              value={draft.question}
              onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-answer`}>{t('admin.faqs.field.answer')}</Label>
            <Textarea
              id={`${formId}-answer`}
              rows={5}
              value={draft.answer}
              onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-order`}>{t('admin.faqs.field.order')}</Label>
            <Input
              id={`${formId}-order`}
              type="number"
              value={draft.order}
              onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.confirm.deleteNamedTitle', { name: pendingDelete?.question ?? '' })}
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
