'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { usePosT as useT } from '../../i18n/use-pos-t';
import { LockIcon } from '../../icons';
import { MIN_LOCAL_PASSWORD_LENGTH, passwordIsWeak } from './local-auth';
import { buildLocalBackup, localBackupFilename, saveTextFile } from './local-backup';
import { factoryResetLocalStore, readLocalShopSettings } from './local-db';
import { hasRecoveryCode, redeemRecoveryCode } from './local-recovery';
import { PasswordField } from './password-field';
import { isRecoveryCodeShaped } from './recovery-code';
import { throttleWaitSeconds } from './sign-in-throttle';

/**
 * Getting back into a till nobody can sign into.
 *
 * Reached from a quiet link at the foot of the sign-in card and nowhere else --
 * never from inside a session, and never as a bare button. It renders as a body
 * of `PosLocalSignIn` rather than a branch in `PosGuard`, which already carries
 * six early returns each painting their own chrome; a seventh is how that
 * function rots.
 *
 * Three doors, in the order a shop should try them. The first is the recovery
 * code. The second is the answer for most real lockouts, which are a cashier
 * rather than the owner: somebody else on the till can already reset them. The
 * third destroys the shop's records and is collapsed behind an explicit
 * expansion, a forced backup and a typed shop name.
 *
 * Door three is defensible and the manual says so out loud: anybody standing at
 * this machine can already achieve exactly the same destruction through the
 * browser's own site-data settings, with no backup taken first and no warning
 * about what they are about to lose. Offering it here is the only version of it
 * that tries to save the shop's catalogue on the way past.
 */
