'use client';

import { caspianCallable } from '../../../services/caspian-callable';
import { useState, type CSSProperties } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { useT } from '../../../i18n';
import { useCaspianFirebase } from '../../../provider/caspian-store-provider';
import { SetupButton, SetupField } from '../setup-ui';
import type { SuperAdminDraft, SuperAdminMethod } from '../setup-types';

export interface SuperAdminStepProps {
  draft: SuperAdminDraft;
  onChange: (patch: Partial<SuperAdminDraft>) => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

export function SuperAdminStep({ draft, onChange }: SuperAdminStepProps) {
  const t = useT();
  const { auth, db, functions } = useCaspianFirebase();

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [emailDraft, setEmailDraft] = useState(draft.email);

  const setMethod = (method: SuperAdminMethod) => {
    if (method === draft.method) return;
    setStatus({ kind: 'idle' });
    onChange({ method });
  };

  const finishSignin = async () => {
    // Grab a fresh token now that the claim has been set, then mark the
    // step complete with the signed-in uid.
    if (!auth.currentUser) return;
    await auth.currentUser.getIdToken(true);
    onChange({ signedInUid: auth.currentUser.uid });
    setStatus({ kind: 'ok', message: t('setup.superAdmin.signin.success') });
  };

  const claimAdminCallable = async () => {
    const result = await caspianCallable<unknown, { ok: boolean }>(
      functions,
      'claimAdmin',
    )({});
    return result.data;
  };

  const submitSignin = async () => {
    setStatus({ kind: 'pending' });
    try {
      if (createMode) {
        await createUserWithEmailAndPassword(
          auth,
          signinEmail.trim(),
          signinPassword,
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          signinEmail.trim(),
          signinPassword,
        );
      }
      await claimAdminCallable();
      await finishSignin();
    } catch (err) {
      setStatus({ kind: 'error', message: extractError(err, t) });
    }
  };

  const submitGoogle = async () => {
    setStatus({ kind: 'pending' });
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      await claimAdminCallable();
      await finishSignin();
    } catch (err) {
      setStatus({ kind: 'error', message: extractError(err, t) });
    }
  };

  const submitEmailDesignation = async () => {
    setStatus({ kind: 'pending' });
    const normalized = emailDraft.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setStatus({ kind: 'error', message: t('setup.superAdmin.email.invalid') });
      return;
    }
    try {
      await setDoc(doc(db, 'pendingSuperAdmin', normalized), {
        email: normalized,
        designatedAt: Timestamp.now(),
      });
      onChange({ email: normalized });
      setStatus({ kind: 'ok', message: t('setup.superAdmin.email.success') });
    } catch (err) {
      setStatus({ kind: 'error', message: extractError(err, t) });
    }
  };

  const isPending = status.kind === 'pending';
  const isMethodSignin = draft.method === 'signin';
  const isMethodEmail = draft.method === 'email';

  return (
    <div style={wrap}>
      <div role="tablist" aria-label="Super admin method" style={tabList}>
        <button
          type="button"
          role="tab"
          aria-selected={isMethodSignin}
          onClick={() => setMethod('signin')}
          style={{ ...tab, ...(isMethodSignin ? tabActive : tabInactive) }}
        >
          {t('setup.superAdmin.tabs.signin')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isMethodEmail}
          onClick={() => setMethod('email')}
          style={{ ...tab, ...(isMethodEmail ? tabActive : tabInactive) }}
        >
          {t('setup.superAdmin.tabs.email')}
        </button>
      </div>

      {isMethodSignin ? (
        <div>
          <p style={hint}>{t('setup.superAdmin.signin.hint')}</p>
          <SetupField
            label={t('setup.superAdmin.signin.email')}
            type="email"
            value={signinEmail}
            onChange={(e) => setSigninEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@yourbrand.com"
          />
          <SetupField
            label={t('setup.superAdmin.signin.password')}
            type="password"
            value={signinPassword}
            onChange={(e) => setSigninPassword(e.target.value)}
            autoComplete={createMode ? 'new-password' : 'current-password'}
            placeholder={createMode ? t('setup.superAdmin.signin.passwordNewHint') : ''}
          />
          <label style={createToggle}>
            <input
              type="checkbox"
              checked={createMode}
              onChange={(e) => setCreateMode(e.target.checked)}
              style={{ accentColor: '#022959' }}
            />
            <span>{t('setup.superAdmin.signin.createMode')}</span>
          </label>
          <div style={buttonRow}>
            <SetupButton onClick={submitSignin} disabled={isPending}>
              {isPending
                ? t('setup.superAdmin.signin.submitting')
                : createMode
                  ? t('setup.superAdmin.signin.createSubmit')
                  : t('setup.superAdmin.signin.submit')}
            </SetupButton>
            <SetupButton variant="ghost" onClick={submitGoogle} disabled={isPending}>
              {t('setup.superAdmin.signin.google')}
            </SetupButton>
          </div>
        </div>
      ) : (
        <div>
          <p style={hint}>{t('setup.superAdmin.email.hint')}</p>
          <SetupField
            label={t('setup.superAdmin.email.label')}
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            autoComplete="off"
            placeholder="admin@yourbrand.com"
          />
          <div style={buttonRow}>
            <SetupButton onClick={submitEmailDesignation} disabled={isPending}>
              {isPending
                ? t('setup.superAdmin.email.submitting')
                : t('setup.superAdmin.email.submit')}
            </SetupButton>
          </div>
          {draft.email && status.kind !== 'ok' && (
            <p style={savedNote}>
              {t('setup.superAdmin.email.previouslySaved', { email: draft.email })}
            </p>
          )}
        </div>
      )}

      {status.kind === 'error' && <p style={errorText}>{status.message}</p>}
      {status.kind === 'ok' && <p style={okText}>{status.message}</p>}
    </div>
  );
}

