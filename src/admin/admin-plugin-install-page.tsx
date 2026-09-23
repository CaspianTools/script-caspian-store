'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { Skeleton } from '../ui/misc';
import { listPluginInstalls, type PluginCategory } from './admin-plugin-registry';
import { AdminPluginSettingsPage } from './admin-plugin-settings-page';
import { AdminPluginsPage } from './admin-plugins-page';

export interface AdminPluginInstallPageProps {
  /** Catalog plugin id (e.g. `flat-rate`, `stripe`, `sendgrid`). */
  pluginId: string;
  /** Firestore install doc id. */
  installId: string;
  className?: string;
}

/**
 * `/admin/plugins/<pluginId>/<installId>` — the plugin's settings page,
 * scrolled to that install's section. Kept for links and bookmarks from
 * before plugins had one page each (`/admin/plugins/<pluginId>`).
 */
export function AdminPluginInstallPage({
  pluginId,
  installId,
  className,
}: AdminPluginInstallPageProps): ReactNode {
  return (
    <AdminPluginSettingsPage pluginId={pluginId} focusInstallId={installId} className={className} />
  );
}

/**
 * Resolves an install id to its plugin and shows that plugin's settings page.
 * Backs the deprecated `autoConfigureInstallId` prop of the category pages,
 * which only ever knew the install id.
 */
export function AdminPluginInstallRedirect({
  category,
  installId,
  className,
}: {
  category: PluginCategory;
  installId: string;
  className?: string;
}): ReactNode {
  const { db } = useCaspianFirebase();
  // undefined = still looking, null = no such install.
  const [pluginId, setPluginId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    listPluginInstalls(db, category)
      .then((list) => {
        if (alive) setPluginId(list.find((x) => x.id === installId)?.pluginId ?? null);
      })
      .catch(() => {
        if (alive) setPluginId(null);
      });
    return () => {
      alive = false;
    };
  }, [db, category, installId]);

  if (pluginId === undefined) {
    return <Skeleton className={className} style={{ height: 320, borderRadius: 12 }} />;
  }
  if (pluginId === null) return <AdminPluginsPage category={category} className={className} />;
  return (
    <AdminPluginSettingsPage pluginId={pluginId} focusInstallId={installId} className={className} />
  );
}
