'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useCaspianNavigation } from '../provider/caspian-store-provider';
import { useAuth } from '../context/auth-context';
import { useT } from '../i18n/locale-context';
import { useCaspianFirebaseOptional } from '../provider/caspian-store-provider';
import { usePosLocalSession } from './standalone/local-session-context';
import { usePosRoles } from './standalone/role-context';
import { PosLocalAdminPage } from './standalone/admin/pos-local-admin-page';
import { PosAppAdminPage } from './standalone/admin/pos-app-admin-page';
import { LocalStorePanel } from './standalone/admin/local-store-panel';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseBanner } from './license/pos-license-banner';
import { PosQueuePage } from './pos-queue-page';
import { PosSaleQueue } from './offline/pos-sale-queue';
import { getPosDeviceId } from './pos-device';
import { PosServiceWorker } from './pos-service-worker';
import { PosHeader } from './pos-header';
import { stripLocalePrefix } from '../utils/strip-locale-prefix';
import { PosRegister } from './pos-register';
import { PosSettingsPage } from './pos-settings-page';

/**
 * Full-screen chrome for the register.
 *
 * Deliberately not `AdminShell`: a till runs on a small screen that is often
 * touch-only, and every pixel the admin sidebar would take is a pixel not
 * showing the sale. The nav here is four items and nothing else.
 */
export function PosShell({ children }: { children: ReactNode }) {
  const { pathname: rawPathname } = useCaspianNavigation();
  // A consumer that puts the locale in the URL hands us `/az/pos/settings`.
  const pathname = stripLocalePrefix(rawPathname);
  const { userProfile, signOut } = useAuth();
  const local = usePosLocalSession();
  const { canAccess } = usePosRoles();
  const functions = useCaspianFirebaseOptional()?.functions ?? null;
  const t = useT();
  const license = usePosLicense(functions);
  // One queue instance for the chrome, so the pill reflects the same store the
  // register writes to. Cheap: it holds no connection, only a device id.
  const queue = useMemo(() => new PosSaleQueue(functions, getPosDeviceId()), [functions]);

  // A standalone till has no outbox — nothing is ever waiting to be sent — so
  // the queue tab would only ever show an empty page. In its place it gets the
  // local back office, for the people allowed to open it.
  const items = [
    { href: '/pos', label: t('pos.nav.register') },
    ...(local.standalone ? [] : [{ href: '/pos/queue', label: t('pos.nav.queue') }]),
    ...(local.standalone && canAccess(local.user?.role, 'store')
      ? [{ href: '/pos/store', label: t('pos.nav.store') }]
      : []),
    ...(local.standalone && canAccess(local.user?.role, 'admin')
      ? [{ href: '/pos/admin', label: t('pos.nav.localAdmin') }]
      : []),
    ...(local.standalone && canAccess(local.user?.role, 'support')
      ? [{ href: '/pos/app-admin', label: t('pos.nav.appAdmin') }]
      : []),
    { href: '/pos/settings', label: t('pos.nav.settings') },
  ];

  const whoIsHere = local.standalone
    ? (local.user?.displayName ?? '')
    : userProfile?.displayName || userProfile?.email;
  const exit = () => (local.standalone ? local.signOut() : void signOut());

  return (
    <div style={shell}>
      <PosHeader
        items={items}
        pathname={pathname}
        whoIsHere={whoIsHere ?? ''}
        userProfile={userProfile}
        local={local.standalone}
        queue={local.standalone ? null : queue}
        onExit={exit}
      />

      <PosServiceWorker />
      <PosLicenseBanner license={license} />

      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

const shell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  // The register owns the viewport: a till has no storefront header, no
  // footer, and nothing to scroll past to reach the sale.
  height: '100dvh',
  background: 'var(--caspian-background, #f7f8fa)',
  color: 'var(--caspian-foreground, #111)',
};

/**
 * Dispatcher for every `/pos/**` route.
 *
 * Same contract as `AdminRoot`: new register screens land as a branch here,
 * never as a route file the consumer has to add. Unknown sub-paths fall back
 * to the register rather than a 404 — a cashier who mistypes a URL should end
 * up able to sell, not stuck.
 */
export function PosRoot(): ReactNode {
  const { pathname } = useCaspianNavigation();
  const { standalone, user } = usePosLocalSession();
  const { canAccess } = usePosRoles();
  const after = stripLocalePrefix(pathname).replace(/^\/pos\/?/, '');
  const [head] = after.split('/');

  switch (head) {
    case 'settings':
      return <PosSettingsPage />;
    case 'queue':
      return <PosQueuePage />;
    // Only a standalone till has a local back office. On a cloud till this is
    // just a mistyped URL, and the rule above is that those land on the
    // register rather than on a screen with nothing in it.
    case 'admin':
      return standalone && canAccess(user?.role, 'admin') ? <PosLocalAdminPage /> : <PosRegister />;
    case 'store':
      return standalone && canAccess(user?.role, 'store') ? <LocalStorePanel /> : <PosRegister />;
    case 'app-admin':
      return standalone && canAccess(user?.role, 'support') ? <PosAppAdminPage /> : <PosRegister />;
    default:
      return <PosRegister />;
  }
}
