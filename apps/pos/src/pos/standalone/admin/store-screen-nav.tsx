'use client';

import type { ReactNode } from 'react';
import { cn, useCaspianNavigation } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import { FolderIcon, PackageIcon, TruckIcon, InboxIcon } from '../../../icons';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';

export type StoreScreen = 'products' | 'receive' | 'categories' | 'suppliers';

/**
 * The strip across the top of every store screen.
 *
 * Deliberately not four more entries in the sidebar. `PosShellChrome` argues at
 * length for a small menu on a till, and it was down to six items; adding
 * Receive stock, Categories and Suppliers beside Store would have made it nine
 * for a shop that turned everything on, most of which a cashier never opens.
 * The sidebar keeps one Store entry -- `screenOf` keys on the first path
 * segment, so it stays lit for every screen here -- and the second level lives
 * where the work is.
 *
 * Entries that a role cannot open, or that the shop has switched off, are
 * absent rather than disabled: a disabled tab is a promise of a screen that is
 * never coming.
 */
export function StoreScreenNav({ current }: { current: StoreScreen }) {
  const t = useT();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const role = session.user?.role;

  const tabs: Array<{ value: StoreScreen; href: string; label: string; icon: ReactNode }> = [
    {
      value: 'products',
      href: '/pos/store',
      label: t('pos.store.tab.products'),
      icon: <PackageIcon size={16} />,
    },
  ];

  if (can(role, 'stock.receive')) {
    tabs.push({
      value: 'receive',
      href: '/pos/store/receive',
      label: t('pos.store.tab.receive'),
      icon: <InboxIcon size={16} />,
    });
  }
  if (settings.categoriesEnabled) {
    tabs.push({
      value: 'categories',
      href: '/pos/store/categories',
      label: t('pos.store.tab.categories'),
      icon: <FolderIcon size={16} />,
    });
  }
  if (settings.suppliersEnabled) {
    tabs.push({
      value: 'suppliers',
      href: '/pos/store/suppliers',
      label: t('pos.store.tab.suppliers'),
      icon: <TruckIcon size={16} />,
    });
  }

  // One tab is not a choice, it is a label. A shop with the optional screens off
  // and a role that cannot receive gets the products page back exactly as it
  // was, with no chrome explaining what it is missing.
  if (tabs.length < 2) return null;

  return (
    <nav className="cpos-segmented" aria-label={t('pos.store.title')}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={cn('cpos-segmented__btn', current === tab.value && 'cpos-segmented__btn--on')}
          aria-current={current === tab.value ? 'page' : undefined}
          onClick={() => push(tab.href)}
        >
          <span className="cpos-segmented__icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
