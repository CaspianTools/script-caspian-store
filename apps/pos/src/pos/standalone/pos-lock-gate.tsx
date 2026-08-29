'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { usePosT as useT } from '../../i18n/use-pos-t';
import { LockIcon } from '../../icons';
import { IDLE_LOCK_CHANGED_EVENT, readIdleLockMinutes } from '../pos-preferences';
import { throttleWaitSeconds } from './sign-in-throttle';
import { usePosLocalSession } from './local-session-context';
import { PasswordField } from './password-field';

/**
 * Covers the register when the till has been left alone.
 *
 * Mounted inside `PosShell`, between the shop-settings provider and the chrome —
 * deliberately not from `PosGuard`. `PosAutoBackupProvider` sits inside the
 * guard's children, so a guard-level lock screen would unmount it and a till
 * locked overnight would quietly stop taking its automatic backups, which is the
 * one job it has while nobody is looking. Mounting here covers the sidebar and
 * the top bar just as completely and leaves everything above it running. The
 * open ticket is safe either way: it lives in IndexedDB, not React state.
 *
 * A consumer who mounts `PosGuard` without `PosShell` gets no lock screen. That
 * is already true of the opening-cash gate, and both are documented as such.
 *
 * Off unless somebody switches it on at `/pos/settings`.
 */
export function PosLockGate({ children }: { children: ReactNode }) {
  const { standalone, user, locked, lock } = usePosLocalSession();
  const [minutes, setMinutes] = useState(0);

  // Read on mount rather than at module scope: it is a localStorage value, and
  // reading it during render would differ between the server and the client.
  useEffect(() => {
    const reread = () => setMinutes(readIdleLockMinutes());
    reread();
    // Two listeners because `storage` fires in every tab *except* the one that
    // wrote the value, so on its own it misses the case that matters: an owner
    // picking a time at /pos/settings and pressing Save. v1.0.0 shipped with
    // only the first, and the setting appeared to do nothing until a reload.
    window.addEventListener('storage', reread);
    window.addEventListener(IDLE_LOCK_CHANGED_EVENT, reread);
    return () => {
      window.removeEventListener('storage', reread);
      window.removeEventListener(IDLE_LOCK_CHANGED_EVENT, reread);
    };
  }, []);

  const active = standalone && !!user && minutes > 0;
  const deadline = useRef(0);

  useEffect(() => {
    if (!active || locked) return;
    const idleMs = minutes * 60_000;
    deadline.current = Date.now() + idleMs;
    const bump = () => {
      deadline.current = Date.now() + idleMs;
    };
    // `pointerdown` rather than `mousemove`: a scanner gun, a touch and a mouse
    // click all produce one, and a cat on the keyboard of an unattended till
    // does not. `keydown` catches a barcode being scanned into the search box,
    // which on a busy counter is the only thing happening for minutes at a time.
    const events = ['pointerdown', 'keydown', 'wheel'] as const;
    for (const name of events) window.addEventListener(name, bump, { passive: true });
    // Checked on a timer rather than scheduled with one timeout, so a laptop
    // that was asleep past the deadline locks on the first tick after it wakes
    // instead of whenever the stale timeout happens to fire.
    const timer = window.setInterval(() => {
      if (Date.now() >= deadline.current) lock();
    }, 5_000);
    return () => {
      for (const name of events) window.removeEventListener(name, bump);
      window.clearInterval(timer);
    };
  }, [active, locked, minutes, lock]);

  if (active && locked) return <PosLockScreen />;
  return <>{children}</>;
}

function PosLockScreen() {
  const t = useT();
  const { user, unlock, signOut } = usePosLocalSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const passwordId = useId();

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError('');
      try {
        const result = await unlock(password);
        if (!result.ok) {
          setError(
            result.reason === 'throttled'
              ? t('pos.local.throttled', { seconds: throttleWaitSeconds(result.waitMillis) })
              : t('pos.lock.wrongPassword'),
          );
        } else {
          setPassword('');
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, password, t, unlock],
  );

  return (
    <div className="cpos-signin-canvas">
      <form className="cpos-signin" aria-labelledby={headingId} onSubmit={submit}>
        <div className="cpos-signin__brand">
          <span className="cpos-signin__mark">
            <LockIcon size={24} />
          </span>
          <h1 className="cpos-signin__h" id={headingId}>
            {t('pos.lock.title')}
          </h1>
          <p className="cpos-signin__sub">{t('pos.lock.body')}</p>
          {/* Whose till this is. The cashier types their own password, not a
              colleague's, and after a break they may well need reminding. */}
          <p className="cpos-signin__sub">
            <strong>{user?.displayName || user?.username || ''}</strong>
          </p>
        </div>

        <PasswordField
          id={passwordId}
          label={t('pos.local.password')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          invalid={!!error}
          autoFocus
        />

        {error ? (
          <div className="cpos-note cpos-note--danger" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
          disabled={busy || !password}
        >
          {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
          {t('pos.lock.unlock')}
        </button>

        {/*
          The handover case. This one really does sign out and mint a new
          sign-in id, which is what sends the next cashier through the
          drawer-count gate -- unlocking deliberately does not.
        */}
        <button type="button" className="cpos-btn cpos-btn--ghost cpos-btn--block" onClick={signOut}>
          {t('pos.lock.someoneElse')}
        </button>
      </form>
    </div>
  );
}
