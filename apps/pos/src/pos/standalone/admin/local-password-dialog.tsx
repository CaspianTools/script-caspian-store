'use client';

import { useEffect, useId, useState } from 'react';
import { useToast, FieldDescription } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import { PosDialog } from '../ui/pos-dialog';
import {
  MIN_LOCAL_PASSWORD_LENGTH,
  passwordIsWeak,
  setLocalPassword,
  verifyLocalPassword,
} from '../local-auth';
import { PasswordField } from '../password-field';
import type { LocalUser } from '../types';

export interface LocalPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whose password is being set. */
  user: LocalUser | null;
  /**
   * True when the signed-in cashier is changing their own password.
   *
   * Adds the current-password box. Somebody who walked away from an unlocked
   * till should not have their password changed out from under them by whoever
   * sat down next -- and unlike the admin path, there is no second person here
   * who had to hold `people.edit` to get this far.
   */
  self?: boolean;
  onSaved?: () => void;
}

/**
 * Set an account's password.
 *
 * Replaces the `window.prompt` the People screen used until v1.1.0, which echoed
 * the new password in clear text on a screen facing the shop floor, offered no
 * confirmation box, and in an installed PWA renders as a bare browser chrome
 * dialog that some platforms suppress entirely.
 *
 * One component for both cases -- an owner resetting a cashier, and a cashier
 * changing their own -- because they differ by one field and would otherwise
 * drift apart on the day the password rules change.
 */
export function LocalPasswordDialog({
  open,
  onOpenChange,
  user,
  self,
  onSaved,
}: LocalPasswordDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const currentId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const hintId = useId();

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setPassword('');
    setConfirm('');
    setError('');
    setBusy(false);
  }, [open]);

  const tooShort = password.length > 0 && password.length < MIN_LOCAL_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const weak = password.length >= MIN_LOCAL_PASSWORD_LENGTH && passwordIsWeak(password, user?.username ?? '');
  const ready =
    !!user &&
    password.length >= MIN_LOCAL_PASSWORD_LENGTH &&
    confirm === password &&
    !weak &&
    (!self || current.length > 0);

  const save = async () => {
    if (!user || !ready || busy) return;
    setBusy(true);
    setError('');
    try {
      if (self && !(await verifyLocalPassword(current, user))) {
        setError(t('pos.local.wrongCurrentPassword'));
        return;
      }
      const done = await setLocalPassword(user.id, password);
      if (!done) {
        setError(t('pos.local.passwordTooShort'));
        return;
      }
      toast({ title: t('pos.admin.people.passwordChanged') });
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  const who = user?.displayName || user?.username || '';

  return (
    <PosDialog
      closeLabel={t('common.close')}
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={self ? t('pos.local.changeMyPasswordTitle') : t('pos.admin.people.passwordTitle', { name: who })}
      foot={
        <>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="cpos-btn cpos-btn--primary"
            onClick={save}
            disabled={!ready || busy}
          >
            {t('pos.admin.people.passwordCta')}
          </button>
        </>
      }
    >
      {self ? (
        <PasswordField
          id={currentId}
          label={t('pos.local.currentPassword')}
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
      ) : null}

      <PasswordField
        id={passwordId}
        label={t('pos.admin.people.newPassword')}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        describedBy={hintId}
        invalid={tooShort || weak}
      />
      <FieldDescription>
        <span id={hintId}>{t('pos.local.passwordHelp', { min: MIN_LOCAL_PASSWORD_LENGTH })}</span>
      </FieldDescription>

      <PasswordField
        id={confirmId}
        label={t('pos.local.confirmPassword')}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        invalid={mismatch}
      />

      {/*
        Mounted from first paint with only its child changing, rather than
        appearing when there is something to say. A `role="status"` node that
        mounts already carrying its text is missed by screen readers about half
        the time.
      */}
      <div className="cpos-muted" aria-live="polite">
        {tooShort ? t('pos.local.passwordTooShort') : null}
        {weak ? t('pos.local.passwordWeak') : null}
        {mismatch ? t('pos.local.passwordMismatch') : null}
        {!mismatch && confirm.length > 0 && confirm === password ? t('pos.local.passwordsMatch') : null}
      </div>

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
    </PosDialog>
  );
}
