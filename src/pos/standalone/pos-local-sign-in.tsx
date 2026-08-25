'use client';

import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useLocaleControls, useT } from '../../i18n/locale-context';
import { BUILTIN_LOCALE_CODES, BUILTIN_LOCALE_NAMES } from '../../i18n/locales';
import { Select } from '../../ui/select';
import { EyeIcon, EyeOffIcon, LockIcon, ShoppingCartIcon } from '../../ui/icons';
import { cn } from '../../utils/cn';
import { usePosLocalSession } from './local-session-context';
import { localCryptoAvailable, MIN_LOCAL_PASSWORD_LENGTH } from './local-auth';

/**
 * Sign-in for a standalone till, the one-time setup that precedes it, and the
 * two states in which a machine can offer neither.
 *
 * All four live in one component because they are the same screen at four
 * moments in a machine's life, and which one a shop sees is decided by facts it
 * cannot influence from here. The order below is the whole logic, and the two
 * refusals come first on purpose: a till that cannot read its own records must
 * never be offered setup, because "no accounts found" and "could not look" are
 * indistinguishable from the outside and only one of them means the shop should
 * start over.
 */
export function PosLocalSignIn() {
  const { commissioned, storageFailed } = usePosLocalSession();
  const t = useT();

  // Checked before the form is wired rather than caught on submit. The throw
  // from `subtle()` used to land in the same catch as a blocked-storage error,
  // so a till served over plain http told its operator to go and look at their
  // site-data settings -- which is the one place the answer is not.
  if (!localCryptoAvailable()) {
    return (
      <SignInCanvas>
        <PosLocalNotice
          title={t('pos.local.insecureContextTitle')}
          body={t('pos.local.insecureContextBody')}
        />
      </SignInCanvas>
    );
  }

  if (storageFailed) {
    return (
      <SignInCanvas>
        <PosLocalNotice
          title={t('pos.local.storageFailedTitle')}
          body={t('pos.local.storageFailedBody')}
        />
      </SignInCanvas>
    );
  }

  return <SignInCanvas>{commissioned ? <SignInForm /> : <CommissionForm />}</SignInCanvas>;
}

/**
 * Its own canvas: this renders above PosShell, so nothing else is painting the
 * page behind it -- and it carries the language picker, because this is the only
 * screen a fresh till shows and a shop that cannot read English has nowhere else
 * to change it. A standalone till has no Firestore to publish a store default
 * either, so without this it would open in English and stay there.
 */
function SignInCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="cpos-signin-canvas">
      {children}
      <LanguagePicker />
    </div>
  );
}

function LanguagePicker() {
  const t = useT();
  const { locale, setLocale, pinned } = useLocaleControls();
  const id = useId();

  // A consumer that passed `locale` to the provider has taken this decision out
  // of the device's hands, and a picker that silently does nothing is worse than
  // no picker at all.
  if (pinned) return null;

  return (
    <div className="cpos-signin__lang">
      <label className="cpos-field__label" htmlFor={id}>
        {t('pos.local.language')}
      </label>
      <Select
        id={id}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        options={BUILTIN_LOCALE_CODES.map((code) => ({
          value: code,
          label: BUILTIN_LOCALE_NAMES[code] ?? code,
        }))}
      />
    </div>
  );
}

/** A dead end with an explanation. Shaped like the guard notices, and for the same reason. */
function PosLocalNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="cpos-signin cpos-signin--notice">
      <div className="cpos-signin__brand">
        <span className="cpos-signin__mark cpos-signin__mark--muted">
          <LockIcon size={24} />
        </span>
        <h1 className="cpos-signin__h">{title}</h1>
        <p className="cpos-signin__sub">{body}</p>
      </div>
    </div>
  );
}

/**
 * A password box with the two things a counter actually needs.
 *
 * The reveal toggle because a till is often a tablet with an on-screen keyboard
 * and no tactile feedback, and the caps-lock warning because a shift key left
 * down is the commonest reason a correct password is refused. Neither is a
 * nicety when the alternative is a queue and a phone call to whoever installed
 * the machine.
 */
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  describedBy?: string;
  invalid?: boolean;
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

/** True when a password would be typed differently by anyone reading it off paper. */
function hasEdgeSpace(password: string): boolean {
  return password.length > 0 && password !== password.trim();
}

