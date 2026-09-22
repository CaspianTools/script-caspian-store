'use client';

import { useState, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Skeleton } from '../ui/misc';

export interface AdminGuardProps {
  children: ReactNode;
  /** Where to send non-admins. */
  signInHref?: string;
  /** Override the default "access denied" / "sign in" UI. */
  fallback?: ReactNode;
}

/**
 * Gate for any admin surface — blocks render unless userProfile.role === 'admin'.
 * Consumers wrap `<AdminShell>` / admin pages in this.
 */
export function AdminGuard({ children, signInHref = '/login', fallback }: AdminGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const Link = useCaspianLink();
  const t = useT();

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 24, width: 200 }} />
        <Skeleton style={{ height: 14, width: 320 }} />
      </div>
    );
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('admin.guard.signInTitle')}</h1>
        <p style={{ color: '#666', marginTop: 8 }}>{t('admin.guard.signInBody')}</p>
        <div style={{ marginTop: 16 }}>
          <Link href={signInHref}>{t('admin.guard.signIn')}</Link>
        </div>
      </div>
    );
  }

  if (userProfile?.role !== 'admin') {
    if (fallback) return <>{fallback}</>;
    return <AccessDenied uid={user.uid} />;
  }

  return <>{children}</>;
}

type ClaimState =
  | { status: 'idle' }
  | { status: 'claiming' }
  | { status: 'error'; message: string };

function AccessDenied({ uid }: { uid: string }) {
  const { auth, functions } = useCaspianFirebase();
  const { refreshProfile } = useAuth();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [claim, setClaim] = useState<ClaimState>({ status: 'idle' });

  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const claimAdmin = async () => {
    setClaim({ status: 'claiming' });
    try {
      await httpsCallable(functions, 'claimAdmin')({});
      // v8.5.0: claimAdmin now also sets a Firebase Auth custom claim
      // (role='admin') used by storage.rules + firestore.rules. The claim
      // only appears on the ID token after a refresh — without forcing
      // one, the admin would have to sign out + back in before any
      // storage upload would work. Force-refresh so the new claim is
      // visible immediately to subsequent rule evaluations.
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      await refreshProfile();
      // AdminGuard will re-render with role=admin and drop AccessDenied.
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : t('admin.guard.claimFailed');
      setClaim({ status: 'error', message });
    }
  };

  return (
    <div style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('admin.guard.deniedTitle')}</h1>
      <p style={{ color: '#666', marginTop: 8 }}>{t('admin.guard.deniedBody')}</p>
      <ul
        style={{
          color: '#666',
          marginTop: 8,
          marginBottom: 16,
          textAlign: 'left',
          display: 'inline-block',
          paddingLeft: 20,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <li>
          <strong>Claim admin</strong> — if no admin exists yet (first-install path), use the
          button below.
        </li>
        <li>
          <strong>CLI</strong> —{' '}
          <code>
            npm run grant-admin -- --uid &lt;uid&gt; --credentials ./service-account.json
          </code>
          .
        </li>
        <li>
          <strong>Firestore console</strong> — open <code>users/{'{uid}'}</code>, set{' '}
          <code>role</code> string field to <code>"admin"</code>.
        </li>
      </ul>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: 6,
          background: '#f7f7f7',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        <span>{uid}</span>
        <button
          type="button"
          onClick={copy}
          style={{
            padding: '4px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: copied ? '#e6f4ea' : '#fff',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {copied ? t('admin.guard.copied') : t('admin.guard.copyUid')}
        </button>
      </div>
      <div>
        <button
          type="button"
          onClick={claimAdmin}
          disabled={claim.status === 'claiming'}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 6,
            background: claim.status === 'claiming' ? '#888' : '#111',
            color: '#fff',
            cursor: claim.status === 'claiming' ? 'default' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {claim.status === 'claiming' ? t('admin.guard.claiming') : t('admin.guard.claimAdmin')}
        </button>
      </div>
      {claim.status === 'error' && (
        <p style={{ color: '#c00', marginTop: 12, fontSize: 13 }}>{claim.message}</p>
      )}
    </div>
  );
}
