'use client';

import { AdminPluginsPage } from './admin-plugins-page';
import { AdminPluginInstallRedirect } from './admin-plugin-install-page';

export interface AdminEmailPluginsPageProps {
  className?: string;
  /**
   * @deprecated Plugins are edited on their own page now. When set, this
   * component opens that install's section on `/admin/plugins/<pluginId>`.
   */
  autoConfigureInstallId?: string;
}

/**
 * The Plugins list narrowed to email plugins. Kept as a public export for
 * consumers that mounted it directly; `/admin/plugins?filter=email` is the
 * same screen.
 */
export function AdminEmailPluginsPage({
  className,
  autoConfigureInstallId,
}: AdminEmailPluginsPageProps) {
  if (autoConfigureInstallId) {
    return (
      <AdminPluginInstallRedirect
        category="email"
        installId={autoConfigureInstallId}
        className={className}
      />
    );
  }
  return <AdminPluginsPage category="email" className={className} />;
}
