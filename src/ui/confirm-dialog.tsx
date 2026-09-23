'use client';

import { useCallback, type ReactNode } from 'react';
import { useT } from '../i18n/locale-context';
import { Button } from './button';
import { Dialog } from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

/**
 * Accessible replacement for `window.confirm()`. Built on `<Dialog>` so it
 * traps focus, closes on Escape and returns focus to the trigger. While
 * `loading` the dialog refuses to close so a double-tap can't dismiss an
 * in-flight delete.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const t = useT();
  // Stable identity: <Dialog> re-runs its focus/keyboard effect whenever
  // this prop changes, so an inline arrow would bounce focus on each render.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (loading && !next) return;
      onOpenChange(next);
    },
    [loading, onOpenChange],
  );
  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      maxWidth={420}
      showClose={!loading}
      footer={
        <>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'primary'}
            loading={loading}
            onClick={() => {
              void onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
