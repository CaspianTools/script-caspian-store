'use client';

import { useEffect, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n';
import { Button, Dialog, Input, Label } from '../../ui';
import { useToast } from '../../ui/toast';
import { getPageSchedule, setPageSchedule } from '../../services/page-schedule-service';
import { useHomeEditor } from './home-editor-context';

/** A Firestore Timestamp → `yyyy-MM-ddThh:mm` (local) for <input type="datetime-local">. */
function toLocalInput(ts: Timestamp | null): string {
  const d = ts ? ts.toDate() : null;
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Schedule a future publish (and optional take-down) for the current page. The
 * `runScheduledPublish` Cloud Function publishes whatever draft exists at fire
 * time, so the dialog saves the draft first when there are unsaved edits.
 */
export function SchedulePublishDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { db, auth } = useCaspianFirebase();
  const { toast } = useToast();
  const { pageId, dirty, save } = useHomeEditor();
  const [publishAt, setPublishAt] = useState('');
  const [unpublishAt, setUnpublishAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPageSchedule(db, pageId)
      .then((s) => {
        if (!alive || !s) return;
        setPublishAt(toLocalInput(s.publishAt));
        setUnpublishAt(toLocalInput(s.unpublishAt));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [db, pageId]);

  const submit = async () => {
    setBusy(true);
    try {
      if (dirty) await save();
      await setPageSchedule(db, pageId, {
        publishAt: publishAt ? new Date(publishAt) : null,
        unpublishAt: unpublishAt ? new Date(unpublishAt) : null,
        uid: auth.currentUser?.uid,
      });
      toast({ title: t('pageBuilder.schedule.saved') });
      onClose();
    } catch {
      toast({ title: t('pageBuilder.schedule.failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('pageBuilder.schedule.title')}
      maxWidth={440}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {t('pageBuilder.schedule.save')}
          </Button>
        </div>
      }
    >
      <p className="pb-panel__note">{t('pageBuilder.schedule.note')}</p>
      <div className="pb-field">
        <Label>{t('pageBuilder.schedule.publishAt')}</Label>
        <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
      </div>
      <div className="pb-field">
        <Label>{t('pageBuilder.schedule.unpublishAt')}</Label>
        <Input type="datetime-local" value={unpublishAt} onChange={(e) => setUnpublishAt(e.target.value)} />
      </div>
    </Dialog>
  );
}
