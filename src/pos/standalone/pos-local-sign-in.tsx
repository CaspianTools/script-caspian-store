'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useLocaleControls, useT } from '../../i18n/locale-context';
import { BUILTIN_LOCALE_CODES, BUILTIN_LOCALE_NAMES } from '../../i18n/locales';
import { LockIcon, ShoppingCartIcon } from '../../ui/icons';
import { cn } from '../../utils/cn';
import { usePosLocalSession } from './local-session-context';
import { localCryptoAvailable, MIN_LOCAL_PASSWORD_LENGTH, passwordIsWeak } from './local-auth';
import { throttleWaitSeconds } from './sign-in-throttle';
import { PasswordField } from './password-field';
import { PosLocalRecovery, RecoveryCodeBlock } from './pos-local-recovery';
import { mintRecoveryCode } from './recovery-code';
import { PosSelect } from './ui/pos-field';

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
  // Signed-out only, and state rather than a route: there is no address that
  // reaches this, so a session cannot be talked into rendering it.
  const [recovering, setRecovering] = useState(false);

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

  if (recovering && commissioned) {
    return (
      <SignInCanvas>
        <PosLocalRecovery onDone={() => setRecovering(false)} />
      </SignInCanvas>
    );
  }

  return (
    <SignInCanvas>
      {commissioned ? <SignInForm onLockedOut={() => setRecovering(true)} /> : <CommissionForm />}
    </SignInCanvas>
  );
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
      <PosSelect
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

/** True when a password would be typed differently by anyone reading it off paper. */
function hasEdgeSpace(password: string): boolean {
  return password.length > 0 && password !== password.trim();
}

function SignInForm({ onLockedOut }: { onLockedOut: () => void }) {
  const t = useT();
  const { attemptSignIn } = usePosLocalSession();
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
      const result = await attemptSignIn(username.trim(), password);
      if (!result.ok) {
        // A refusal says which of the two it is. "Wrong password" while the
        // till is silently ignoring the attempt is how somebody ends up typing
        // it eight more times and making the wait longer.
        setError(
          result.reason === 'throttled'
            ? t('pos.local.throttled', { seconds: throttleWaitSeconds(result.waitMillis) })
            : t('pos.local.badCredentials'),
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

      {/*
        Quiet, and at the foot, because the overwhelming majority of the people
        who read this screen are simply starting a shift. It is a way out for
        the rare morning nobody can get in, not an invitation.
      */}
      <button type="button" className="cpos-signin__foot-link" onClick={onLockedOut}>
        {t('pos.recovery.link')}
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
  const weak =
    password.length >= MIN_LOCAL_PASSWORD_LENGTH && passwordIsWeak(password, username);

  /*
    Minted here, and shown before anything is written.

    The obvious arrangement -- commission, then show the code -- cannot work:
    `commission` sets the signed-in account, at which point `PosGuard` swaps this
    whole screen for the register and the code is gone before anybody reads it.
    Doing it in this order also means closing the tab on the code screen leaves
    the machine exactly as it was, with no half-set-up account on it.
  */
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Advisory, in the polite region, never blocking. Silently trimming would lock
  // out anybody whose password genuinely ends in a space, and refusing it
  // outright would forbid a password that is perfectly good written down.
  const note = mismatch
    ? { tone: 'danger' as const, text: t('pos.local.passwordMismatch') }
    : weak
      ? { tone: 'danger' as const, text: t('pos.local.passwordWeak') }
      : hasEdgeSpace(password)
        ? { tone: 'warning' as const, text: t('pos.local.passwordSpaces') }
        : matched
          ? { tone: 'success' as const, text: t('pos.local.passwordsMatch') }
          : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError(t('pos.local.passwordMismatch'));
      return;
    }
    if (weak) {
      setError(t('pos.local.passwordWeak'));
      return;
    }
    setError('');
    setPendingCode(mintRecoveryCode());
  };

  const create = async () => {
    if (busy || !pendingCode) return;
    setBusy(true);
    setError('');
    try {
      const result = await commission({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        recoveryCode: pendingCode,
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
        // Back to the form. A username already taken or a password refused is
        // fixed there, not on a screen showing a code for an account that was
        // never created.
        setPendingCode(null);
      }
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  if (pendingCode) {
    return (
      <div className="cpos-signin">
        <div className="cpos-signin__brand">
          <span className="cpos-signin__mark">
            <LockIcon size={24} />
          </span>
          <h1 className="cpos-signin__h">{t('pos.local.recoveryTitle')}</h1>
          <p className="cpos-signin__sub">{t('pos.local.recoveryBody')}</p>
        </div>

        <RecoveryCodeBlock code={pendingCode} />

        <div className="cpos-note cpos-note--warning">{t('pos.local.recoveryWarning')}</div>

        {error ? (
          <div className="cpos-note cpos-note--danger" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
          onClick={create}
          disabled={busy}
        >
          {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
          {busy ? t('pos.local.commissioning') : t('pos.local.recoveryConfirm')}
        </button>

        <button
          type="button"
          className="cpos-btn cpos-btn--ghost cpos-btn--block"
          onClick={() => setPendingCode(null)}
          disabled={busy}
        >
          {t('pos.local.recoveryBack')}
        </button>
      </div>
    );
  }

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
        disabled={busy || !username.trim() || !password || !confirm || weak}
      >
        {t('pos.local.commissionCta')}
      </button>
    </form>
  );
}
