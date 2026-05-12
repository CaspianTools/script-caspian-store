'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PaymentPluginInstall } from '../types';
import {
  createPaymentPluginInstall,
  deletePaymentPluginInstall,
  listPaymentPluginInstalls,
  updatePaymentPluginInstall,
  type PaymentPluginInstallWriteInput,
} from '../services/payment-plugin-service';
import { PAYMENT_PLUGIN_CATALOG, getPaymentPlugin } from '../payments/catalog';
import { PAYMENT_PLUGIN_IDS, type PaymentPluginId } from '../payments/types';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input, Label, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';
import { FieldDescription } from '../ui/field-description';

type DraftConfig = Record<string, string>;

interface DraftState {
  pluginId: PaymentPluginId;
  name: string;
  description: string;
  order: number;
  config: DraftConfig;
}

function stringifyDefaults(cfg: Record<string, unknown>): DraftConfig {
  const out: DraftConfig = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = v === undefined || v === null ? '' : String(v);
  }
  return out;
}

function draftFromPlugin(pluginId: PaymentPluginId, name: string, order: number): DraftState {
  const plugin = getPaymentPlugin(pluginId);
  return {
    pluginId,
    name,
    description: '',
    order,
    config: stringifyDefaults((plugin?.defaultConfig ?? {}) as Record<string, unknown>),
  };
}

function draftFromInstall(install: PaymentPluginInstall): DraftState {
  const config = stringifyDefaults(install.config);
  // Legacy (v2.0 / v2.1) stripe installs stored a single `publishableKey`.
  // Seed the new test/live slots so the admin doesn't have to re-paste after upgrade.
  if (install.pluginId === 'stripe' && config.publishableKey && !config.publishableKeyLive && !config.publishableKeyTest) {
    if (config.publishableKey.startsWith('pk_live_')) {
      config.publishableKeyLive = config.publishableKey;
      if (!config.mode) config.mode = 'live';
    } else if (config.publishableKey.startsWith('pk_test_')) {
      config.publishableKeyTest = config.publishableKey;
      if (!config.mode) config.mode = 'test';
    }
  }
  return {
    pluginId: install.pluginId as PaymentPluginId,
    name: install.name,
    description: install.description ?? '',
    order: install.order,
    config,
  };
}

/**
 * Returns `true` when the install's config passes `validateConfig` — used to
 * flip the row's action button between "Set up" (invalid / empty) and
 * "Manage" (ready for checkout). Added in v2.8.
 */
function isInstallConfigured(install: PaymentPluginInstall): boolean {
  const plugin = getPaymentPlugin(install.pluginId);
  if (!plugin) return false;
  try {
    plugin.validateConfig(install.config);
    return true;
  } catch {
    return false;
  }
}

function coerceConfig(raw: DraftConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const trimmed = v.trim();
    if (trimmed === '') continue;
    out[k] = trimmed;
  }
  return out;
}

export interface AdminPaymentPluginsPageProps {
  className?: string;
  /** v7.1.0 deep-link — see AdminShippingPluginsPageProps.autoConfigureInstallId. */
  autoConfigureInstallId?: string;
}