/**
 * The wizard uses this to decide whether the step is satisfied. The user
 * either signed in (claimed admin) OR designated an email — either is
 * enough to proceed.
 */
export function isSuperAdminComplete(draft: SuperAdminDraft): boolean {
  if (draft.method === 'signin') return Boolean(draft.signedInUid);
  return Boolean(draft.email);
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function extractError(err: unknown, t: (key: string) => string): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: unknown }).code);
    if (code === 'permission-denied' || code === 'permissions-denied') {
      return t('setup.superAdmin.errors.permissionDenied');
    }
    if (code === 'failed-precondition') {
      return t('setup.superAdmin.errors.adminAlreadyExists');
    }
    if (code === 'auth/email-already-in-use') {
      return t('setup.superAdmin.errors.emailInUse');
    }
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return t('setup.superAdmin.errors.wrongPassword');
    }
    if (code === 'auth/weak-password') {
      return t('setup.superAdmin.errors.weakPassword');
    }
    if (code === 'auth/popup-closed-by-user') {
      return t('setup.superAdmin.errors.popupClosed');
    }
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message);
  }
  return t('setup.superAdmin.errors.generic');
}

const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };

const tabList: CSSProperties = {
  display: 'flex',
  gap: 6,
  background: '#EFF2F8',
  padding: 4,
  borderRadius: 10,
  width: 'fit-content',
};

const tab: CSSProperties = {
  border: 'none',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: 7,
  cursor: 'pointer',
  transition: 'background 140ms ease, color 140ms ease',
};

const tabActive: CSSProperties = { background: '#FFFFFF', color: '#022959' };
const tabInactive: CSSProperties = { background: 'transparent', color: '#6A7A8A' };

const hint: CSSProperties = {
  fontSize: 13,
  color: '#6A7A8A',
  margin: '4px 0 12px 0',
  lineHeight: 1.55,
};

const buttonRow: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 4,
  alignItems: 'center',
};

const createToggle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: '#3F4A5E',
  marginBottom: 12,
  cursor: 'pointer',
};

const errorText: CSSProperties = {
  color: '#DF4747',
  fontSize: 13,
  marginTop: 8,
  margin: '8px 0 0 0',
};

const okText: CSSProperties = {
  color: '#1F7A3D',
  fontSize: 13,
  fontWeight: 600,
  marginTop: 8,
  margin: '8px 0 0 0',
};

const savedNote: CSSProperties = {
  fontSize: 12,
  color: '#6A7A8A',
  marginTop: 6,
};
