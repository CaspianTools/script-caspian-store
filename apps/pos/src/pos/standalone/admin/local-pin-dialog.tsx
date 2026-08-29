'use client';

import { useEffect, useId, useState } from 'react';
import { useToast } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import { PosDialog } from '../ui/pos-dialog';
import { PasswordField } from '../password-field';
import {
  MIN_LOCAL_PIN_LENGTH,
  clearLocalPin,
  pinIsValidShape,
  pinIsWeak,
  setLocalPin,
  verifyLocalPassword,
} from '../local-auth';
import type { LocalUser } from '../types';

export interface LocalPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whose PIN. Always the signed-in account — see the note below. */
  user: LocalUser | null;
  onSaved?: () => void;
}

/**
 * Set, change or remove the unlock PIN.
 *
 * Only ever offered on the holder's OWN account, and always behind the current
 * password. Not from the People screen, deliberately: an owner able to set a
 * cashier's PIN could unlock as that cashier, and every receipt rung that way
 * would carry the wrong name — the attribution the till goes to such lengths to
 * keep honest. The password requirement is the same rule as the change-password
 * dialog: somebody who sat down at an unlocked till must not be able to mint
 * themselves a way back in.
 */
export function LocalPinDialog({ open, onOpenChange, user, onSaved }: LocalPinDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const currentId = useId();
  const pinId = useId();
  const confirmId = useId();

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setPin('');
    setConfirm('');
    setError('');
    setBusy(false);
  }, [open]);

  const hasPin = !!user?.pinHash;
  const shapeOk = pinIsValidShape(pin);
  const weak = shapeOk && pinIsWeak(pin);
  const mismatch = confirm.length > 0 && confirm !== pin;
  const ready = !!user && shapeOk && !weak && confirm === pin && current.length > 0;

  const note = !shapeOk && pin.length > 0
    ? { tone: 'warning' as const, text: t('pos.pin.shape', { min: MIN_LOCAL_PIN_LENGTH }) }
    : weak
      ? { tone: 'danger' as const, text: t('pos.pin.weak') }
      : mismatch
        ? { tone: 'danger' as const, text: t('pos.pin.mismatch') }
        : null;

  const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '');

  const save = async () => {
    if (!user || !ready || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!(await verifyLocalPassword(current, user))) {
        setError(t('pos.local.wrongCurrentPassword'));
        return;
      }
      const result = await setLocalPin(user.id, pin);
      if (!result.ok) {
        setError(result.reason === 'weak' ? t('pos.pin.weak') : t('pos.pin.shape', { min: MIN_LOCAL_PIN_LENGTH }));
        return;
      }
      toast({ title: t('pos.pin.saved') });
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user || busy || !current) return;
    setBusy(true);
    setError('');
    try {
      if (!(await verifyLocalPassword(current, user))) {
        setError(t('pos.local.wrongCurrentPassword'));
        return;
      }
      await clearLocalPin(user.id);
      toast({ title: t('pos.pin.removed') });
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PosDialog
      closeLabel={t('common.close')}
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={hasPin ? t('pos.pin.changeTitle') : t('pos.pin.setTitle')}
      description={t('pos.pin.body')}
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
          {hasPin ? (
            <button
              type="button"
              className="cpos-btn cpos-btn--danger"
              onClick={() => void remove()}
              disabled={busy || !current}
              title={!current ? t('pos.pin.passwordFirst') : undefined}
            >
              {t('pos.pin.remove')}
            </button>
          ) : null}
          <button
            type="button"
            className="cpos-btn cpos-btn--primary"
            onClick={() => void save()}
            disabled={!ready || busy}
          >
            {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
            {t('common.save')}
          </button>
        </>
      }
    >
      <PasswordField
        id={currentId}
        label={t('pos.local.currentPassword')}
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        autoFocus
      />

      <label className="cpos-field" htmlFor={pinId}>
        <span className="cpos-field__label">{t('pos.pin.newPin', { min: MIN_LOCAL_PIN_LENGTH })}</span>
        <input
          id={pinId}
          className="cpos-input"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(event) => setPin(digitsOnly(event.target.value))}
          style={{ textAlign: 'center', letterSpacing: '0.3em' }}
        />
      </label>

      <label className="cpos-field" htmlFor={confirmId}>
        <span className="cpos-field__label">{t('pos.pin.confirmPin')}</span>
        <input
          id={confirmId}
          className="cpos-input"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={confirm}
          onChange={(event) => setConfirm(digitsOnly(event.target.value))}
          aria-invalid={mismatch ? true : undefined}
          style={{ textAlign: 'center', letterSpacing: '0.3em' }}
        />
      </label>

      {note ? (
        <div className={`cpos-note cpos-note--${note.tone}`} role="status">
          {note.text}
        </div>
      ) : null}

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
    </PosDialog>
  );
}
