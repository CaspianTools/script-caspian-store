'use client';

import { useState, type ReactNode } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianLink } from '../provider/caspian-store-provider';
import { useScriptSettings } from '../context/script-settings-context';
import { useT } from '../i18n/locale-context';
import { Skeleton } from '../ui/misc';
import { POS_ROLES, type UserRole } from '../types';
import { usePosLocalSession } from './standalone/local-session-context';
import { PosLocalSignIn } from './standalone/pos-local-sign-in';
import { usePosRolesOptional } from './standalone/role-context';
import { canAccess as canAccessBuiltIn } from './standalone/types';

export interface PosGuardProps {
  children: ReactNode;
  /** Where to send signed-out visitors. */
  signInHref?: string;
  /** Override the default "sign in" / "access denied" UI. */
  fallback?: ReactNode;
}

function isPosRole(role: UserRole | undefined): boolean {
  return !!role && (POS_ROLES as readonly string[]).includes(role);
}

/**
 * Gate for the register at `/pos`.
 *
 * Deliberately NOT `AdminGuard`. A cashier holds `staff`, which reaches the
 * till and the catalog but nothing in `/admin` — that separation is the whole
 * reason the role exists. `admin` passes too, so an owner working the counter
 * does not need a second account.
 *
 * Also refuses when the feature is switched off, so a store that has never
 * enabled the POS does not expose a working register on a guessable URL just
 * because someone happens to hold the role.
 *
 * On a standalone till none of that applies: there is no Firebase Auth to ask,
 * no `users/{uid}` document to hold a role, and no remote flag to consult. That
 * path is checked first and returns before any of the cloud checks, because
 * every one of them would refuse a perfectly valid local cashier.
 *
 * The standalone gate asks the live role definitions rather than the static
 * `AREAS_BY_ROLE` map. The map knows only the seven built-in ids, so it refused
 * every custom role App Admin can create no matter which areas were ticked, and
 * ignored the enabled flag entirely — People would hand someone a role that
 * then opened nothing. The static map stays as the fallback for a consumer who
 * mounts this guard without `PosRoleProvider`.
 */
export function PosGuard({ children, signInHref = '/login', fallback }: PosGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const { settings } = useScriptSettings();
  const local = usePosLocalSession();
  const roles = usePosRolesOptional();
  const Link = useCaspianLink();
  const t = useT();

  const posEnabled = settings.features?.pos || settings.features?.posOnly;

  if (local.standalone) {
    // Waiting on the definitions too: refusing first and admitting a moment
    // later would flash "no access" at a cashier holding a custom role.
    if (local.loading || roles?.loading) return <PosLoading />;
    if (!local.user) return <PosLocalSignIn />;
    const permitted = roles
      ? roles.canAccess(local.user.role, 'register')
      : canAccessBuiltIn(local.user.role, 'register');
    if (!permitted) {
      return (
        <PosNotice title={t('pos.local.noAccessTitle')} body={t('pos.local.noAccessBody')} />
      );
    }
    return <>{children}</>;
  }

  if (loading) {
    return <PosLoading />;
  }

  if (!posEnabled) {
    return (
      <PosNotice
        title={t('pos.guard.disabledTitle')}
        body={t('pos.guard.disabledBody')}
      />
    );
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return (
      <PosNotice title={t('pos.guard.signInTitle')} body={t('pos.guard.signInBody')}>
        <Link href={signInHref}>{t('pos.guard.signInCta')}</Link>
      </PosNotice>
    );
  }

  if (!isPosRole(userProfile?.role)) {
    if (fallback) return <>{fallback}</>;
    return <PosAccessDenied uid={user.uid} />;
  }

  return <>{children}</>;
}

function PosLoading() {
  return (
    <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton style={{ height: 24, width: 200 }} />
      <Skeleton style={{ height: 14, width: 320 }} />
    </div>
  );
}

function PosNotice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
      <p style={{ color: '#666', marginTop: 8 }}>{body}</p>
      {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </div>
  );
}

/**
 * Shows the account id rather than a bare refusal. Granting the staff role is
 * done by someone else, at another screen, and the id is the one thing they
 * will ask for — a cashier standing at a till should not have to go hunting
 * through Firebase for it.
 */
function PosAccessDenied({ uid }: { uid: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <PosNotice title={t('pos.guard.deniedTitle')} body={t('pos.guard.deniedBody')}>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{t('pos.guard.deniedUid')}</div>
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
          {copied ? t('pos.guard.copied') : t('pos.guard.copyUid')}
        </button>
      </div>
    </PosNotice>
  );
}
