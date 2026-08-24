'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Badge, Skeleton } from '../ui/misc';
import { usePosAdapter } from './pos-adapter-context';
import { usePosQueue } from './offline/use-pos-queue';
import type { QueuedSale } from './offline/types';

/**
 * Held sales on this till: `/pos/queue`.
 *
 * Exists because a sale that cannot be sent has to be visible to the person who
 * took the money. Without this page a blocked sale is money in the drawer with
 * no record anywhere a cashier can see — which is exactly the failure the queue
 * was built to prevent.
 *
 * Deliberately has no "delete" for a held sale. Forgetting one destroys the only
 * copy of a real transaction, so the only removal offered is on a sale the
 * server has already accepted.
 */
export function PosQueuePage() {
  const t = useT();
  const [rows, setRows] = useState<QueuedSale[] | null>(null);
  const [busy, setBusy] = useState(false);

  // The register's own outbox, not a second view of the same IndexedDB: a
  // separate instance would not see this page's `retry()` in its own counts.
  const { queue } = usePosAdapter();
  const { counts, online, paused } = usePosQueue(queue);

  const refresh = useCallback(async () => {
    if (!queue) {
      setRows([]);
      return;
    }
    try {
      setRows(await queue.list());
    } catch {
      setRows([]);
    }
  }, [queue]);

  useEffect(() => {
    void refresh();
  }, [refresh, counts.held, counts.blocked, counts.sending]);

  const sendNow = async () => {
    if (!queue) return;
    setBusy(true);
    try {
      await queue.drain();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 28, width: 220 }} />
        <Skeleton style={{ height: 160 }} />
      </div>
    );
  }

  const held = rows.filter((r) => r.state === 'held' || r.state === 'sending');
  const blocked = rows.filter((r) => r.state === 'blocked');
  const sent = rows.filter((r) => r.state === 'sent');

  return (
    <div style={{ padding: 24, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t('pos.queue.title')}</h1>
        <p style={{ color: '#666', margin: '6px 0 0', fontSize: 14 }}>{t('pos.queue.subtitle')}</p>
      </header>

      {paused ? <div style={alert}>{t('pos.queue.pausedBody')}</div> : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button onClick={() => void sendNow()} loading={busy} disabled={!online || !held.length}>
          {t('pos.queue.sendNow')}
        </Button>
        {!online ? <span style={{ fontSize: 13, color: '#8a5a00' }}>{t('pos.queue.offline')}</span> : null}
      </div>

      <Section title={t('pos.queue.heldTitle')} empty={t('pos.queue.heldEmpty')} rows={held}>
        {() => <Badge variant="outline">{t('pos.queue.stateHeld')}</Badge>}
      </Section>

      <Section title={t('pos.queue.blockedTitle')} empty={t('pos.queue.blockedEmpty')} rows={blocked}>
        {(row) => (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge variant="secondary">{row.lastErrorCode || 'error'}</Badge>
            <Button size="sm" variant="outline" onClick={() => void queue?.retry(row.saleId).then(refresh)}>
              {t('pos.queue.retry')}
            </Button>
          </span>
        )}
      </Section>

      {sent.length ? (
        <Section title={t('pos.queue.sentTitle')} empty="" rows={sent}>
          {() => <Badge variant="outline">{t('pos.queue.stateSent')}</Badge>}
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  empty,
  rows,
  children,
}: {
  title: string;
  empty: string;
  rows: QueuedSale[];
  children: (row: QueuedSale) => React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontSize: 15, margin: 0 }}>
        {title} {rows.length ? `(${rows.length})` : ''}
      </h2>
      {rows.length === 0 ? (
        empty ? (
          <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{empty}</p>
        ) : null
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row) => (
            <li key={row.saleId} style={rowStyle}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 14 }}>{row.receiptNumber || `#${row.localRef}`}</strong>
                <div style={{ fontSize: 12.5, color: '#666' }}>
                  {new Date(row.capturedAtMillis).toLocaleString()} · {row.capturedTotal.toFixed(2)}
                  {row.capturedByName ? ` · ${row.capturedByName}` : ''}
                </div>
              </span>
              {children(row)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
};

const alert: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: '#fef3f2',
  border: '1px solid #fda29b',
  color: '#b42318',
  fontSize: 13,
};
