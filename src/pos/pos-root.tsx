'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useCaspianNavigation } from '../provider/caspian-store-provider';
import { useAuth } from '../context/auth-context';
import { useT } from '../i18n/locale-context';
import { useCaspianFirebaseOptional } from '../provider/caspian-store-provider';
import { usePosLocalSession } from './standalone/local-session-context';
import { usePosRoles } from './standalone/role-context';
import type { PosLocalCapability } from './standalone/types';
import { PosAppAdminPage } from './standalone/admin/pos-app-admin-page';
import { PosOpeningCashGate } from './standalone/pos-opening-cash-gate';
import { LocalStorePanel } from './standalone/admin/local-store-panel';
import { LocalSalesPage } from './standalone/admin/local-sales-panel';
import { LocalPeoplePage } from './standalone/admin/local-people-panel';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseBanner } from './license/pos-license-banner';
import { PosQueuePage } from './pos-queue-page';
import { PosAdapterProvider, usePosAdapter } from './pos-adapter-context';
import { PosOpenSaleProvider } from './open-sale-context';
import { PosOpenSaleBanner } from './open-sale-banner';
import { PosAutoBackupProvider } from './standalone/auto-backup-context';
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
          {/*
            Above the chrome, and therefore above `PosRoot`, because that is a
            switch returning a different component for every screen: an open
            sale held inside the register dies the moment a cashier touches
            Settings. Inside `PosAdapterProvider` because recovering a ticket
            after a crash means asking the adapter whether its sale already
            landed.
          */}
          <PosOpenSaleProvider>
            <PosAutoBackupProvider>
              <PosShellChrome>{children}</PosShellChrome>
            </PosAutoBackupProvider>
          </PosOpenSaleProvider>
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
  const { can, roles } = usePosRoles();
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
  // shop screens, each shown to whoever holds the capability that opens it.
  //
  // This array and the switch in PosRoot are two halves of one thing and no
  // guard checks that they agree: check-scaffold-routes.mjs covers the admin
  // panel's nav, not the register's. Change them together.
  const items = useMemo<PosNavItem[]>(() => {
    const role = local.user?.role;
    const shows = (capability: PosLocalCapability) => local.standalone && can(role, capability);
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
    if (shows('store.view')) {
      list.push({ href: '/pos/store', label: t('pos.nav.store'), icon: 'store', group: 'shop' });
    }
    if (shows('sales.view')) {
      list.push({ href: '/pos/sales', label: t('pos.nav.sales'), icon: 'sales', group: 'shop' });
    }
    if (shows('people.view')) {
      list.push({ href: '/pos/people', label: t('pos.nav.people'), icon: 'people', group: 'shop' });
    }
    // A cloud till has no role definitions to consult, and settings answered to
    // nobody before capabilities existed, so it stays open there.
    if (!local.standalone || can(role, 'settings.view')) {
      list.push({
        href: '/pos/settings',
        label: t('pos.nav.settings'),
        icon: 'settings',
        group: 'system',
      });
    }
    // Pinned to the foot rather than sorted into 'system': it is the one screen
    // an ordinary shop never opens, and the sidebar has room for it there now
    // that the avatar and sign-off have gone back to the top bar, where they
    // already were.
    if (shows('appAdmin.view')) {
      list.push({
        href: '/pos/app-admin',
        label: t('pos.nav.appAdmin'),
        icon: 'roles',
        group: 'bottom',
      });
    }
    return list;
  }, [t, local.standalone, local.user?.role, can, waiting]);

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
      <PosSidebar items={items} activeHref={activeHref} roleLabel={roleLabel} />

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
        <PosOpenSaleBanner />

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
  const { pathname, replace } = useCaspianNavigation();
  const { standalone, user } = usePosLocalSession();
  const { can } = usePosRoles();
  const after = stripLocalePrefix(pathname).replace(/^\/pos\/?/, '');
  const [head] = after.split('/');

  // The back office used to live at /pos/admin holding four tabs. Three are
  // pages of their own now and the fourth is a settings section, so the address
  // is all that is left of it -- and a till that bookmarked it, or a cashier
  // typing it from memory, should still land somewhere useful.
  useEffect(() => {
    // A cloud till has no /pos/sales to land on, so it goes where it can sell.
    if (head === 'admin') replace(standalone ? '/pos/sales' : '/pos');
  }, [head, replace, standalone]);

  // Only a standalone till has these screens. On a cloud till they are just a
  // mistyped URL, and the rule above is that those land on the register rather
  // than on a screen with nothing in it.
  const opens = (capability: PosLocalCapability) => standalone && can(user?.role, capability);

  // Bound once and spent six times, because every miss in this switch resolves
  // to the register: a screen a role cannot open must not become a way past the
  // drawer count. The element inside is only an object -- `PosRegister()` is not
  // called until the gate returns it -- so a gated till never mounts the
  // register's hooks and never installs the scanner's keyboard listener.
  //
  // A cloud till has no local shop record and no drawer log, so the gate is not
  // merely inert there; it is meaningless, and skipping the wrapper keeps that
  // path exactly as it was.
  const register = standalone ? (
    <PosOpeningCashGate>
      <PosRegister />
    </PosOpeningCashGate>
  ) : (
    <PosRegister />
  );

  switch (head) {
    case 'settings':
      // Ungated on a cloud till, which has no role definitions to consult.
      return !standalone || can(user?.role, 'settings.view') ? <PosSettingsPage /> : register;
    case 'queue':
      return <PosQueuePage />;
    case 'store':
      return opens('store.view') ? <LocalStorePanel /> : register;
    case 'sales':
      return opens('sales.view') ? <LocalSalesPage /> : register;
    case 'people':
      return opens('people.view') ? <LocalPeoplePage /> : register;
    case 'app-admin':
      return opens('appAdmin.view') ? <PosAppAdminPage /> : register;
    default:
      return register;
  }
}
