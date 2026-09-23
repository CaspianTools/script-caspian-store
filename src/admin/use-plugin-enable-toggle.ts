'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { useToast } from '../ui/toast';
import {
  createDefaultPluginInstall,
  nextPluginOrder,
  planPluginToggle,
  pluginWriteErrorMessage,
  setPluginInstallEnabled,
  type AnyPluginInstall,
  type CatalogPlugin,
} from './admin-plugin-registry';
import { notifyPluginInstallsChanged } from './use-enabled-plugin-installs';

export interface UsePluginEnableToggleOptions {
  /** Every install the page has loaded (other plugins' too — used for the next `order`). */
  installs: AnyPluginInstall[];
  setInstalls: Dispatch<SetStateAction<AnyPluginInstall[] | null>>;
  /** Called instead of writing when the plugin cannot be switched on without settings. */
  onNeedsSettings: (plugin: CatalogPlugin, reason: string | null) => void;
}

/**
 * The plugin-level Enable switch, shared by the Plugins list and the plugin
 * settings page. Updates optimistically and rolls back only the installs
 * this toggle touched, so two cards toggled in quick succession can't undo
 * each other.
 */
export function usePluginEnableToggle({
  installs,
  setInstalls,
  onNeedsSettings,
}: UsePluginEnableToggleOptions) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const setPluginBusy = (id: string, value: boolean) =>
    setBusy((prev) => ({ ...prev, [id]: value }));

  const toggle = async (plugin: CatalogPlugin, next: boolean) => {
    if (busy[plugin.id]) return;
    const mine = installs.filter((x) => x.pluginId === plugin.id);
    const plan = planPluginToggle(plugin, mine, next);

    if (plan.kind === 'needs-settings') {
      onNeedsSettings(plugin, plan.reason);
      return;
    }

    const doneToast = () =>
      toast({
        title: t(next ? 'admin.plugins.toasts.enabled' : 'admin.plugins.toasts.disabled', {
          name: plugin.name,
        }),
        variant: 'success',
      });
    const failToast = (error: unknown) =>
      toast({
        title: t(next ? 'admin.plugins.errors.enableFailed' : 'admin.plugins.errors.disableFailed', {
          name: plugin.name,
        }),
        description: pluginWriteErrorMessage(t, error),
        variant: 'destructive',
      });

    if (plan.kind === 'create') {
      const tempId = `pending-${plugin.id}`;
      const order = nextPluginOrder(installs, plugin.category);
      setInstalls((prev) => [
        ...(prev ?? []),
        {
          category: plugin.category,
          id: tempId,
          pluginId: plugin.id,
          name: plugin.name,
          enabled: true,
          order,
          config: plugin.defaultConfig,
        },
      ]);
      setPluginBusy(plugin.id, true);
      try {
        const id = await createDefaultPluginInstall(db, plugin, order);
        setInstalls((prev) => (prev ?? []).map((x) => (x.id === tempId ? { ...x, id } : x)));
        doneToast();
        notifyPluginInstallsChanged();
      } catch (error) {
        console.error('[caspian-store] Enabling plugin failed:', error);
        setInstalls((prev) => (prev ?? []).filter((x) => x.id !== tempId));
        failToast(error);
      } finally {
        setPluginBusy(plugin.id, false);
      }
      return;
    }

    if (plan.ids.length === 0) return;
    const pending = new Set(plan.ids);
    setInstalls((prev) =>
      (prev ?? []).map((x) => (pending.has(x.id) ? { ...x, enabled: next } : x)),
    );
    setPluginBusy(plugin.id, true);
    try {
      for (const id of plan.ids) {
        await setPluginInstallEnabled(db, plugin.category, id, next);
        pending.delete(id);
      }
      doneToast();
    } catch (error) {
      console.error('[caspian-store] Toggling plugin failed:', error);
      setInstalls((prev) =>
        (prev ?? []).map((x) => (pending.has(x.id) ? { ...x, enabled: !next } : x)),
      );
      failToast(error);
    } finally {
      setPluginBusy(plugin.id, false);
      notifyPluginInstallsChanged();
    }
  };

  return { toggle, busy };
}
