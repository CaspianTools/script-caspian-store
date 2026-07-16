'use client';

import { useEffect, useState } from 'react';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n';
import { Button, Dialog } from '../../ui';
import { useToast } from '../../ui/toast';
import type { PageRevisionMeta } from '../../types';
import { getRevisionBlocks, listRevisions } from '../../services/page-revision-service';
import { useHomeEditor } from './home-editor-context';

/**
 * Published-layout revision history (v9.5). Lists prior published versions and
 * lets an admin load one back into the working draft — non-destructive: the live
 * page is unchanged until the admin reviews and hits Publish.
 */
export function RevisionHistoryPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const { pageId, restoreRevisionBlocks } = useHomeEditor();
  const [revisions, setRevisions] = useState<PageRevisionMeta[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    listRevisions(db, pageId)
      .then((r) => alive && setRevisions(r))
      .catch(() => alive && setRevisions([]));
    return () => {
      alive = false;
    };
  }, [db, pageId]);

  const restore = async (version: number) => {
    setBusy(true);
    try {
      const blocks = await getRevisionBlocks(db, pageId, version);
      if (blocks) {
        restoreRevisionBlocks(blocks);
        toast({ title: t('pageBuilder.history.restored', { version: String(version) }) });
        onClose();
      }
    } catch {
      toast({ title: t('pageBuilder.history.restoreFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (ts: PageRevisionMeta['createdAt']): string => {
    try {
      return ts?.toDate ? ts.toDate().toLocaleString() : '';
    } catch {
      return '';
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('pageBuilder.history.title')} maxWidth={520}>
      <p className="pb-panel__note">{t('pageBuilder.history.note')}</p>
      {revisions === null ? (
        <p className="pb-panel__note">{t('common.loading')}</p>
      ) : revisions.length === 0 ? (
        <p className="pb-panel__note">{t('pageBuilder.history.empty')}</p>
      ) : (
        <ul className="pb-history">
          {revisions.map((r) => (
            <li key={r.version} className="pb-history__row">
              <div className="pb-history__meta">
                <strong>{t('pageBuilder.history.version', { version: String(r.version) })}</strong>
                <span className="pb-history__sub">
                  {fmt(r.createdAt)}
                  {r.createdByName ? ` · ${r.createdByName}` : ''}
                </span>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void restore(r.version)}>
                {t('pageBuilder.history.restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
