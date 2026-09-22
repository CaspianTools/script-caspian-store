'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SearchTerm } from '../../types';
import {
  clearAllSearchTerms,
  deleteSearchTerm,
  listSearchTerms,
  type SearchTermSortBy,
} from '../../services/search-term-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Input } from '../../ui/input';
import { Select } from '../../ui/select';
import { Skeleton } from '../../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../../ui/table';
import { useToast } from '../../ui/toast';
import { DashboardSection } from './dashboard-section';

export function DashboardSearchTermsSection() {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [terms, setTerms] = useState<SearchTerm[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SearchTerm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [sortBy, setSortBy] = useState<SearchTermSortBy>('count');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTerms(await listSearchTerms(db, { sortBy }));
    } catch (error) {
      console.error('[caspian-store] Failed to load search terms:', error);
      setTerms((prev) => prev ?? []);
      toast({ title: t('admin.dashboard.searchTerms.loadFailed'), variant: 'destructive' });
    }
  }, [db, sortBy, toast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (terms ?? []).filter((term) =>
    search ? term.term.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const visible = showAll ? filtered : filtered.slice(0, 10);
  const hasMore = filtered.length > 10 && !showAll;
  const totalSearches = (terms ?? []).reduce((sum, term) => sum + term.count, 0);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await deleteSearchTerm(db, target.id);
      setTerms((prev) => (prev ? prev.filter((x) => x.id !== target.id) : prev));
      setPendingDelete(null);
      toast({ title: t('admin.dashboard.searchTerms.removed') });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: t('admin.dashboard.searchTerms.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!terms?.length) return;
    setClearing(true);
    try {
      const removed = await clearAllSearchTerms(db);
      setTerms([]);
      setConfirmClearAll(false);
      toast({ title: t('admin.dashboard.searchTerms.clearedAll', { count: removed }) });
    } catch (error) {
      console.error('[caspian-store] Clear all failed:', error);
      toast({ title: t('admin.dashboard.searchTerms.clearFailed'), variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <DashboardSection
      title={t('admin.dashboard.searchTerms.title')}
      subtitle={
        terms === null
          ? undefined
          : t('admin.dashboard.searchTerms.subtitle', {
              unique: terms.length,
              total: totalSearches,
            })
      }
      count={terms?.length}
      defaultOpen={false}
      anchorId="search-terms"
      action={
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmClearAll(true)}
          disabled={!terms?.length || clearing}
          loading={clearing}
        >
          {t('admin.dashboard.searchTerms.clearAll')}
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder={t('admin.dashboard.searchTerms.filterPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320, flex: 1 }}
        />
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SearchTermSortBy)}
          options={[
            { value: 'count', label: t('admin.dashboard.searchTerms.sort.count') },
            { value: 'lastSearchedAt', label: t('admin.dashboard.searchTerms.sort.recent') },
          ]}
          style={{ width: 180 }}
        />
      </div>

      {terms === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : filtered.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>
          {terms.length === 0
            ? t('admin.dashboard.searchTerms.empty')
            : t('admin.dashboard.searchTerms.noMatch')}
        </p>
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>{t('admin.dashboard.searchTerms.col.term')}</TH>
                <TH style={{ textAlign: 'right', width: 100 }}>
                  {t('admin.dashboard.searchTerms.col.searches')}
                </TH>
                <TH style={{ width: 200 }}>{t('admin.dashboard.searchTerms.col.last')}</TH>
                <TH style={{ width: 200 }}>{t('admin.dashboard.searchTerms.col.first')}</TH>
                <TH style={{ textAlign: 'right', width: 120 }}>
                  {t('admin.dashboard.searchTerms.col.actions')}
                </TH>
              </TR>
            </THead>
            <TBody>
              {visible.map((term) => (
                <TR key={term.id}>
                  <TD style={{ fontWeight: 500 }}>{term.term}</TD>
                  <TD style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {term.count.toLocaleString()}
                  </TD>
                  <TD style={{ color: '#888', fontSize: 13 }}>
                    {term.lastSearchedAt?.toDate ? term.lastSearchedAt.toDate().toLocaleString() : '—'}
                  </TD>
                  <TD style={{ color: '#888', fontSize: 13 }}>
                    {term.firstSearchedAt?.toDate ? term.firstSearchedAt.toDate().toLocaleString() : '—'}
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <Button variant="destructive" size="sm" onClick={() => setPendingDelete(term)}>
                      {t('common.delete')}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {hasMore && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                {t('admin.dashboard.searchTerms.showAll', { count: filtered.length })}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.confirm.deleteNamedTitle', { name: pendingDelete?.term ?? '' })}
        description={t('admin.dashboard.searchTerms.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={setConfirmClearAll}
        title={t('admin.dashboard.searchTerms.clearAllTitle', { count: terms?.length ?? 0 })}
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('admin.dashboard.searchTerms.clearAll')}
        destructive
        loading={clearing}
        onConfirm={handleClearAll}
      />
    </DashboardSection>
  );
}
