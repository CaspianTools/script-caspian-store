'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { JournalArticle } from '../types';
import {
  createJournalArticle,
  deleteJournalArticle,
  listJournalArticles,
  updateJournalArticle,
  type JournalArticleWriteInput,
} from '../services/journal-service';
import { deleteStorageObject, uploadAdminImage } from '../services/storage-service';
import { useCaspianFirebase, useCaspianImage } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Input, Label, Textarea } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

interface Draft extends JournalArticleWriteInput {}

// `date` is filled in by `openCreate` so a long-lived tab still defaults to
// today rather than to the day the module was first evaluated.
const emptyDraft: Draft = {
  title: '',
  excerpt: '',
  category: '',
  date: '',
  imageUrl: '',
  content: '',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function AdminJournalPage({ className }: { className?: string }) {
  const { db, storage } = useCaspianFirebase();
  const Image = useCaspianImage();
  const { toast } = useToast();
  const t = useT();
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [articles, setArticles] = useState<JournalArticle[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<JournalArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setArticles(await listJournalArticles(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list journal articles:', error);
      setArticles((prev) => prev ?? []);
      toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, date: todayIso() });
    setDialogOpen(true);
  };

  const openEdit = (article: JournalArticle) => {
    setEditingId(article.id);
    setDraft({
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      date: article.date,
      imageUrl: article.imageUrl,
      content: article.content,
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
      const path = `journal/${fileName}`;
      const url = await uploadAdminImage({ storage, path, file });
      setDraft((d) => ({ ...d, imageUrl: url }));
      toast({ title: 'Image uploaded' });
    } catch (error) {
      console.error('[caspian-store] Image upload failed:', error);
      const msg = error instanceof Error ? error.message : 'Upload failed';
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || uploading) return;
    if (!draft.title.trim()) {
      toast({ title: t('admin.journal.titleRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateJournalArticle(db, editingId, {
          title: draft.title.trim(),
          excerpt: draft.excerpt.trim(),
          category: draft.category.trim(),
          date: draft.date,
          imageUrl: draft.imageUrl,
          content: draft.content,
        });
        toast({ title: 'Article updated' });
      } else {
        await createJournalArticle(db, {
          title: draft.title.trim(),
          excerpt: draft.excerpt.trim(),
          category: draft.category.trim(),
          date: draft.date,
          imageUrl: draft.imageUrl,
          content: draft.content,
        });
        toast({ title: 'Article created' });
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      console.error('[caspian-store] Save failed:', error);
      toast({ title: t('admin.common.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const article = pendingDelete;
    if (!article) return;
    setDeleting(true);
    try {
      await deleteJournalArticle(db, article.id);
      // Best-effort: delete the storage image too (path is embedded in the URL query).
      if (article.imageUrl?.includes('journal%2F')) {
        const match = article.imageUrl.match(/journal%2F([^?]+)/);
        if (match) await deleteStorageObject(storage, `journal/${decodeURIComponent(match[1])}`);
      }
      setArticles((prev) => (prev ? prev.filter((a) => a.id !== article.id) : prev));
      setPendingDelete(null);
      toast({ title: 'Article deleted' });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={className}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Journal</h1>
          <p style={{ color: '#666', marginTop: 4 }}>Manage editorial articles on the public journal page.</p>
        </div>
        <Button onClick={openCreate}>+ New article</Button>
      </header>

      {articles === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 48 }} />
          <Skeleton style={{ height: 48 }} />
        </div>
      ) : articles.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No articles yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Image</TH>
              <TH>Title</TH>
              <TH>Category</TH>
              <TH>Date</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {articles.map((article) => (
              <TR key={article.id}>
                <TD>
                  {article.imageUrl ? (
                    <div
                      style={{
                        position: 'relative',
                        width: 80,
                        height: 52,
                        background: '#f5f5f5',
                        overflow: 'hidden',
                        borderRadius: 4,
                      }}
                    >
                      <Image src={article.imageUrl} alt={article.title} fill />
                    </div>
                  ) : (
                    <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                  )}
                </TD>
                <TD style={{ fontWeight: 500 }}>{article.title}</TD>
                <TD style={{ color: '#666' }}>{article.category}</TD>
                <TD style={{ color: '#888', fontSize: 13 }}>{article.date}</TD>
                <TD style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(article)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setPendingDelete(article)}>
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? 'Edit article' : 'New article'}
        maxWidth={640}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {editingId ? 'Save changes' : 'Create article'}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label htmlFor={`${formId}-title`}>Title</Label>
            <Input
              id={`${formId}-title`}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label htmlFor={`${formId}-category`}>Category</Label>
              <Input
                id={`${formId}-category`}
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor={`${formId}-date`}>Date</Label>
              <Input
                id={`${formId}-date`}
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${formId}-excerpt`}>Excerpt</Label>
            <Textarea
              id={`${formId}-excerpt`}
              rows={2}
              value={draft.excerpt}
              onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-image`}>Cover image</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                id={`${formId}-image`}
                value={draft.imageUrl}
                onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))}
                placeholder="https://…"
                style={{ flex: 1 }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor={`${formId}-content`}>Content</Label>
            <Textarea
              id={`${formId}-content`}
              rows={10}
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder="Paragraphs separated by blank lines…"
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.confirm.deleteNamedTitle', { name: pendingDelete?.title ?? '' })}
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