export function PosLocalRecovery({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [codeExists, setCodeExists] = useState<boolean | null>(null);
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    let alive = true;
    readLocalShopSettings()
      .then((settings) => {
        if (!alive) return;
        setCodeExists(hasRecoveryCode(settings));
        setShopName(settings.shopName);
      })
      .catch(() => {
        if (alive) setCodeExists(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="cpos-signin">
      <div className="cpos-signin__brand">
        <span className="cpos-signin__mark">
          <LockIcon size={24} />
        </span>
        <h1 className="cpos-signin__h">{t('pos.recovery.title')}</h1>
        <p className="cpos-signin__sub">{t('pos.recovery.body')}</p>
      </div>

      <RecoveryCodeDoor codeExists={codeExists} />
      <AskSomebodyDoor />
      <StartOverDoor shopName={shopName} />

      <button type="button" className="cpos-btn cpos-btn--ghost cpos-btn--block" onClick={onDone}>
        {t('pos.recovery.back')}
      </button>
    </div>
  );
}

/** Door one. */
function RecoveryCodeDoor({ codeExists }: { codeExists: boolean | null }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ username: string; nextCode: string } | null>(null);
  const codeId = useId();
  const codeHintId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const mismatch = confirm.length > 0 && confirm !== password;
  const shaped = isRecoveryCodeShaped(code);
  const weak =
    password.length >= MIN_LOCAL_PASSWORD_LENGTH && passwordIsWeak(password, '');
  const ready =
    shaped && password.length >= MIN_LOCAL_PASSWORD_LENGTH && confirm === password && !weak;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError('');
    try {
      const result = await redeemRecoveryCode(code, password);
      if (result.ok) {
        setDone({ username: result.username, nextCode: result.nextCode });
        setCode('');
        setPassword('');
        setConfirm('');
        return;
      }
      setError(
        result.reason === 'throttled'
          ? t('pos.recovery.throttled', { seconds: throttleWaitSeconds(result.waitMillis) })
          : result.reason === 'no-code'
            ? t('pos.recovery.noCode')
            : result.reason === 'account-gone'
              ? t('pos.recovery.accountGone')
              : result.reason === 'password-too-short'
                ? t('pos.local.passwordTooShort', { min: MIN_LOCAL_PASSWORD_LENGTH })
                : result.reason === 'password-too-weak'
                  ? t('pos.local.passwordWeak')
                  : t('pos.recovery.badCode'),
      );
    } catch {
      setError(t('pos.local.storageBlocked'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="cpos-note cpos-note--success">
        <h2 className="cpos-field__label">{t('pos.recovery.doneTitle')}</h2>
        <p>{t('pos.recovery.doneBody', { name: done.username })}</p>
        <p>{t('pos.recovery.newCodeBody')}</p>
        <RecoveryCodeBlock code={done.nextCode} />
      </section>
    );
  }

  return (
    <form className="cpos-field" onSubmit={submit}>
      <h2 className="cpos-field__label">{t('pos.recovery.codeTitle')}</h2>
      <p className="cpos-signin__hint">{t('pos.recovery.codeBody')}</p>

      {codeExists === false ? (
        <div className="cpos-note cpos-note--warning" role="status">
          {t('pos.recovery.noCode')}
        </div>
      ) : null}

      <label className="cpos-field__label" htmlFor={codeId}>
        {t('pos.recovery.codeLabel')}
      </label>
      <input
        className="cpos-input"
        id={codeId}
        value={code}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="CSPR1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
        aria-describedby={codeHintId}
        aria-invalid={code.length > 0 && !shaped ? true : undefined}
        style={{ fontFamily: 'ui-monospace, monospace' }}
        onChange={(e) => setCode(e.target.value)}
      />
      <p className="cpos-signin__hint" id={codeHintId}>
        {t('pos.recovery.codeHelp')}
      </p>

      <PasswordField
        id={passwordId}
        label={t('pos.recovery.newPassword')}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        invalid={weak}
      />
      <PasswordField
        id={confirmId}
        label={t('pos.local.confirmPassword')}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        invalid={mismatch}
      />

      <div aria-live="polite">
        {weak ? t('pos.local.passwordWeak') : null}
        {mismatch ? t('pos.local.passwordMismatch') : null}
      </div>

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        className="cpos-btn cpos-btn--primary cpos-btn--block"
        disabled={busy || !ready}
      >
        {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
        {t('pos.recovery.submit')}
      </button>
    </form>
  );
}

/** Door two, and the answer for most real lockouts. */
function AskSomebodyDoor() {
  const t = useT();
  return (
    <section className="cpos-field">
      <h2 className="cpos-field__label">{t('pos.recovery.askTitle')}</h2>
      <p className="cpos-signin__hint">{t('pos.recovery.askBody')}</p>
    </section>
  );
}

/** Door three. Collapsed, backed up, and typed out in full before it will run. */
function StartOverDoor({ shopName }: { shopName: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmId = useId();

  // A till whose shop record was never filled in has no name to type. Falling
  // back to a fixed word keeps the deliberate friction rather than quietly
  // turning the last step into a single click on exactly the tills least likely
  // to have been set up carefully.
  const expected = shopName.trim() || t('pos.recovery.resetFallbackWord');

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await buildLocalBackup();
      saveTextFile(localBackupFilename(), JSON.stringify(data, null, 2));
      setBackedUp(true);
    } catch {
      setError(t('pos.recovery.resetBackupFailed'));
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    if (!backedUp || typed.trim() !== expected || busy) return;
    setBusy(true);
    setError('');
    try {
      await factoryResetLocalStore();
      window.location.reload();
    } catch {
      setError(t('pos.recovery.resetFailed'));
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <section className="cpos-field">
        <h2 className="cpos-field__label">{t('pos.recovery.resetTitle')}</h2>
        <p className="cpos-signin__hint">{t('pos.recovery.resetTeaser')}</p>
        <button
          type="button"
          className="cpos-btn cpos-btn--ghost cpos-btn--block"
          onClick={() => setOpen(true)}
        >
          {t('pos.recovery.resetExpand')}
        </button>
      </section>
    );
  }

  return (
    <section className="cpos-note cpos-note--danger">
      <h2 className="cpos-field__label">{t('pos.recovery.resetTitle')}</h2>
      <p>{t('pos.recovery.resetBody')}</p>

      <button
        type="button"
        className="cpos-btn cpos-btn--outline cpos-btn--block"
        onClick={download}
        disabled={busy}
      >
        {backedUp ? t('pos.recovery.resetBackupDone') : t('pos.recovery.resetBackup')}
      </button>

      {backedUp ? (
        <>
          <label className="cpos-field__label" htmlFor={confirmId}>
            {t('pos.recovery.resetConfirmLabel', { name: expected })}
          </label>
          <input
            className="cpos-input"
            id={confirmId}
            value={typed}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button
            type="button"
            className="cpos-btn cpos-btn--danger cpos-btn--block"
            onClick={wipe}
            disabled={busy || typed.trim() !== expected}
          >
            {t('pos.recovery.resetCta')}
          </button>
        </>
      ) : null}

      {error ? <div role="alert">{error}</div> : null}
    </section>
  );
}

/**
 * A code, shown once, big enough to copy off the screen onto paper.
 *
 * The copy button is a convenience for a shop that keeps a password manager,
 * not the primary path: this string exists precisely for the case where the
 * machine it is stored on cannot be opened, so the manual tells people to write
 * it down rather than save it here.
 */
export function RecoveryCodeBlock({ code }: { code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard refused. The code is on screen either way, which is the
      // path the manual actually asks a shop to use.
    }
  };

  return (
    <div className="cpos-field">
      <output
        className="cpos-input"
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '1.05rem',
          letterSpacing: '0.04em',
          display: 'block',
          wordBreak: 'break-all',
        }}
      >
        {code}
      </output>
      <button type="button" className="cpos-btn cpos-btn--outline" onClick={copy}>
        {copied ? t('pos.recovery.copied') : t('pos.recovery.copy')}
      </button>
    </div>
  );
}
