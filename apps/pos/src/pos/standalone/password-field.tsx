'use client';

import { useState, type KeyboardEvent } from 'react';
import { usePosT as useT } from '../../i18n/use-pos-t';
import { EyeIcon, EyeOffIcon } from '../../icons';

/**
 * A password box for the till, with the two affordances a counter needs.
 *
 * The reveal toggle because a till is often a tablet with an on-screen keyboard
 * and no tactile feedback, and the caps-lock warning because a shift key left
 * down is the commonest reason a correct password is refused. Neither is a
 * nicety when the alternative is a queue and a phone call to whoever installed
 * the machine.
 *
 * It lives in its own file rather than beside the sign-in form because four
 * screens now ask for a password -- setting the till up, signing in, unlocking
 * it, and changing an account's password -- and the lock screen shipped in
 * v1.0.0 with a hand-copied box that had the reveal button but no caps-lock
 * listener. That is exactly the screen a cashier hits after a break, with the
 * shift key they left down still down.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  describedBy?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
  };

  return (
    <div className="cpos-field">
      <label className="cpos-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="cpos-field__control">
        <input
          className="cpos-input cpos-input--revealable"
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onKeyDown={trackCapsLock}
          onKeyUp={trackCapsLock}
          onBlur={() => setCapsLock(false)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="cpos-input__reveal"
          aria-pressed={revealed}
          aria-label={revealed ? t('pos.local.hidePassword') : t('pos.local.showPassword')}
          title={revealed ? t('pos.local.hidePassword') : t('pos.local.showPassword')}
          onClick={() => setRevealed((on) => !on)}
        >
          {revealed ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      {capsLock ? (
        <div className="cpos-note cpos-note--warning" role="status">
          {t('pos.local.capsLock')}
        </div>
      ) : null}
    </div>
  );
}
