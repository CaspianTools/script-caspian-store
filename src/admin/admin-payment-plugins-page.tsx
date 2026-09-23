'use client';

import { AdminPluginsPage } from './admin-plugins-page';
import { AdminPluginInstallRedirect } from './admin-plugin-install-page';

export interface AdminPaymentPluginsPageProps {
  className?: string;
  /**
   * @deprecated Plugins are edited on their own page now. When set, this
   * component opens that install's section on `/admin/plugins/<pluginId>`.
   */
  autoConfigureInstallId?: string;
}

/**
 * The Plugins list narrowed to payment plugins. Kept as a public export for
 * consumers that mounted it directly; `/admin/plugins?filter=payment` is the
 * same screen.
 */
export function AdminPaymentPluginsPage({
  className,
  autoConfigureInstallId,
}: AdminPaymentPluginsPageProps) {
  if (autoConfigureInstallId) {
    return (
      <AdminPluginInstallRedirect
        category="payment"
        installId={autoConfigureInstallId}
        className={className}
      />
    );
  }
  return <AdminPluginsPage category="payment" className={className} />;
}
