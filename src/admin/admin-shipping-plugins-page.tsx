'use client';

import { AdminPluginsPage } from './admin-plugins-page';
import { AdminPluginInstallRedirect } from './admin-plugin-install-page';

export interface AdminShippingPluginsPageProps {
  className?: string;
  /**
   * @deprecated Plugins are edited on their own page now. When set, this
   * component opens that install's section on `/admin/plugins/<pluginId>`.
   */
  autoConfigureInstallId?: string;
}

/**
 * The Plugins list narrowed to shipping plugins. Kept as a public export for
 * consumers that mounted it directly; `/admin/plugins?filter=shipping` is the
 * same screen.
 */
export function AdminShippingPluginsPage({
  className,
  autoConfigureInstallId,
}: AdminShippingPluginsPageProps) {
  if (autoConfigureInstallId) {
    return (
      <AdminPluginInstallRedirect
        category="shipping"
        installId={autoConfigureInstallId}
        className={className}
      />
    );
  }
  return <AdminPluginsPage category="shipping" className={className} />;
}
