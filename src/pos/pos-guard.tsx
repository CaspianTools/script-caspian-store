'use client';

import { useState, type ReactNode } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianLink } from '../provider/caspian-store-provider';
import { useScriptSettings } from '../context/script-settings-context';
import { useT } from '../i18n/locale-context';
import { PosStyleScope } from './theme/pos-styles';
import { LockIcon, ShoppingCartIcon } from '../ui/icons';
import { POS_ROLES, type UserRole } from '../types';
import { usePosLocalSession } from './standalone/local-session-context';
import { PosLocalSignIn } from './standalone/pos-local-sign-in';
import { usePosRolesOptional } from './standalone/role-context';
import { can as canBuiltIn } from './standalone/types';

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
export function PosGuard(props: PosGuardProps) {
  // Wrapped rather than repeated: the guard has six early returns and each one
  // renders chrome of its own, so the sheet has to be above all of them. The
  // scope is a no-op when PosShell has already mounted it.
  return (
    <PosStyleScope>
      <PosGuardBody {...props} />
    </PosStyleScope>
  );
}

function PosGuardBody({ children, signInHref = '/login', fallback }: PosGuardProps) {
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
      ? roles.can(local.user.role, 'register')
      : canBuiltIn(local.user.role, 'register');
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
    <div className="cpos-boot">
      <span className="cpos-boot__mark">
        <ShoppingCartIcon size={26} />
      </span>
      <span className="cpos-spinner" aria-hidden="true" />
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
    <div className="cpos-notice">
      <span className="cpos-empty__icon cpos-empty__icon--neutral">
        <LockIcon size={28} />
      </span>
      <h1 className="cpos-notice__h">{title}</h1>
      <p className="cpos-notice__body">{body}</p>
      {children ? <div className="cpos-notice__foot">{children}</div> : null}
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
      <div className="cpos-muted">{t('pos.guard.deniedUid')}</div>
      <div className="cpos-uid">
        <code className="cpos-uid__value">{uid}</code>
        <button
          type="button"
          className={copied ? 'cpos-btn cpos-btn--success cpos-btn--sm' : 'cpos-btn cpos-btn--outline cpos-btn--sm'}
          onClick={copy}
        >
          {copied ? t('pos.guard.copied') : t('pos.guard.copyUid')}
        </button>
      </div>
    </PosNotice>
  );
}
