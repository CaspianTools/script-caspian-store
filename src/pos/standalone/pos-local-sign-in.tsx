'use client';

import { useState, type FormEvent } from 'react';
import { useT } from '../../i18n/locale-context';
import { FieldDescription } from '../../ui/field-description';
import { ShoppingCartIcon } from '../../ui/icons';
import { usePosLocalSession } from './local-session-context';
import { MIN_LOCAL_PASSWORD_LENGTH } from './local-auth';


/**
 * Sign-in for a standalone till, and the one-time setup that precedes it.
 *
 * Both live in one component because they are the same screen at two moments
 * in a machine's life, and a shop should never see a sign-in form with no
 * account behind it — that is a dead end with no way out except reinstalling.
 */
export function PosLocalSignIn() {
  const { commissioned } = usePosLocalSession();
  // Its own canvas: this renders above PosShell, so nothing else is painting
  // the page behind it.
  return (
    <div className="cpos-signin-canvas">
      {commissioned ? <SignInForm /> : <CommissionForm />}
    </div>
  );
}

function SignInForm() {
  const t = useT();
  const { signIn } = usePosLocalSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ok = await signIn(username, password);
      if (!ok) setError(t('pos.local.badCredentials'));
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cpos-signin" onSubmit={submit}>
      <div className="cpos-signin__brand">
        <span className="cpos-signin__mark">
          <ShoppingCartIcon size={24} />
        </span>
        <h1 className="cpos-signin__h">{t('pos.local.signInTitle')}</h1>
        <p className="cpos-signin__sub">{t('pos.local.signInBody')}</p>
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor="caspian-local-username">
          {t('pos.local.username')}
        </label>
        <input
          className="cpos-input"
          id="caspian-local-username"
          value={username}
          autoFocus
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor="caspian-local-password">
          {t('pos.local.password')}
        </label>
        <input
          className="cpos-input"
          id="caspian-local-password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
        disabled={busy || !username || !password}
      >
        {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
        {busy ? t('pos.local.signingIn') : t('pos.local.signIn')}
      </button>
    </form>
  );
}

/**
 * First run. Creates the Technical Support account and nothing else.
 *
 * The shop's own accounts are made from the admin panel afterwards, by the
 * person who does this — which is the point of separating them: a till leaves
 * the installer's hands with exactly one account on it, and the owner's staff
 * are added deliberately rather than as a side effect of setup.
 */
function CommissionForm() {
  const t = useT();
  const { commission } = usePosLocalSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError(t('pos.local.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await commission({ username, displayName: '', password });
      if (!result.ok) {
        setError(
          result.reason === 'password-too-short'
            ? t('pos.local.passwordTooShort', { min: MIN_LOCAL_PASSWORD_LENGTH })
            : result.reason === 'username-taken'
              ? t('pos.local.usernameTaken')
              : t('pos.local.commissionFailed'),
        );
      }
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cpos-signin" onSubmit={submit}>
      <div className="cpos-signin__brand">
        <span className="cpos-signin__mark">
          <ShoppingCartIcon size={24} />
        </span>
        <h1 className="cpos-signin__h">{t('pos.local.commissionTitle')}</h1>
        <p className="cpos-signin__sub">{t('pos.local.commissionBody')}</p>
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor="caspian-commission-username">
          {t('pos.local.username')}
        </label>
        <input
          className="cpos-input"
          id="caspian-commission-username"
          value={username}
          autoFocus
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor="caspian-commission-password">
          {t('pos.local.password')}
        </label>
        <input
          className="cpos-input"
          id="caspian-commission-password"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <FieldDescription>
          {t('pos.local.passwordHelp', { min: MIN_LOCAL_PASSWORD_LENGTH })}
        </FieldDescription>
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor="caspian-commission-confirm">
          {t('pos.local.confirmPassword')}
        </label>
        <input
          className="cpos-input"
          id="caspian-commission-confirm"
          type="password"
          value={confirm}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
        disabled={busy || !username || !password || !confirm}
      >
        {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
        {busy ? t('pos.local.commissioning') : t('pos.local.commissionCta')}
      </button>
    </form>
  );
}
