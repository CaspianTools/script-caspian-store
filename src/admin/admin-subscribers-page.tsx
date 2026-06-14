'use client';

import { useEffect, useState } from 'react';
import type { Subscriber } from '../types';
import { deleteSubscriber, listSubscribers } from '../services/subscriber-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

export function AdminSubscribersPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setSubscribers(await listSubscribers(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list subscribers:', error);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = (subscribers ?? []).filter((s) =>
    search ? s.email.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const handleDelete = async (s: Subscriber) => {
    if (!confirm(`Remove ${s.email} from the subscriber list?`)) return;
    try {
      await deleteSubscriber(db, s.id);
      setSubscribers((prev) => (prev ? prev.filter((x) => x.id !== s.id) : prev));
      toast({ title: 'Subscriber removed' });
    } catch (error) {
      console.error('[caspian-store] Delete failed:', error);
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Subscribers</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          {subscribers === null ? '…' : `${subscribers.length} total`}
        </p>
      </header>

      <div style={{ marginBottom: 12, maxWidth: 320 }}>
        <Input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {subscribers === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : filtered.length === 0 ? (
        <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>No subscribers.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Subscribed at</TH>
              <TH style={{ textAlign: 'right' }}>Actions</TH>
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
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(s)}>
                    Remove
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
