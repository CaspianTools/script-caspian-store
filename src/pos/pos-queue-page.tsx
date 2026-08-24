'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/locale-context';
import { InboxIcon, RefreshIcon, WifiOffIcon } from '../ui/icons';
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
      <div className="cpos-page">
        <div className="cpos-skeleton" style={{ height: 34, width: 240, marginBottom: 12 }} />
        <div className="cpos-skeleton" style={{ height: 18, width: 420, marginBottom: 22 }} />
        <div className="cpos-skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  const held = rows.filter((r) => r.state === 'held' || r.state === 'sending');
  const blocked = rows.filter((r) => r.state === 'blocked');
  const sent = rows.filter((r) => r.state === 'sent');

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <InboxIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.queue.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.queue.subtitle')}</p>
        </span>
      </div>

      <div className="cpos-stats" style={{ marginBottom: 18 }}>
        <div className="cpos-stat">
          <span className="cpos-stat__label">{t('pos.queue.stateHeld')}</span>
          <span className="cpos-stat__value">{held.length}</span>
        </div>
        <div className="cpos-stat">
          <span className="cpos-stat__label">{t('pos.queue.blockedTitle')}</span>
          <span
            className="cpos-stat__value"
            style={blocked.length ? { color: 'var(--cpos-danger)' } : undefined}
          >
            {blocked.length}
          </span>
        </div>
        <div className="cpos-stat">
          <span className="cpos-stat__label">{t('pos.queue.stateSent')}</span>
          <span className="cpos-stat__value">{sent.length}</span>
        </div>
      </div>

      {paused ? (
        <div className="cpos-note cpos-note--danger" style={{ marginBottom: 16 }}>
          {t('pos.queue.pausedBody')}
        </div>
      ) : null}

      <div className="cpos-row" style={{ alignItems: 'center', marginBottom: 20 }}>
        <button
          type="button"
          className="cpos-btn cpos-btn--primary"
          onClick={() => void sendNow()}
          disabled={busy || !online || !held.length}
        >
          {busy ? <span className="cpos-spinner" aria-hidden="true" /> : <RefreshIcon size={16} />}
          {t('pos.queue.sendNow')}
        </button>
        {!online ? (
          <span className="cpos-badge cpos-badge--warning">
            <WifiOffIcon size={13} />
            {t('pos.queue.offline')}
          </span>
        ) : null}
      </div>

      <Section title={t('pos.queue.heldTitle')} empty={t('pos.queue.heldEmpty')} rows={held}>
        {() => <span className="cpos-badge">{t('pos.queue.stateHeld')}</span>}
      </Section>

      <Section title={t('pos.queue.blockedTitle')} empty={t('pos.queue.blockedEmpty')} rows={blocked}>
        {(row) => (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="cpos-badge cpos-badge--danger">{row.lastErrorCode || 'error'}</span>
            <button
              type="button"
              className="cpos-btn cpos-btn--outline cpos-btn--sm"
              onClick={() => void queue?.retry(row.saleId).then(refresh)}
            >
              {t('pos.queue.retry')}
            </button>
          </span>
        )}
      </Section>

      {sent.length ? (
        <Section title={t('pos.queue.sentTitle')} empty="" rows={sent}>
          {() => <span className="cpos-badge cpos-badge--success">{t('pos.queue.stateSent')}</span>}
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
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
      <div className="cpos-cardhead">
        <h2 className="cpos-section__title">{title}</h2>
        {rows.length ? <span className="cpos-badge">{rows.length}</span> : null}
      </div>
      {rows.length === 0 ? (
        empty ? <p className="cpos-muted" style={{ margin: 0 }}>{empty}</p> : null
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row) => (
            <li key={row.saleId} className="cpos-line">
              <div className="cpos-line__row">
                <span className="cpos-line__main">
                  <span className="cpos-line__name">
                    {row.receiptNumber || `#${row.localRef}`}
                  </span>
                  <span className="cpos-line__meta" style={{ display: 'block' }}>
                    {new Date(row.capturedAtMillis).toLocaleString()} · {row.capturedTotal.toFixed(2)}
                    {row.capturedByName ? ` · ${row.capturedByName}` : ''}
                  </span>
                </span>
                {children(row)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
