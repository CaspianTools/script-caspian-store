'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import {
  useCaspianNavigation,
  useAuth,
  useT,
  useCaspianFirebaseOptional,
  stripLocalePrefix,
} from '@caspian-explorer/script-caspian-store';
import { usePosLocalSession } from './standalone/local-session-context';
import { PosLockGate } from './standalone/pos-lock-gate';
import { usePosRoles } from './standalone/role-context';
import type { PosLocalCapability } from './standalone/types';
import { PosAppAdminPage } from './standalone/admin/pos-app-admin-page';
import { PosOpeningCashGate } from './standalone/pos-opening-cash-gate';
import { PosShiftGate } from './standalone/pos-shift-gate';
import { PosShiftPage } from './standalone/pos-shift-page';
import { PosShiftStrip } from './standalone/pos-shift-strip';
import { PosShiftProvider } from './standalone/shift-context';
import { PosTerminalClaimGate } from './standalone/pos-terminal-claim-gate';
import { PosTerminalProvider } from './standalone/terminal-context';
import { LocalStorePanel } from './standalone/admin/local-store-panel';
import { LocalProductPage } from './standalone/admin/local-product-page';
import { LocalReceiveStockPage } from './standalone/admin/local-receive-stock-page';
import { LocalCategoriesPanel } from './standalone/admin/local-categories-panel';
import { LocalCategoryPage } from './standalone/admin/local-category-page';
import { LocalSuppliersPanel } from './standalone/admin/local-suppliers-panel';
import { LocalSupplierPage } from './standalone/admin/local-supplier-page';
import { PosLocalSettingsPage } from './standalone/admin/pos-local-settings-page';
import { PosQuickAddProvider } from './standalone/admin/quick-add/pos-quick-add-context';
import { PosLocalTopbar } from './standalone/chrome/pos-local-topbar';
import { LocalSalesPage } from './standalone/admin/local-sales-panel';
import { LocalPeoplePage } from './standalone/admin/local-people-panel';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseBanner } from './license/pos-license-banner';
import { PosQueuePage } from './pos-queue-page';
import { PosAdapterProvider, usePosAdapter } from './pos-adapter-context';
import { PosOpenSaleProvider } from './open-sale-context';
import { PosOpenSaleBanner } from './open-sale-banner';
import { PosAutoBackupProvider } from './standalone/auto-backup-context';
import { PosShopSettingsProvider, usePosShopSettings } from './standalone/shop-settings-context';
import { PosServiceWorker } from './pos-service-worker';
import { PosSidebar, type PosNavItem } from './pos-sidebar';
import { PosTopbar } from './pos-topbar';
import { PosChromeProvider } from './theme/pos-chrome-context';
import { PosStyleScope } from './theme/pos-styles';
import { usePosQueue } from './offline/use-pos-queue';
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
              {/*
                Above `PosShellChrome`, which is where the menu is built, and
                therefore above `PosRoot`, which the chrome renders as its
                children. Both halves have to agree about which optional
                screens this shop has: a menu that grew a Categories link a
                frame after the route already resolved would be a link to a
                page that had just bounced to the register.
              */}
              <PosShopSettingsProvider>
                {/*
                  Which counter this machine is, and whose turn is open at it.
                  Both do nothing at all outside standalone mode, and the shift
                  provider is inside the terminal one because a shift belongs to
                  a counter.

                  Above `PosShellChrome` for the reason the shop settings are:
                  the strip the register draws and the gates that can replace it
                  are both below this, and a provider mounted lower would re-read
                  storage on every navigation between them.
                */}
                <PosTerminalProvider>
                  <PosShiftProvider>
                    {/*
                      Inside the auto-backup provider, not above it and emphatically
                      not in `PosGuard`: a lock screen mounted at the guard unmounts
                      everything below it, and a till locked overnight would stop
                      taking the automatic backups that are the one thing it should
                      be doing while nobody is looking.
                    */}
                    <PosLockGate>
                      {/*
                        Quick add, the one place the till creates anything.
                        Inside the lock gate rather than above it, so a locked
                        till has no dialog sitting behind the lock screen; below
                        the shop settings because the entries it offers depend on
                        which optional screens this shop has switched on.
                      */}
                      <PosQuickAddProvider>
                        <PosShellChrome>{children}</PosShellChrome>
                      </PosQuickAddProvider>
                    </PosLockGate>
                  </PosShiftProvider>
                </PosTerminalProvider>
              </PosShopSettingsProvider>
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
        {/*
          Two bars, not one with a mode flag. The shared one had grown five
          `local && …` branches -- a quick-add menu whose every entry was
          standalone-only, and two form dialogs a cloud register imported and
          could never open. pos/CLAUDE.md calls that the signal a standalone
          feature wants a file of its own, so it has one, and the branches came
          out of `pos-topbar.tsx` rather than growing a sixth.
        */}
        {local.standalone ? (
          <PosLocalTopbar
            title={current?.label ?? t('pos.nav.register')}
            whoIsHere={whoIsHere}
            initials={initials}
            onExit={exit}
          />
        ) : (
          <PosTopbar
            title={current?.label ?? t('pos.nav.register')}
            whoIsHere={whoIsHere}
            initials={initials}
            userProfile={userProfile}
            queue={queue}
            onExit={exit}
          />
        )}

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
  // The store is the one screen with levels below it: `/pos/store/receive`,
  // `/pos/store/categories[/<id>]`, `/pos/store/suppliers[/<id>]`, and otherwise
  // a product id. `screenOf` still keys on `head` alone, so the sidebar stays
  // lit on Store for all of them.
  const [head, sub, leaf] = after.split('/');
  const { settings, loading: settingsLoading } = usePosShopSettings();

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
  //
  // The nesting order is the design. Name this counter, then open a shift at
  // it, then sell: a shift belongs to a terminal, so asking for the float first
  // would ask a question with nowhere to file the answer. The opening-cash gate
  // stays innermost and stands down when shifts are on -- the float IS the
  // drawer declaration, and asking both would put one question to a cashier
  // twice and leave two different answers on file.
  const register = standalone ? (
    <PosTerminalClaimGate>
      <PosShiftGate>
        <PosOpeningCashGate>
          {/*
            Mounted here rather than inside `PosRegister`, which is a shared
            file a cloud register renders and therefore outside the standalone
            boundary. It draws nothing until a shift is open.
          */}
          <PosShiftStrip />
          <PosRegister />
        </PosOpeningCashGate>
      </PosShiftGate>
    </PosTerminalClaimGate>
  ) : (
    <PosRegister />
  );

  switch (head) {
    case 'settings':
      // Two pages, for the reason the top bar is two bars. The shared one had
      // five `local.standalone && …` branches -- the account pane, the shop
      // record, the backup panel, the idle lock, and which version number to
      // print. Ungated on a cloud till, which has no role definitions to
      // consult.
      if (!standalone) return <PosSettingsPage />;
      return can(user?.role, 'settings.view') ? <PosLocalSettingsPage /> : register;
    case 'queue':
      return <PosQueuePage />;
    case 'store': {
      if (!opens('store.view')) return register;
      // Reserved words first, then anything else is a product id. A screen the
      // shop has switched off, or that this role cannot open, lands on the
      // products list rather than the register: whoever got here holds
      // `store.view`, so the useful place to put them is the screen they can
      // see, not the till.
      if (sub === 'receive') {
        return can(user?.role, 'stock.receive') ? <LocalReceiveStockPage /> : <LocalStorePanel />;
      }
      if (sub === 'categories' || sub === 'suppliers') {
        // Held until the shop record has actually been read. These two flags
        // start false and resolve a beat later, so deciding early would bounce
        // somebody who opened a bookmark to a screen their shop does have --
        // and bounce them to a different page, which reads as the address
        // being wrong rather than as a page still loading.
        if (settingsLoading) return <div className="cpos-page" aria-busy="true" />;
        const on = sub === 'categories' ? settings.categoriesEnabled : settings.suppliersEnabled;
        if (!on) return <LocalStorePanel />;
        // A third segment is that record's own page. Both pages resolve a
        // missing id themselves, with a way back to the list, rather than
        // bouncing -- an id that no longer exists is worth saying out loud.
        if (sub === 'categories') {
          return leaf ? <LocalCategoryPage categoryId={leaf} /> : <LocalCategoriesPanel />;
        }
        return leaf ? <LocalSupplierPage supplierId={leaf} /> : <LocalSuppliersPanel />;
      }
      return sub ? <LocalProductPage productId={sub} /> : <LocalStorePanel />;
    }
    case 'sales':
      return opens('sales.view') ? <LocalSalesPage /> : register;
    case 'people':
      return opens('people.view') ? <LocalPeoplePage /> : register;
    case 'shift':
      // Gated on `register` rather than on a capability of its own: opening and
      // closing your own turn is part of selling, and a cashier who can ring a
      // sale has to be able to finish one. Deliberately absent from the sidebar
      // -- the icon map lives in `pos-sidebar.tsx`, outside the standalone
      // boundary -- so it is reached from the strip on the register instead.
      return opens('register') ? <PosShiftPage /> : register;
    case 'app-admin':
      return opens('appAdmin.view') ? <PosAppAdminPage /> : register;
    default:
      return register;
  }
}
