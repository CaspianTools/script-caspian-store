'use client';

import { useState } from 'react';
import type { Breakpoint } from '../../types';
import { useT } from '../../i18n';
import { Button } from '../../ui';
import { cn } from '../../utils/cn';
import { useHomeEditor } from './home-editor-context';
import { RevisionHistoryPanel } from './revision-history-panel';
import { SchedulePublishDialog } from './schedule-publish-dialog';

const DEVICES: { bp: Breakpoint; labelKey: string; glyph: string }[] = [
  { bp: 'desktop', labelKey: 'pageBuilder.device.desktop', glyph: '🖥' },
  { bp: 'tablet', labelKey: 'pageBuilder.device.tablet', glyph: '▭' },
  { bp: 'mobile', labelKey: 'pageBuilder.device.mobile', glyph: '▯' },
];

/** Floating device-switch / status / undo-redo / save / publish bar shown while editing. */
export function EditorToolbar() {
  const t = useT();
  const {
    dirty,
    saving,
    autosaving,
    canUndo,
    canRedo,
    breakpoint,
    setBreakpoint,
    save,
    undo,
    redo,
    resetToDefault,
    exitEdit,
    hasUnpublishedChanges,
    publish,
    conflict,
    resolveConflictReload,
    resolveConflictOverwrite,
  } = useHomeEditor();
  const [showHistory, setShowHistory] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const handleExit = () => {
    if (dirty && typeof window !== 'undefined' && !window.confirm(t('pageBuilder.discardConfirm'))) {
      return;
    }
    exitEdit();
  };

  const statusLabel = autosaving
    ? t('pageBuilder.saving')
    : dirty
      ? t('pageBuilder.unsaved')
      : hasUnpublishedChanges
        ? t('pageBuilder.unpublishedChanges')
        : t('pageBuilder.allPublished');

  return (
    <>
      {conflict && (
        <div className="pb-conflict" role="alert">
          <span>{conflict.by ? t('pageBuilder.conflict.by', { name: conflict.by }) : t('pageBuilder.conflict.title')}</span>
          <div className="pb-conflict__actions">
            <Button size="sm" variant="outline" onClick={() => void resolveConflictReload()}>
              {t('pageBuilder.conflict.reload')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void resolveConflictOverwrite()}>
              {t('pageBuilder.conflict.overwrite')}
            </Button>
          </div>
        </div>
      )}
      <div className="pb-toolbar" role="toolbar" aria-label={t('pageBuilder.toolbar')}>
        <span className="pb-toolbar__status">
          <span
            className={cn(
              'pb-toolbar__dot',
              (dirty || hasUnpublishedChanges) && 'pb-toolbar__dot--dirty',
            )}
          />
          {statusLabel}
        </span>
        <div className="pb-toolbar__devices" role="group" aria-label={t('pageBuilder.device.group')}>
          {DEVICES.map((d) => (
            <button
              key={d.bp}
              type="button"
              className={cn('pb-device-btn', breakpoint === d.bp && 'pb-device-btn--active')}
              aria-pressed={breakpoint === d.bp}
              title={t(d.labelKey)}
              aria-label={t(d.labelKey)}
              onClick={() => setBreakpoint(d.bp)}
            >
              {d.glyph}
            </button>
          ))}
        </div>
        <div className="pb-toolbar__actions">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
            {t('pageBuilder.undo')}
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}>
            {t('pageBuilder.redo')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
            {t('pageBuilder.history')}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetToDefault}>
            {t('pageBuilder.reset')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExit}>
            {t('pageBuilder.exit')}
          </Button>
          <Button variant="outline" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
            {t('pageBuilder.save')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSchedule(true)}>
            {t('pageBuilder.schedule')}
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!dirty && !hasUnpublishedChanges}
            onClick={() => void publish()}
          >
            {t('pageBuilder.publish')}
          </Button>
        </div>
      </div>
      {showHistory && <RevisionHistoryPanel onClose={() => setShowHistory(false)} />}
      {showSchedule && <SchedulePublishDialog onClose={() => setShowSchedule(false)} />}
    </>
  );
}
