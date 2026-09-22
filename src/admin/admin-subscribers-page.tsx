'use client';

import { useEffect, useState } from 'react';
import type { Subscriber } from '../types';
import { deleteSubscriber, listSubscribers } from '../services/subscriber-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

export function AdminSubscribersPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Subscriber | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    listSubscribers(db)
      .then((list) => {
        if (alive) setSubscribers(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to list subscribers:', error);
        if (!alive) return;
        setSubscribers([]);
        toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const filtered = (subscribers ?? []).filter((s) =>
    search ? s.email.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const handleDelete = async () => {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    try {
      await deleteSubscriber(db, target.id);
      setSubscribers((prev) => (prev ? prev.filter((x) => x.id !== target.id) : prev));
      setPendingDelete(null);
      toast({ title: t('admin.subscribers.removed') });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.subscribers.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          {subscribers === null ? '…' : t('admin.subscribers.total', { count: subscribers.length })}
        </p>
      </header>

      <div style={{ marginBottom: 12, maxWidth: 320 }}>
        <Input
          placeholder={t('admin.subscribers.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {subscribers === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : filtered.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>{t('admin.subscribers.empty')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.subscribers.col.email')}</TH>
              <TH>{t('admin.subscribers.col.subscribedAt')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.subscribers.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((s) => (
              <TR key={s.id}>
                <TD style={{ fontWeight: 500 }}>{s.email}</TD>
                <TD style={{ color: '#888', fontSize: 13 }}>
                  {s.subscribedAt?.toDate
                    ? s.subscribedAt.toDate().toLocaleString()
                    : '—'}
                </TD>
                <TD style={{ textAlign: 'right' }}>
                  <Button variant="destructive" size="sm" onClick={() => setPendingDelete(s)}>
                    {t('admin.subscribers.remove')}
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={t('admin.subscribers.removeTitle', { email: pendingDelete?.email ?? '' })}
        description={t('admin.subscribers.removeBody')}
        confirmLabel={t('admin.subscribers.remove')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