export function AdminPaymentPluginsPage({
  className,
  autoConfigureInstallId,
}: AdminPaymentPluginsPageProps) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const t = useT();
  const [installs, setInstalls] = useState<PaymentPluginInstall[] | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoConfigureHandled, setAutoConfigureHandled] = useState(false);

  const load = async () => {
    try {
      setInstalls(await listPaymentPluginInstalls(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list payment plugin installs:', error);
      setInstalls([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalogEntries = useMemo(
    () => PAYMENT_PLUGIN_IDS.map((id) => PAYMENT_PLUGIN_CATALOG[id]),
    [],
  );

  const openBrowse = () => setBrowseOpen(true);

  const openInstall = (pluginId: PaymentPluginId) => {
    const plugin = getPaymentPlugin(pluginId);
    if (!plugin) return;
    setEditingId(null);
    setDraft(draftFromPlugin(pluginId, plugin.name, (installs?.length ?? 0) + 1));
    setBrowseOpen(false);
    setConfigOpen(true);
  };

  const openConfigure = (install: PaymentPluginInstall) => {
    setEditingId(install.id);
    setDraft(draftFromInstall(install));
    setConfigOpen(true);
  };

  useEffect(() => {
    if (autoConfigureHandled || !autoConfigureInstallId || !installs) return;
    const target = installs.find((x) => x.id === autoConfigureInstallId);
    if (target) {
      openConfigure(target);
      setAutoConfigureHandled(true);
    }
  }, [autoConfigureHandled, autoConfigureInstallId, installs]);

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast({ title: t('admin.paymentPlugins.errors.nameRequired'), variant: 'destructive' });
      return;
    }
    const plugin = getPaymentPlugin(draft.pluginId);
    if (!plugin) {
      toast({ title: 'Unknown plugin', variant: 'destructive' });
      return;
    }
    const coerced = coerceConfig(draft.config);
    try {
      plugin.validateConfig(coerced);
    } catch (error) {
      toast({
        title: t('admin.paymentPlugins.errors.invalidConfig'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      return;
    }
    const editingInstall = editingId ? installs?.find((i) => i.id === editingId) : null;
    // First instance of a given pluginId auto-enables: the merchant clicked
    // Save in this dialog, which IS the verification step, so making them flip
    // a separate Enable toggle is busywork that breaks storefront checkout
    // silently (the `/checkout` gate is "at least one enabled install"). Extra
    // instances of the same plugin (e.g. a second Stripe sandbox account)
    // keep the disabled-by-default pattern so the merchant can verify the new
    // config before swapping live traffic over.
    const isFirstInstanceOfPlugin =
      !editingId && !(installs ?? []).some((i) => i.pluginId === draft.pluginId);
    const trimmedDescription = draft.description.trim();
    const payload: PaymentPluginInstallWriteInput = {
      pluginId: draft.pluginId,
      name: draft.name.trim(),
      description: trimmedDescription || undefined,
      enabled: editingInstall?.enabled ?? isFirstInstanceOfPlugin,
      order: draft.order,
      config: coerced,
    };
    setSaving(true);
    try {
      if (editingId) {
        await updatePaymentPluginInstall(db, editingId, payload);
        toast({ title: t('admin.paymentPlugins.toasts.updated') });
        setConfigOpen(false);
        await load();
      } else {
        await createPaymentPluginInstall(db, payload);
        toast({ title: t('admin.paymentPlugins.toasts.installed') });
        setConfigOpen(false);
        // Return to the unified plugins list so the merchant sees their new
        // install in context (and so the deep-linked category page, which
        // isn't in the admin sidebar nav, doesn't become an orphan tab).
        nav.push('/admin/plugins');
      }
    } catch (error) {
      console.error('[caspian-store] Payment plugin save failed:', error);
      toast({ title: t('admin.paymentPlugins.errors.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (install: PaymentPluginInstall) => {
    if (!confirm(`${t('admin.paymentPlugins.confirmRemove')}\n\n"${install.name}"`)) return;
    try {
      await deletePaymentPluginInstall(db, install.id);
      setInstalls((prev) => (prev ? prev.filter((x) => x.id !== install.id) : prev));
      toast({ title: t('admin.paymentPlugins.toasts.removed') });
    } catch (error) {
      console.error('[caspian-store] Payment plugin remove failed:', error);
      toast({ title: t('admin.paymentPlugins.errors.removeFailed'), variant: 'destructive' });
    }
  };

  const toggleEnabled = async (install: PaymentPluginInstall) => {
    try {
      await updatePaymentPluginInstall(db, install.id, { enabled: !install.enabled });
      setInstalls((prev) =>
        prev
          ? prev.map((x) => (x.id === install.id ? { ...x, enabled: !install.enabled } : x))
          : prev,
      );
    } catch (error) {
      console.error('[caspian-store] Payment plugin toggle failed:', error);
      toast({ title: t('admin.paymentPlugins.errors.toggleFailed'), variant: 'destructive' });
    }
  };

  const activePlugin = draft ? getPaymentPlugin(draft.pluginId) : null;

  return (
    <div className={className}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {t('admin.paymentPlugins.title')}
          </h1>
          <p style={{ color: '#666', marginTop: 4 }}>
            {t('admin.paymentPlugins.subtitle')}
          </p>
        </div>
        <Button onClick={openBrowse}>{t('admin.paymentPlugins.browse')}</Button>
      </header>

      {installs === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton style={{ height: 48 }} />
          <Skeleton style={{ height: 48 }} />
        </div>
      ) : installs.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: '1px dashed #ddd',
            borderRadius: 'var(--caspian-radius, 8px)',
            color: '#666',
          }}
        >
          <p style={{ margin: 0, fontSize: 15 }}>{t('admin.paymentPlugins.empty')}</p>
          <div style={{ marginTop: 16 }}>
            <Button variant="outline" onClick={openBrowse}>
              {t('admin.paymentPlugins.browse')}
            </Button>
          </div>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.paymentPlugins.col.order')}</TH>
              <TH>{t('admin.paymentPlugins.col.name')}</TH>
              <TH>{t('admin.paymentPlugins.col.plugin')}</TH>
              <TH>{t('admin.paymentPlugins.col.status')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.paymentPlugins.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {installs.map((install) => {
              const plugin = getPaymentPlugin(install.pluginId);
              const configured = isInstallConfigured(install);
              const description = install.description ?? plugin?.description ?? '';
              return (
                <TR key={install.id}>
                  <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{install.order}</TD>
                  <TD style={{ fontWeight: 500 }}>
                    <div>{install.name}</div>
                    {description && (
                      <div style={{ fontSize: 12, color: '#777', fontWeight: 400, marginTop: 2, maxWidth: 420 }}>
                        {description}
                      </div>
                    )}
                  </TD>
                  <TD style={{ color: '#666' }}>{plugin?.name ?? install.pluginId}</TD>
                  <TD>
                    <Badge variant={install.enabled ? 'default' : 'secondary'}>
                      {install.enabled
                        ? t('admin.paymentPlugins.status.enabled')
                        : t('admin.paymentPlugins.status.disabled')}
                    </Badge>
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => toggleEnabled(install)}>
                        {install.enabled
                          ? t('admin.paymentPlugins.action.disable')
                          : t('admin.paymentPlugins.action.enable')}
                      </Button>
                      <Button
                        variant={configured ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => openConfigure(install)}
                      >
                        {configured ? 'Manage' : 'Set up'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(install)}
                      >
                        {t('admin.paymentPlugins.action.remove')}
                      </Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <Dialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        title={t('admin.paymentPlugins.browseTitle')}
        description={t('admin.paymentPlugins.browseSubtitle')}
        maxWidth={720}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {catalogEntries.map((plugin) => (
            <div
              key={plugin.id}
              style={{
                border: '1px solid #eee',
                borderRadius: 'var(--caspian-radius, 8px)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{plugin.name}</h3>
              <p style={{ margin: 0, color: '#666', fontSize: 13, flex: 1 }}>
                {plugin.description}
              </p>
              <Button size="sm" onClick={() => openInstall(plugin.id)}>
                {t('admin.paymentPlugins.install')}
              </Button>
            </div>
          ))}
        </div>
      </Dialog>

      {draft && (
        <Dialog
          open={configOpen}
          onOpenChange={(v) => {
            setConfigOpen(v);
            if (!v) setDraft(null);
          }}
          title={
            editingId
              ? t('admin.paymentPlugins.configureTitle')
              : t('admin.paymentPlugins.installTitle')
          }
          description={activePlugin?.description}
          maxWidth={560}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setConfigOpen(false)}
                disabled={saving}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {t('common.save')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Label>{t('admin.paymentPlugins.field.name')}</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                placeholder={activePlugin?.name}
              />
              <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {t('admin.paymentPlugins.field.nameHint')}
              </p>
            </div>
            <div>
              <Label>Checkout description (optional)</Label>
              <Textarea
                rows={2}
                value={draft.description}
                placeholder={activePlugin?.description ?? 'Shown to shoppers at checkout.'}
                onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
              />
              <FieldDescription>
                Appears under the gateway name at checkout. Leave blank to use the plugin's catalog
                description.
              </FieldDescription>
            </div>
            <div>
              <Label>{t('admin.paymentPlugins.field.order')}</Label>
              <Input
                type="number"
                value={draft.order}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, order: Number(e.target.value) || 0 } : d))
                }
              />
            </div>

            <ConfigFields draft={draft} setDraft={setDraft} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ConfigFields({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: React.Dispatch<React.SetStateAction<DraftState | null>>;
}) {
  const t = useT();
  const setConfigValue = (key: string, value: string) =>
    setDraft((d) => (d ? { ...d, config: { ...d.config, [key]: value } } : d));

  switch (draft.pluginId) {
    case 'stripe': {
      const mode = draft.config.mode === 'live' ? 'live' : 'test';
      return (
        <>
          <div>
            <Label>{t('admin.paymentPlugins.field.stripe.mode')}</Label>
            <Select
              value={mode}
              onChange={(e) => setConfigValue('mode', e.target.value)}
              options={[
                { value: 'test', label: t('admin.paymentPlugins.field.stripe.modeTest') },
                { value: 'live', label: t('admin.paymentPlugins.field.stripe.modeLive') },
              ]}
            />
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {t('admin.paymentPlugins.field.stripe.modeHint')}
            </p>
          </div>
          <div>
            <Label>
              {t('admin.paymentPlugins.field.stripe.publishableKeyTest')}
              {mode === 'test' && (
                <span style={{ color: '#b91c1c', marginLeft: 4 }} aria-hidden>
                  *
                </span>
              )}
            </Label>
            <Input
              value={draft.config.publishableKeyTest ?? ''}
              onChange={(e) => setConfigValue('publishableKeyTest', e.target.value)}
              placeholder="pk_test_..."
            />
          </div>
          <div>
            <Label>
              {t('admin.paymentPlugins.field.stripe.publishableKeyLive')}
              {mode === 'live' && (
                <span style={{ color: '#b91c1c', marginLeft: 4 }} aria-hidden>
                  *
                </span>
              )}
            </Label>
            <Input
              value={draft.config.publishableKeyLive ?? ''}
              onChange={(e) => setConfigValue('publishableKeyLive', e.target.value)}
              placeholder="pk_live_..."
            />
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {t('admin.paymentPlugins.field.stripe.publishableKeyHint')}
            </p>
          </div>
        </>
      );
    }
    case 'bacs':
      return (
        <>
          <div>
            <Label>Instructions shown to shoppers</Label>
            <Textarea
              rows={3}
              value={draft.config.instructions ?? ''}
              onChange={(e) => setConfigValue('instructions', e.target.value)}
              placeholder="Please transfer the total amount to the account below. We'll ship once payment clears."
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Account name *</Label>
              <Input
                value={draft.config.accountName ?? ''}
                onChange={(e) => setConfigValue('accountName', e.target.value)}
                placeholder="Acme Trading Co."
              />
            </div>
            <div>
              <Label>Account number</Label>
              <Input
                value={draft.config.accountNumber ?? ''}
                onChange={(e) => setConfigValue('accountNumber', e.target.value)}
                placeholder="12345678"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <Label>Sort code</Label>
              <Input
                value={draft.config.sortCode ?? ''}
                onChange={(e) => setConfigValue('sortCode', e.target.value)}
                placeholder="12-34-56"
              />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input
                value={draft.config.iban ?? ''}
                onChange={(e) => setConfigValue('iban', e.target.value)}
                placeholder="GB82 WEST …"
              />
            </div>
            <div>
              <Label>SWIFT/BIC</Label>
              <Input
                value={draft.config.swift ?? ''}
                onChange={(e) => setConfigValue('swift', e.target.value)}
                placeholder="ABCDEF2L"
              />
            </div>
          </div>
          <FieldDescription>
            Either an account number or an IBAN is required. Sort code and SWIFT are optional.
          </FieldDescription>
        </>
      );
    case 'cheque':
      return (
        <>
          <div>
            <Label>Instructions shown to shoppers</Label>
            <Textarea
              rows={3}
              value={draft.config.instructions ?? ''}
              onChange={(e) => setConfigValue('instructions', e.target.value)}
              placeholder="Please mail your cheque to the address below. We'll ship once it clears."
            />
          </div>
          <div>
            <Label>Make cheques payable to</Label>
            <Input
              value={draft.config.payableTo ?? ''}
              onChange={(e) => setConfigValue('payableTo', e.target.value)}
              placeholder="Acme Trading Co."
            />
          </div>
          <div>
            <Label>Postal address</Label>
            <Textarea
              rows={3}
              value={draft.config.postalAddress ?? ''}
              onChange={(e) => setConfigValue('postalAddress', e.target.value)}
              placeholder="123 High Street\nLondon\nN1 1AA"
            />
          </div>
        </>
      );
    case 'cod':
      return (
        <>
          <div>
            <Label>Instructions shown to shoppers</Label>
            <Textarea
              rows={3}
              value={draft.config.instructions ?? ''}
              onChange={(e) => setConfigValue('instructions', e.target.value)}
              placeholder="Pay with cash when you receive your order."
            />
          </div>
          <div>
            <Label>Eligible shipping methods (comma-separated)</Label>
            <Input
              value={draft.config.enabledForShippingMethods ?? ''}
              onChange={(e) => setConfigValue('enabledForShippingMethods', e.target.value)}
              placeholder="Local delivery, Courier"
            />
            <FieldDescription>
              Leave blank to offer COD on every shipping method. Enter the display names of the
              shipping-plugin installs you want to allow.
            </FieldDescription>
          </div>
        </>
      );
    default:
      return null;
  }
}
