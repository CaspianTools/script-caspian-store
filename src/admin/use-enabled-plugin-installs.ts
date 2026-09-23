'use client';

import { useEffect, useState } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { listShippingPluginInstalls } from '../services/shipping-plugin-service';
import { listPaymentPluginInstalls } from '../services/payment-plugin-service';
import { listEmailPluginInstalls } from '../services/email-plugin-service';

/**
 * Fired on `window` after the admin writes a plugin install, so the sidebar's
 * plugin children update without waiting for a window focus.
 */
const PLUGIN_INSTALLS_CHANGED_EVENT = 'caspian:plugin-installs-changed';

export function notifyPluginInstallsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PLUGIN_INSTALLS_CHANGED_EVENT));
}

export type EnabledPluginCategory = 'shipping' | 'payment' | 'email';

export interface EnabledPluginInstall {
  category: EnabledPluginCategory;
  /** The catalog plugin id (e.g. `flat-rate`, `stripe`, `sendgrid`). */
  pluginId: string;
  /** The install document id (Firestore doc id). */
  installId: string;
  /** Merchant-chosen display name. */
  name: string;
  /** Sort order as stored on the install doc. */
  order: number;
  /** Whether the install is enabled. Only meaningful when the hook is called
   *  with `{ onlyEnabled: false }`; otherwise this is always `true`. */
  enabled: boolean;
}

export interface UseEnabledPluginInstallsOptions {
  /** When `false`, the hook returns disabled installs too (each with
   *  `enabled: false`). Default `true` (back-compat for sidebar nav). */
  onlyEnabled?: boolean;
}

/**
 * Reads the currently-enabled plugin installs across shipping, payment, and
 * email collections, merged into one list.
 *
 * Added in v7.1.0 to power two surfaces:
 * 1. The unified `<AdminPluginsPage>` list view (now read through
 *    `admin-plugin-registry`, which also needs each install's config).
 * 2. Dynamic sidebar children under the Plugins nav group in `<AdminShell>` —
 *    each plugin with an enabled install becomes a sidebar leaf linking to
 *    its settings page, `/admin/plugins/<pluginId>`.
 *
 * Re-fetches on window focus so a merchant who enables/disables a plugin in
 * another tab sees the sidebar update when they come back, and on
 * `notifyPluginInstallsChanged()` for changes made in this tab. Firestore reads
 * are cheap and bounded (3 queries × small install counts) so the trade-off
 * is fine without a snapshot listener.
 */
export function useEnabledPluginInstalls(
  options: UseEnabledPluginInstallsOptions = {},
): {
  installs: EnabledPluginInstall[];
  loading: boolean;
  refresh: () => void;
} {
  const { onlyEnabled = true } = options;
  const { db } = useCaspianFirebase();
  const [installs, setInstalls] = useState<EnabledPluginInstall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      listShippingPluginInstalls(db, { onlyEnabled }).catch(() => []),
      listPaymentPluginInstalls(db, { onlyEnabled }).catch(() => []),
      listEmailPluginInstalls(db, { onlyEnabled }).catch(() => []),
    ])
      .then(([shipping, payment, email]) => {
        if (!alive) return;
        const merged: EnabledPluginInstall[] = [
          ...shipping.map((x) => ({
            category: 'shipping' as const,
            pluginId: x.pluginId,
            installId: x.id,
            name: x.name,
            order: x.order,
            enabled: x.enabled,
          })),
          ...payment.map((x) => ({
            category: 'payment' as const,
            pluginId: x.pluginId,
            installId: x.id,
            name: x.name,
            order: x.order,
            enabled: x.enabled,
          })),
          ...email.map((x) => ({
            category: 'email' as const,
            pluginId: x.pluginId,
            installId: x.id,
            name: x.name,
            order: x.order,
            enabled: x.enabled,
          })),
        ];
        merged.sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category);
          return a.order - b.order;
        });
        setInstalls(merged);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, refreshTick, onlyEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => setRefreshTick((n) => n + 1);
    window.addEventListener('focus', onFocus);
    window.addEventListener(PLUGIN_INSTALLS_CHANGED_EVENT, onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(PLUGIN_INSTALLS_CHANGED_EVENT, onFocus);
    };
  }, []);

  return { installs, loading, refresh: () => setRefreshTick((n) => n + 1) };
}
