'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT, Button } from '@caspian-explorer/script-caspian-store';
import {
  ensurePosStoragePersisted,
  formatBytes,
  readPosStorageHealth,
  storageIsTight,
  type PosStorageHealth,
} from './pos-storage-durability';

/**
 * Whether this computer is actually keeping the shop's data.
 *
 * Exists because every failure this guards against is silent. An evicted origin
 * looks exactly like a new one; a database that will not open looks exactly like
 * a till that has never sold anything. Putting the answer on a screen is what
 * turns "the sales disappeared" into a question with an answer.
 */
export function PosStorageHealthCard() {
  const t = useT();
  const [health, setHealth] = useState<PosStorageHealth | null>(null);
  const [asking, setAsking] = useState(false);

  const refresh = useCallback(async () => {
    setHealth(await readPosStorageHealth());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const askForPersistence = async () => {
    setAsking(true);
    try {
      await ensurePosStoragePersisted();
      await refresh();
    } finally {
      setAsking(false);
    }
  };

  if (!health) return null;

  const tight = storageIsTight(health);
  const dbBroken = health.db.state !== 'ok';

  return (
    <div className="cpos-card cpos-card--pad" style={{ gap: 10, marginTop: 12 }}>
      <strong>{t('pos.settings.storage.healthTitle')}</strong>

      <Row
        label={t('pos.settings.storage.persisted')}
        value={
          health.unknown
            ? t('pos.settings.storage.persistedUnknown')
            : health.persisted
              ? t('pos.settings.storage.persistedYes')
              : t('pos.settings.storage.persistedNo')
        }
        tone={health.unknown ? 'muted' : health.persisted ? 'ok' : 'warn'}
      />

      <Row
        label={t('pos.settings.storage.database')}
        value={
          health.db.state === 'ok'
            ? t('pos.settings.storage.databaseOk')
            : health.db.state === 'blocked'
              ? t('pos.settings.storage.databaseBlocked')
              : health.db.message
        }
        tone={dbBroken ? 'warn' : 'ok'}
      />

      {health.usage !== null ? (
        <Row
          label={t('pos.settings.storage.used')}
          value={
            health.quota !== null
              ? t('pos.settings.storage.usedOf', {
                  used: formatBytes(health.usage),
                  total: formatBytes(health.quota),
                })
              : formatBytes(health.usage)
          }
          tone={tight ? 'warn' : 'muted'}
        />
      ) : null}

      {!health.persisted && !health.unknown ? (
        <p className="cpos-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          {t('pos.settings.storage.persistHelp')}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!health.persisted && !health.unknown ? (
          <Button size="sm" onClick={askForPersistence} disabled={asking}>
            {t('pos.settings.storage.persistAsk')}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t('pos.settings.storage.recheck')}
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'muted';
}) {
  const color =
    tone === 'warn' ? 'var(--cpos-warning)' : tone === 'ok' ? 'var(--cpos-success)' : undefined;
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 13,
      }}
    >
      <span className="cpos-muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', color }}>{value}</span>
    </div>
  );
}