function SignInForm() {
  const t = useT();
  const { signIn } = usePosLocalSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const usernameId = useId();
  const passwordId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const ok = await signIn(username.trim(), password);
      if (!ok) setError(t('pos.local.badCredentials'));
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cpos-signin" aria-labelledby={headingId} onSubmit={submit}>
      <div className="cpos-signin__brand">
        <span className="cpos-signin__mark">
          <ShoppingCartIcon size={24} />
        </span>
        <h1 className="cpos-signin__h" id={headingId}>
          {t('pos.local.signInTitle')}
        </h1>
        <p className="cpos-signin__sub">{t('pos.local.signInBody')}</p>
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor={usernameId}>
          {t('pos.local.username')}
        </label>
        <input
          className="cpos-input"
          id={usernameId}
          value={username}
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={error ? true : undefined}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <PasswordField
        id={passwordId}
        label={t('pos.local.password')}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        invalid={!!error}
      />

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
        disabled={busy || !username.trim() || !password}
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
 * person who does this -- which is the point of separating them: a till leaves
 * the installer's hands with exactly one account on it, and the owner's staff
 * are added deliberately rather than as a side effect of setup.
 */
function CommissionForm() {
  const t = useT();
  const { commission } = usePosLocalSession();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const usernameId = useId();
  const usernameHintId = useId();
  const displayNameId = useId();
  const displayNameHintId = useId();
  const passwordId = useId();
  const passwordHintId = useId();
  const confirmId = useId();

  const mismatch = confirm.length > 0 && password !== confirm;
  const matched = confirm.length > 0 && password === confirm;

  // Advisory, in the polite region, never blocking. Silently trimming would lock
  // out anybody whose password genuinely ends in a space, and refusing it
  // outright would forbid a password that is perfectly good written down.
  const note = mismatch
    ? { tone: 'danger' as const, text: t('pos.local.passwordMismatch') }
    : hasEdgeSpace(password)
      ? { tone: 'warning' as const, text: t('pos.local.passwordSpaces') }
      : matched
        ? { tone: 'success' as const, text: t('pos.local.passwordsMatch') }
        : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError(t('pos.local.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await commission({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      });
      if (!result.ok) {
        setError(
          result.reason === 'password-too-short'
            ? t('pos.local.passwordTooShort', { min: MIN_LOCAL_PASSWORD_LENGTH })
            : result.reason === 'username-taken'
              ? t('pos.local.usernameTaken')
              : result.reason === 'username-empty'
                ? t('pos.local.usernameEmpty')
                : result.reason === 'invalid-role'
                  ? t('pos.local.roleUnavailable')
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
    <form className="cpos-signin" aria-labelledby={headingId} onSubmit={submit}>
      <div className="cpos-signin__brand">
        <span className="cpos-signin__mark">
          <ShoppingCartIcon size={24} />
        </span>
        <h1 className="cpos-signin__h" id={headingId}>
          {t('pos.local.commissionTitle')}
        </h1>
        <p className="cpos-signin__sub">{t('pos.local.commissionBody')}</p>
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor={usernameId}>
          {t('pos.local.username')}
        </label>
        <input
          className="cpos-input"
          id={usernameId}
          value={username}
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-describedby={usernameHintId}
          onChange={(e) => setUsername(e.target.value)}
        />
        <p className="cpos-signin__hint" id={usernameHintId}>
          {t('pos.local.usernameHelp')}
        </p>
      </div>

      {/*
        Asked for, not derived. Leaving it blank fell back to the username --
        which `createLocalUser` has already lower-cased -- so the till spent the
        rest of its life calling the person who installed it "fuad".
      */}
      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor={displayNameId}>
          {t('pos.local.displayName')}
        </label>
        <input
          className="cpos-input"
          id={displayNameId}
          value={displayName}
          autoComplete="off"
          aria-describedby={displayNameHintId}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <p className="cpos-signin__hint" id={displayNameHintId}>
          {t('pos.local.displayNameHelp')}
        </p>
      </div>

      <PasswordField
        id={passwordId}
        label={t('pos.local.password')}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        describedBy={passwordHintId}
      />
      <p className="cpos-signin__hint" id={passwordHintId}>
        {t('pos.local.passwordHelp', { min: MIN_LOCAL_PASSWORD_LENGTH })}
      </p>

      <PasswordField
        id={confirmId}
        label={t('pos.local.confirmPassword')}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        invalid={mismatch}
      />

      {/*
        In the DOM from first paint with only its child changing. A role="status"
        node that mounts at the same instant its text appears is unreliable in
        NVDA and JAWS -- the announcement is lost about as often as it lands.
        Colour is never the only signal: every note here is a full sentence.
      */}
      <div aria-live="polite" role="status">
        {note ? (
          <div
            className={cn(
              'cpos-note',
              note.tone === 'danger'
                ? 'cpos-note--danger'
                : note.tone === 'success'
                  ? 'cpos-note--success'
                  : 'cpos-note--warning',
            )}
          >
            {note.text}
          </div>
        ) : null}
      </div>

      {/* The refusal to create the account is blocking, so it interrupts rather than waits. */}
      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
        disabled={busy || !username.trim() || !password || !confirm}
      >
        {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
        {busy ? t('pos.local.commissioning') : t('pos.local.commissionCta')}
      </button>
    </form>
  );
}
