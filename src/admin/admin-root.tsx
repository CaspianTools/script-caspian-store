'use client';

import { useEffect, type ReactNode } from 'react';
import { useCaspianNavigation } from '../provider/caspian-store-provider';
import { stripLocalePrefix } from '../utils/strip-locale-prefix';
import { AdminDashboard } from './admin-dashboard';
import { AdminProductsList } from './admin-products-list';
import { AdminProductEditor } from './admin-product-editor';
import { AdminOrdersList } from './admin-orders-list';
import { AdminOrderDetail } from './admin-order-detail';
import { AdminReviewsModeration } from './admin-reviews-moderation';
import { AdminJournalPage } from './admin-journal-page';
import { AdminPagesPage } from './admin-pages-page';
import { AdminFaqsPage } from './admin-faqs-page';
import { AdminPromoCodesPage } from './admin-promo-codes-page';
import { AdminSubscribersPage } from './admin-subscribers-page';
import { AdminUsersPage } from './admin-users-page';
import { AdminUserDetail } from './admin-user-detail';
import { AdminContactsPage } from './admin-contacts-page';
import { AdminTaxonomiesShell } from './admin-taxonomies-shell';
import { AdminProductCategoriesPage } from './admin-product-categories-page';
import { AdminCategoryEditor } from './admin-category-editor';
import { AdminProductCollectionsPage } from './admin-product-collections-page';
import { AdminAboutPage } from './admin-about-page';
import { AdminHelpPage } from './admin-help-page';
import { AdminAppearancePage } from './admin-appearance-page';
import { AdminTemplatesPage } from './admin-templates-page';
import { AdminSettingsShell } from './admin-settings-shell';
import { AdminPluginsPage } from './admin-plugins-page';
import { AdminPluginInstallPage } from './admin-plugin-install-page';
import { AdminPluginSettingsPage } from './admin-plugin-settings-page';
import { AdminAccountPage } from './admin-account-page';

/**
 * Dispatcher for every /admin/** route. Parses pathname from the navigation
 * adapter and renders the matching admin page or delegates to a subshell.
 *
 * New admin pages land by adding a switch case here — never by asking the
 * consumer to add a route file. That is the v7 contract.
 *
 * v8.2.0 reshuffle:
 *  - `/admin/appearance` → top-level again (Settings sidebar child); legacy
 *    `/admin/settings/appearance` redirects here for one release.
 *
 * Plugins:
 *  - `/admin/plugins` → `<AdminPluginsPage>`, one card per catalog plugin with an Enable switch.
 *  - `/admin/plugins/<pluginId>` → `<AdminPluginSettingsPage>`, that plugin's own settings.
 *  - `/admin/plugins/<pluginId>/<installId>` → the same page scrolled to that install.
 *  - Legacy `/admin/plugins/manage/<category>` and
 *    `/admin/plugins/shipping|payments|email-providers` redirect to the filtered list.
 */
export function AdminRoot(): ReactNode {
  const pathname = stripLocalePrefix(useCaspianNavigation().pathname);
  const after = pathname.replace(/^\/admin\/?/, '');
  if (!after) return <AdminDashboard />;
  const [head, a, b] = after.split('/');

  switch (head) {
    case 'products':
      if (a === 'new') return <AdminProductEditor />;
      if (b === 'edit') return <AdminProductEditor productId={a} />;
      return <AdminProductsList />;
    case 'orders':
      return a ? <AdminOrderDetail orderId={a} /> : <AdminOrdersList />;
    case 'users':
      return a ? <AdminUserDetail userId={a} /> : <AdminUsersPage />;
    case 'contacts':
      return <AdminContactsPage />;
    case 'subscribers':
      return <AdminSubscribersPage />;
    case 'reviews':
      return <AdminReviewsModeration />;
    case 'brands':
      // Brands moved under the Taxonomies page. Redirect the old top-level URL
      // for one release so existing bookmarks don't 404.
      return <LegacyRedirect to="/admin/taxonomies/brands" />;
    case 'taxonomies':
      return <AdminTaxonomiesShell />;
    case 'categories':
      if (a === 'new') return <AdminCategoryEditor />;
      if (b === 'edit') return <AdminCategoryEditor categoryId={a} />;
      return <AdminProductCategoriesPage />;
    case 'collections':
      return <AdminProductCollectionsPage />;
    case 'promo-codes':
      return <AdminPromoCodesPage />;
    case 'pages':
      return <AdminPagesPage />;
    case 'faqs':
      return <AdminFaqsPage />;
    case 'journal':
      return <AdminJournalPage />;
    case 'appearance':
      return <AdminAppearancePage />;
    case 'templates':
      return <AdminTemplatesPage />;
    case 'about':
      return <AdminAboutPage />;
    case 'help':
      return <AdminHelpPage />;
    case 'account':
      return <AdminAccountPage />;
    case 'settings':
      return <AdminSettingsShell />;
    case 'plugins':
      return <PluginsDispatch segments={[a, b]} />;
    default:
      return <AdminDashboard />;
  }
}

function PluginsDispatch({ segments }: { segments: [string | undefined, string | undefined] }): ReactNode {
  const [a, b] = segments;

  if (!a) return <AdminPluginsPage />;

  // Legacy category URLs — the v7 per-category screens and the v5 roots
  // before them — land on the one list with that category filtered.
  if (a === 'manage') {
    const filter = b ? LEGACY_PLUGIN_CATEGORY.get(b) : undefined;
    return <LegacyRedirect to={filter ? `/admin/plugins?filter=${filter}` : '/admin/plugins'} />;
  }
  const legacyFilter = LEGACY_PLUGIN_CATEGORY.get(a);
  if (legacyFilter) return <LegacyRedirect to={`/admin/plugins?filter=${legacyFilter}`} />;

  if (b) return <AdminPluginInstallPage pluginId={a} installId={b} />;
  return <AdminPluginSettingsPage pluginId={a} />;
}

const LEGACY_PLUGIN_CATEGORY = new Map<string, string>([
  ['shipping', 'shipping'],
  ['payments', 'payment'],
  ['email-providers', 'email'],
]);

function LegacyRedirect({ to }: { to: string }): ReactNode {
  const nav = useCaspianNavigation();
  useEffect(() => {
    nav.replace(to);
  }, [nav, to]);
  return null;
}
