'use client';

import { useMemo, type ReactNode } from 'react';
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
import { PosAdapterProvider, usePosAdapter } from './pos-adapter-context';
import { PosServiceWorker } from './pos-service-worker';
import { PosSidebar, type PosNavItem } from './pos-sidebar';
import { PosTopbar } from './pos-topbar';
import { PosChromeProvider } from './theme/pos-chrome-context';
import { PosStyleScope } from './theme/pos-styles';
import { usePosQueue } from './offline/use-pos-queue';
import { stripLocalePrefix } from '../utils/strip-locale-prefix';
import { PosRegister } from './pos-register';
import { PosSettingsPage } from './pos-settings-page';

/**
 * Full-screen chrome for the register.
 *
 * Still deliberately not AdminShell -- the admin panel's nav is a fixed column
 * of two dozen links, and a till has six screens at most. What changed is the
 * shape: those six links used to live in the top bar alongside a search box,
 * two dropdowns, a status pill and an install button, and flexWrap stacked all
 * of that into two or three rows on a narrow till, costing about 120px of
 * height out of 768. The side menu costs 72px of width when parked as a rail
 * and folds away entirely below 1024px -- less of the screen than the bar it
 * replaced -- and it leaves the top bar free to say what the current screen is.
 */
export function PosShell({ children }: { children: ReactNode }) {
  return (
    <PosStyleScope>
      <PosChromeProvider>
        <PosAdapterProvider>
          <PosShellChrome>{children}</PosShellChrome>
        </PosAdapterProvider>
      </PosChromeProvider>
    </PosStyleScope>
  );
}

/** Which screen the pathname is on, for the menu highlight and the bar title. */
function screenOf(pathname: string): string {
  const after = stripLocalePrefix(pathname).replace(/^\/pos\/?/, '');
  const [head] = after.split('/');
  return head ? `/pos/${head}` : '/pos';
}

/**
 * Split from PosShell only so the chrome can read the adapter the shell
 * provides. The register and the held-sales page read the same one, which is
 * what makes the connection pill reflect the outbox they actually write to.
 */
function PosShellChrome({ children }: { children: ReactNode }) {
  const { pathname: rawPathname } = useCaspianNavigation();
  // A consumer that puts the locale in the URL hands us /az/pos/settings.
  const pathname = stripLocalePrefix(rawPathname);
  const { userProfile, signOut } = useAuth();
  const local = usePosLocalSession();
  const { canAccess, roles } = usePosRoles();
  const functions = useCaspianFirebaseOptional()?.functions ?? null;
  const t = useT();
  const license = usePosLicense(functions);
  const { queue } = usePosAdapter();
  // Read once here and handed down, rather than subscribed again inside the
  // menu: the pill and the held-sales page already watch this queue, and its
  // drain timer is reference-counted precisely so they can share it.
  const { counts } = usePosQueue(local.standalone ? null : queue);
  const waiting = counts.held + counts.sending + counts.blocked;

  // A standalone till has no outbox -- nothing is ever waiting to be sent -- so
  // the queue item would only ever open an empty page. In its place it gets the
  // local back office, for the people allowed to open it.
  const items = useMemo<PosNavItem[]>(() => {
    const list: PosNavItem[] = [
      { href: '/pos', label: t('pos.nav.register'), icon: 'register', group: 'counter' },
    ];
    if (!local.standalone) {
      list.push({
        href: '/pos/queue',
        label: t('pos.nav.queue'),
        icon: 'queue',
        group: 'counter',
        count: waiting,
      });
    }
    if (local.standalone && canAccess(local.user?.role, 'store')) {
      list.push({ href: '/pos/store', label: t('pos.nav.store'), icon: 'store', group: 'shop' });
    }
    if (local.standalone && canAccess(local.user?.role, 'admin')) {
      list.push({
        href: '/pos/admin',
        label: t('pos.nav.localAdmin'),
        icon: 'backoffice',
        group: 'shop',
      });
    }
    if (local.standalone && canAccess(local.user?.role, 'support')) {
      list.push({
        href: '/pos/app-admin',
        label: t('pos.nav.appAdmin'),
        icon: 'roles',
        group: 'system',
      });
    }
    list.push({ href: '/pos/settings', label: t('pos.nav.settings'), icon: 'settings', group: 'system' });
    return list;
  }, [t, local.standalone, local.user?.role, canAccess, waiting]);

  const activeHref = screenOf(pathname);
  const current = items.find((item) => item.href === activeHref);

  const whoIsHere = local.standalone
    ? (local.user?.displayName ?? '')
    : userProfile?.displayName || userProfile?.email || '';

  const initials = useMemo(
    () =>
      whoIsHere
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2),
    [whoIsHere],
  );

  // Read off the role definitions rather than an i18n key, because a till can
  // invent its own roles at /pos/app-admin and a custom id has no key to look up.
  const roleLabel = local.standalone
    ? roles.find((role) => role.id === local.user?.role)?.name
    : undefined;
  const exit = () => (local.standalone ? local.signOut() : void signOut());

  return (
    <div className="cpos-shell">
      <PosSidebar
        items={items}
        activeHref={activeHref}
        whoIsHere={whoIsHere}
        roleLabel={roleLabel}
        initials={initials}
        avatarUrl={userProfile?.photoURL}
        onExit={exit}
      />

      <div className="cpos-column">
        <PosTopbar
          title={current?.label ?? t('pos.nav.register')}
          subtitle={local.standalone ? t('pos.storage.localShort') : undefined}
          whoIsHere={whoIsHere}
          initials={initials}
          userProfile={userProfile}
          local={local.standalone}
          queue={queue}
          onExit={exit}
        />

        <PosServiceWorker />
        <PosLicenseBanner license={license} />

        <main className="cpos-main">{children}</main>
      </div>
    </div>
  );
}

/**
 * Dispatcher for every /pos/** route.
 *
 * Same contract as AdminRoot: new register screens land as a branch here,
 * never as a route file the consumer has to add. Unknown sub-paths fall back
 * to the register rather than a 404 -- a cashier who mistypes a URL should end
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
