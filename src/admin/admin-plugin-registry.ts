'use client';

import { deleteField, type Firestore } from 'firebase/firestore';
import { SHIPPING_PLUGIN_CATALOG } from '../shipping/catalog';
import { SHIPPING_PLUGIN_IDS, type ShippingPluginId } from '../shipping/types';
import { PAYMENT_PLUGIN_CATALOG } from '../payments/catalog';
import { PAYMENT_PLUGIN_IDS } from '../payments/types';
import { EMAIL_PLUGIN_CATALOG } from '../email/catalog';
import { EMAIL_PLUGIN_IDS } from '../email/types';
import {
  createShippingPluginInstall,
  deleteShippingPluginInstall,
  listShippingPluginInstalls,
  updateShippingPluginInstall,
} from '../services/shipping-plugin-service';
import {
  createPaymentPluginInstall,
  deletePaymentPluginInstall,
  listPaymentPluginInstalls,
  updatePaymentPluginInstall,
} from '../services/payment-plugin-service';
import {
  createEmailPluginInstall,
  deleteEmailPluginInstall,
  listEmailPluginInstalls,
  updateEmailPluginInstall,
} from '../services/email-plugin-service';
import type { TranslateFn } from '../i18n/locale-context';
import type { EnabledPluginCategory } from './use-enabled-plugin-installs';

/**
 * One category-agnostic view over the three plugin catalogs and their install
 * collections, so the Plugins list and the per-plugin settings page are one
 * implementation instead of three near-copies.
 */

export type PluginCategory = EnabledPluginCategory;

export const PLUGIN_CATEGORIES: readonly PluginCategory[] = ['shipping', 'payment', 'email'];

export interface CatalogPlugin {
  category: PluginCategory;
  id: string;
  name: string;
  description: string;
  defaultConfig: Record<string, unknown>;
  validateConfig: (config: unknown) => unknown;
  /** Email providers: the Cloud Functions secret a developer must set. */
  secretName?: string;
}

function toCatalogPlugin(
  category: PluginCategory,
  p: {
    id: string;
    name: string;
    description: string;
    defaultConfig: unknown;
    validateConfig: (c: unknown) => unknown;
    secretName?: string;
  },
): CatalogPlugin {
  return {
    category,
    id: p.id,
    name: p.name,
    description: p.description,
    defaultConfig: (p.defaultConfig ?? {}) as Record<string, unknown>,
    validateConfig: p.validateConfig,
    secretName: p.secretName,
  };
}

const CATALOG: CatalogPlugin[] = [
  ...SHIPPING_PLUGIN_IDS.map((id) => toCatalogPlugin('shipping', SHIPPING_PLUGIN_CATALOG[id])),
  ...PAYMENT_PLUGIN_IDS.map((id) => toCatalogPlugin('payment', PAYMENT_PLUGIN_CATALOG[id])),
  ...EMAIL_PLUGIN_IDS.map((id) => toCatalogPlugin('email', EMAIL_PLUGIN_CATALOG[id])),
];

export function listCatalogPlugins(): CatalogPlugin[] {
  return CATALOG;
}

export function findCatalogPlugin(pluginId: string): CatalogPlugin | null {
  return CATALOG.find((p) => p.id === pluginId) ?? null;
}

