'use client';

import { useState, type FormEvent } from 'react';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { FieldDescription } from '../../ui/field-description';
import { usePosLocalSession } from './local-session-context';
import { MIN_LOCAL_PASSWORD_LENGTH } from './local-auth';

const wrap: React.CSSProperties = {
  maxWidth: 380,
  margin: '0 auto',
  padding: 40,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600 };
const errorStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--caspian-danger, #b3261e)',
  minHeight: 18,
};

/**
 * Sign-in for a standalone till, and the one-time setup that precedes it.
 *
 * Both live in one component because they are the same screen at two moments
 * in a machine's life, and a shop should never see a sign-in form with no
 * account behind it — that is a dead end with no way out except reinstalling.
 */
export function PosLocalSignIn() {
  const { commissioned } = usePosLocalSession();
  return commissioned ? <SignInForm /> : <CommissionForm />;
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
    <form style={wrap} onSubmit={submit}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('pos.local.signInTitle')}</h1>
        <p style={{ color: '#666', marginTop: 6, fontSize: 14 }}>{t('pos.local.signInBody')}</p>
      </div>

      <div style={field}>
        <label style={label} htmlFor="caspian-local-username">
          {t('pos.local.username')}
        </label>
        <Input
          id="caspian-local-username"
          value={username}
          autoFocus
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div style={field}>
        <label style={label} htmlFor="caspian-local-password">
          {t('pos.local.password')}
        </label>
        <Input
          id="caspian-local-password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div style={errorStyle}>{error}</div>
      <Button type="submit" disabled={busy || !username || !password}>
        {busy ? t('pos.local.signingIn') : t('pos.local.signIn')}
      </Button>
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
    <form style={wrap} onSubmit={submit}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {t('pos.local.commissionTitle')}
        </h1>
        <p style={{ color: '#666', marginTop: 6, fontSize: 14 }}>
          {t('pos.local.commissionBody')}
        </p>
      </div>

      <div style={field}>
        <label style={label} htmlFor="caspian-commission-username">
          {t('pos.local.username')}
        </label>
        <Input
          id="caspian-commission-username"
          value={username}
          autoFocus
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div style={field}>
        <label style={label} htmlFor="caspian-commission-password">
          {t('pos.local.password')}
        </label>
        <Input
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

      <div style={field}>
        <label style={label} htmlFor="caspian-commission-confirm">
          {t('pos.local.confirmPassword')}
        </label>
        <Input
          id="caspian-commission-confirm"
          type="password"
          value={confirm}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <div style={errorStyle}>{error}</div>
      <Button type="submit" disabled={busy || !username || !password || !confirm}>
        {busy ? t('pos.local.commissioning') : t('pos.local.commissionCta')}
      </Button>
    </form>
  );
}
