'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { PageContent } from '../types';
import {
  listPageContents,
  savePageContent,
} from '../services/page-content-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Input, Label, Textarea } from '../ui/input';
import { Dialog } from '../ui/dialog';
import { Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

/** Default content-page keys. Consumers can override via the `pageKeys` prop. */
export const DEFAULT_PAGE_KEYS: string[] = [
  'about',
  'contact',
  'privacy',
  'terms',
  'sustainability',
  'shipping-returns',
  'size-guide',
];

export interface AdminPagesPageProps {
  /** Override the list of manageable page keys. */
  pageKeys?: string[];
  className?: string;
}

interface Draft {
  pageKey: string;
  title: string;
  subtitle: string;
  content: string;
}

const emptyDraft: Draft = { pageKey: '', title: '', subtitle: '', content: '' };

export function AdminPagesPage({
  pageKeys = DEFAULT_PAGE_KEYS,
  className,
}: AdminPagesPageProps) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const formId = useId();
  const [pages, setPages] = useState<PageContent[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setPages(await listPageContents(db));
    } catch (error) {
      console.error('[caspian-store] Failed to load page contents:', error);
      setPages((prev) => prev ?? []);
      toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (pageKey: string) => {
    const existing = pages?.find((p) => p.pageKey === pageKey || p.id === pageKey);
    setDraft({
      pageKey,
      title: existing?.title ?? '',
      subtitle: existing?.subtitle ?? '',
      content: existing?.content ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (!draft.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await savePageContent(db, {
        pageKey: draft.pageKey,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        content: draft.content,
      });
      toast({ title: 'Page saved' });
      setDialogOpen(false);
      await load();
    } catch (error) {
      console.error('[caspian-store] Save page failed:', error);
      toast({ title: t('admin.common.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const byKey = new Map<string, PageContent>();
  (pages ?? []).forEach((p) => byKey.set(p.pageKey ?? p.id, p));

  return (
    <div className={className}>
      <header className="caspian-admin-page-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Pages</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          Edit the long-form content on About / Contact / Privacy / Terms / Sustainability / etc.
        </p>
      </header>

      {pages === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 48 }} />
          <Skeleton style={{ height: 48 }} />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Page</TH>
              <TH>Title</TH>
              <TH>Last updated</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {pageKeys.map((key) => {
              const existing = byKey.get(key);
              const updated = existing?.updatedAt?.toDate
                ? existing.updatedAt.toDate().toLocaleDateString()
                : '—';
              return (
                <TR key={key}>
                  <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{key}</TD>
                  <TD style={{ fontWeight: 500 }}>
                    {existing?.title ?? <span style={{ color: '#aaa' }}>— not set —</span>}
                  </TD>
                  <TD style={{ color: '#888', fontSize: 13 }}>{updated}</TD>
                  <TD data-label="" style={{ textAlign: 'right' }}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(key)}>
                      {existing ? 'Edit' : 'Create'}
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`Edit page: ${draft.pageKey}`}
        description="Paragraphs are separated by blank lines. Content renders via <PageContentView />."
        maxWidth={640}
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
            <Label htmlFor={`${formId}-title`}>Title</Label>
            <Input
              id={`${formId}-title`}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-subtitle`}>Subtitle</Label>
            <Input
              id={`${formId}-subtitle`}
              value={draft.subtitle}
              onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${formId}-content`}>Content</Label>
            <Textarea
              id={`${formId}-content`}
              rows={12}
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