/** Returns the validation error message, or `null` when the config is valid. */
export function configError(plugin: CatalogPlugin, config: unknown): string | null {
  try {
    plugin.validateConfig(config);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Whether switching the plugin on from the list can create an install with
 * the catalog defaults, or has to send the owner to the settings page first.
 * Email providers always go through the page: their config validates empty,
 * but they do nothing until a developer sets the API-key secret the page
 * explains.
 */
export function canEnableWithDefaults(plugin: CatalogPlugin): boolean {
  if (plugin.secretName) return false;
  return configError(plugin, plugin.defaultConfig) === null;
}

export type PluginTogglePlan =
  /** No install yet and the defaults validate: create one, switched on. */
  | { kind: 'create' }
  /** Flip `enabled` on these installs. */
  | { kind: 'update'; ids: string[] }
  /** Cannot switch on from here: the owner has to fill in the settings first. */
  | { kind: 'needs-settings'; reason: string | null };

/**
 * Decides what the plugin-level Enable switch does. A plugin with several
 * installs (two flat-rate methods, legacy duplicate providers) is treated as
 * one switch: off turns every install off; on turns on every install whose
 * config validates, and sends the owner to settings only when none does.
 */
export function planPluginToggle(
  plugin: CatalogPlugin,
  installs: AnyPluginInstall[],
  next: boolean,
): PluginTogglePlan {
  if (!next) return { kind: 'update', ids: installs.filter((x) => x.enabled).map((x) => x.id) };
  if (installs.length === 0) {
    return canEnableWithDefaults(plugin)
      ? { kind: 'create' }
      : { kind: 'needs-settings', reason: configError(plugin, plugin.defaultConfig) };
  }
  const valid = installs.filter((x) => configError(plugin, x.config) === null);
  if (valid.length === 0) {
    return { kind: 'needs-settings', reason: configError(plugin, installs[0].config) };
  }
  return { kind: 'update', ids: valid.filter((x) => !x.enabled).map((x) => x.id) };
}

export type PluginStatus = 'enabled' | 'disabled' | 'needs-setup';

export function pluginStatus(plugin: CatalogPlugin, installs: AnyPluginInstall[]): PluginStatus {
  if (installs.some((x) => x.enabled)) return 'enabled';
  if (installs.length === 0) return canEnableWithDefaults(plugin) ? 'disabled' : 'needs-setup';
  return installs.some((x) => configError(plugin, x.config) === null) ? 'disabled' : 'needs-setup';
}

/** An install from any of the three collections, with the fields every category shares. */
export interface AnyPluginInstall {
  category: PluginCategory;
  id: string;
  pluginId: string;
  name: string;
  enabled: boolean;
  order: number;
  config: Record<string, unknown>;
  /** Payment only. */
  description?: string;
  /** Shipping only. */
  estimatedDays?: { min: number; max: number };
  /** Shipping only. */
  eligibleCountries?: string[];
}

export async function listPluginInstalls(
  db: Firestore,
  category: PluginCategory,
): Promise<AnyPluginInstall[]> {
  switch (category) {
    case 'shipping':
      return (await listShippingPluginInstalls(db)).map((x) => ({
        category,
        id: x.id,
        pluginId: x.pluginId,
        name: x.name,
        enabled: x.enabled,
        order: x.order,
        config: x.config,
        estimatedDays: x.estimatedDays,
        eligibleCountries: x.eligibleCountries,
      }));
    case 'payment':
      return (await listPaymentPluginInstalls(db)).map((x) => ({
        category,
        id: x.id,
        pluginId: x.pluginId,
        name: x.name,
        enabled: x.enabled,
        order: x.order,
        config: x.config,
        description: x.description,
      }));
    case 'email':
      return (await listEmailPluginInstalls(db)).map((x) => ({
        category,
        id: x.id,
        pluginId: x.pluginId,
        name: x.name,
        enabled: x.enabled,
        order: x.order,
        config: x.config,
      }));
  }
}

export function nextPluginOrder(installs: AnyPluginInstall[], category: PluginCategory): number {
  return (
    installs
      .filter((x) => x.category === category)
      .reduce((max, x) => Math.max(max, Number.isFinite(x.order) ? x.order : 0), 0) + 1
  );
}

/** Everything a create or a full settings save writes. */
export interface PluginInstallWrite {
  name: string;
  order: number;
  enabled: boolean;
  config: Record<string, unknown>;
  description?: string;
  estimatedDays?: { min: number; max: number };
  eligibleCountries?: string[];
}

export async function createPluginInstall(
  db: Firestore,
  plugin: CatalogPlugin,
  input: PluginInstallWrite,
): Promise<string> {
  switch (plugin.category) {
    case 'shipping':
      return createShippingPluginInstall(db, {
        pluginId: plugin.id as ShippingPluginId,
        name: input.name,
        enabled: input.enabled,
        order: input.order,
        estimatedDays: input.estimatedDays ?? { min: 3, max: 7 },
        config: input.config,
        eligibleCountries:
          input.eligibleCountries && input.eligibleCountries.length > 0
            ? input.eligibleCountries
            : undefined,
      });
    case 'payment':
      return createPaymentPluginInstall(db, {
        pluginId: plugin.id,
        name: input.name,
        description: input.description || undefined,
        enabled: input.enabled,
        order: input.order,
        config: input.config,
      });
    case 'email':
      return createEmailPluginInstall(db, {
        pluginId: plugin.id,
        name: input.name,
        enabled: input.enabled,
        order: input.order,
        config: input.config,
      });
  }
}

/** Creates an install from the catalog defaults — the list page's one-click Enable. */
export function createDefaultPluginInstall(
  db: Firestore,
  plugin: CatalogPlugin,
  order: number,
): Promise<string> {
  return createPluginInstall(db, plugin, {
    name: plugin.name,
    order,
    enabled: true,
    config: plugin.defaultConfig,
  });
}

export async function savePluginInstall(
  db: Firestore,
  category: PluginCategory,
  id: string,
  input: PluginInstallWrite,
): Promise<void> {
  switch (category) {
    case 'shipping':
      // deleteField() so a cleared country list is actually removed;
      // undefined would be stripped and leave the old list in place.
      return updateShippingPluginInstall(db, id, {
        name: input.name,
        enabled: input.enabled,
        order: input.order,
        estimatedDays: input.estimatedDays,
        config: input.config,
        eligibleCountries:
          input.eligibleCountries && input.eligibleCountries.length > 0
            ? input.eligibleCountries
            : deleteField(),
      });
    case 'payment':
      return updatePaymentPluginInstall(db, id, {
        name: input.name,
        enabled: input.enabled,
        order: input.order,
        config: input.config,
        description: input.description || deleteField(),
      });
    case 'email':
      return updateEmailPluginInstall(db, id, {
        name: input.name,
        enabled: input.enabled,
        order: input.order,
        config: input.config,
      });
  }
}

export function setPluginInstallEnabled(
  db: Firestore,
  category: PluginCategory,
  id: string,
  enabled: boolean,
): Promise<void> {
  switch (category) {
    case 'shipping':
      return updateShippingPluginInstall(db, id, { enabled });
    case 'payment':
      return updatePaymentPluginInstall(db, id, { enabled });
    case 'email':
      return updateEmailPluginInstall(db, id, { enabled });
  }
}

export function deletePluginInstall(
  db: Firestore,
  category: PluginCategory,
  id: string,
): Promise<void> {
  switch (category) {
    case 'shipping':
      return deleteShippingPluginInstall(db, id);
    case 'payment':
      return deletePaymentPluginInstall(db, id);
    case 'email':
      return deleteEmailPluginInstall(db, id);
  }
}

function firestoreErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Owner-facing explanation of a failed install write. permission-denied is
 * called out on its own: it almost always means the store's deployed rules
 * predate the plugin collections, which the setup banner can fix.
 */
export function pluginWriteErrorMessage(t: TranslateFn, error: unknown): string {
  const code = firestoreErrorCode(error);
  if (code === 'permission-denied') return t('admin.plugins.errors.permissionDenied');
  if (code === 'unavailable') return t('admin.plugins.errors.offline');
  return error instanceof Error && error.message ? error.message : t('admin.plugins.errors.generic');
}

export function pluginSettingsHref(pluginId: string, opts: { enable?: boolean } = {}): string {
  return `/admin/plugins/${encodeURIComponent(pluginId)}${opts.enable ? '?enable=1' : ''}`;
}
