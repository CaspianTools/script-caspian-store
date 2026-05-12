'use client';

import { useEffect, useMemo, useState } from 'react';
import { EMAIL_PLUGIN_CATALOG, getEmailPlugin } from '../email/catalog';
import { EMAIL_PLUGIN_IDS, type EmailPluginId } from '../email/types';
import { useT } from '../i18n/locale-context';
import { useCaspianFirebase, useCaspianNavigation } from '../provider/caspian-store-provider';
import {
  createEmailPluginInstall,
  deleteEmailPluginInstall,
  listEmailPluginInstalls,
  updateEmailPluginInstall,
  type EmailPluginInstallWriteInput,
} from '../services/email-plugin-service';
import type { EmailPluginInstall } from '../types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input, Label } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';

type DraftConfig = Record<string, string>;

interface DraftState {
  pluginId: EmailPluginId;
  name: string;
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

function draftFromPlugin(pluginId: EmailPluginId, name: string, order: number): DraftState {
  const plugin = getEmailPlugin(pluginId);
  return {
    pluginId,
    name,
    order,
    config: stringifyDefaults((plugin?.defaultConfig ?? {}) as Record<string, unknown>),
  };
}

function draftFromInstall(install: EmailPluginInstall): DraftState {
  return {
    pluginId: install.pluginId as EmailPluginId,
    name: install.name,
    order: install.order,
    config: stringifyDefaults(install.config),
  };
}

function isInstallConfigured(install: EmailPluginInstall): boolean {
  // v8.0.0: configuration lives in Google Secret Manager and is invisible
  // from the browser. The install is always considered "configured" once it
  // exists in Firestore — the dispatcher logs a clear warning at send-time
  // if the secret is unset, which surfaces in Cloud Logs and the admin
  // can view via /admin/error-logs.
  const plugin = getEmailPlugin(install.pluginId);
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

export interface AdminEmailPluginsPageProps {
  className?: string;
  /** v7.1.0 deep-link — see AdminShippingPluginsPageProps.autoConfigureInstallId. */
  autoConfigureInstallId?: string;
}

export function AdminEmailPluginsPage({
  className,
  autoConfigureInstallId,
}: AdminEmailPluginsPageProps) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const t = useT();
  const [installs, setInstalls] = useState<EmailPluginInstall[] | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoConfigureHandled, setAutoConfigureHandled] = useState(false);

  const load = async () => {
    try {
      setInstalls(await listEmailPluginInstalls(db));
    } catch (error) {
      console.error('[caspian-store] Failed to list email plugin installs:', error);
      setInstalls([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalogEntries = useMemo(
    () => EMAIL_PLUGIN_IDS.map((id) => EMAIL_PLUGIN_CATALOG[id]),
    [],
  );

  const openBrowse = () => setBrowseOpen(true);

  const openInstall = (pluginId: EmailPluginId) => {
    const plugin = getEmailPlugin(pluginId);
    if (!plugin) return;
    setEditingId(null);
    setDraft(draftFromPlugin(pluginId, plugin.name, (installs?.length ?? 0) + 1));
    setBrowseOpen(false);
    setConfigOpen(true);
  };

  const openConfigure = (install: EmailPluginInstall) => {
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
      toast({ title: t('admin.emailPlugins.errors.nameRequired'), variant: 'destructive' });
      return;
    }
    const plugin = getEmailPlugin(draft.pluginId);
    if (!plugin) {
      toast({ title: 'Unknown plugin', variant: 'destructive' });
      return;
    }
    const coerced = coerceConfig(draft.config);
    try {
      plugin.validateConfig(coerced);
    } catch (error) {
      toast({
        title: t('admin.emailPlugins.errors.invalidConfig'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      return;
    }
    const editingInstall = editingId ? installs?.find((i) => i.id === editingId) : null;
    const payload: EmailPluginInstallWriteInput = {
      pluginId: draft.pluginId,
      name: draft.name.trim(),
      enabled: editingInstall?.enabled ?? false,
      order: draft.order,
      config: coerced,
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateEmailPluginInstall(db, editingId, payload);
        toast({ title: t('admin.emailPlugins.toasts.updated') });
        setConfigOpen(false);
        await load();
      } else {
        await createEmailPluginInstall(db, payload);
        toast({ title: t('admin.emailPlugins.toasts.installed') });
        setConfigOpen(false);
        // Return to the unified plugins list so the merchant sees their new
        // install in context (the deep-linked category page isn't reachable
        // from the admin sidebar nav).
        nav.push('/admin/plugins');
      }
    } catch (error) {
      console.error('[caspian-store] Email plugin save failed:', error);
      toast({ title: t('admin.emailPlugins.errors.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (install: EmailPluginInstall) => {
    if (!confirm(`${t('admin.emailPlugins.confirmRemove')}\n\n"${install.name}"`)) return;
    try {
      await deleteEmailPluginInstall(db, install.id);
      setInstalls((prev) => (prev ? prev.filter((x) => x.id !== install.id) : prev));
      toast({ title: t('admin.emailPlugins.toasts.removed') });
    } catch (error) {
      console.error('[caspian-store] Email plugin remove failed:', error);
      toast({ title: t('admin.emailPlugins.errors.removeFailed'), variant: 'destructive' });
    }
  };

  const toggleEnabled = async (install: EmailPluginInstall) => {
    try {
      await updateEmailPluginInstall(db, install.id, { enabled: !install.enabled });
      setInstalls((prev) =>
        prev
          ? prev.map((x) => (x.id === install.id ? { ...x, enabled: !install.enabled } : x))
          : prev,
      );
    } catch (error) {
      console.error('[caspian-store] Email plugin toggle failed:', error);
      toast({ title: t('admin.emailPlugins.errors.toggleFailed'), variant: 'destructive' });
    }
  };

  const activePlugin = draft ? getEmailPlugin(draft.pluginId) : null;

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
            {t('admin.emailPlugins.title')}
          </h1>
          <p style={{ color: '#666', marginTop: 4 }}>{t('admin.emailPlugins.subtitle')}</p>
        </div>
        <Button onClick={openBrowse}>{t('admin.emailPlugins.browse')}</Button>
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
          <p style={{ margin: 0, fontSize: 15 }}>{t('admin.emailPlugins.empty')}</p>
          <div style={{ marginTop: 16 }}>
            <Button variant="outline" onClick={openBrowse}>
              {t('admin.emailPlugins.browse')}
            </Button>
          </div>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('admin.emailPlugins.col.order')}</TH>
              <TH>{t('admin.emailPlugins.col.name')}</TH>
              <TH>{t('admin.emailPlugins.col.plugin')}</TH>
              <TH>{t('admin.emailPlugins.col.status')}</TH>
              <TH style={{ textAlign: 'right' }}>{t('admin.emailPlugins.col.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {installs.map((install) => {
              const plugin = getEmailPlugin(install.pluginId);
              const configured = isInstallConfigured(install);
              return (
                <TR key={install.id}>
                  <TD style={{ fontFamily: 'monospace', fontSize: 13 }}>{install.order}</TD>
                  <TD style={{ fontWeight: 500 }}>
                    <div>{install.name}</div>
                    {plugin?.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#777',
                          fontWeight: 400,
                          marginTop: 2,
                          maxWidth: 420,
                        }}
                      >
                        {plugin.description}
                      </div>
                    )}
                  </TD>
                  <TD style={{ color: '#666' }}>{plugin?.name ?? install.pluginId}</TD>
                  <TD>
                    <Badge variant={install.enabled ? 'default' : 'secondary'}>
                      {install.enabled
                        ? t('admin.emailPlugins.status.enabled')
                        : t('admin.emailPlugins.status.disabled')}
                    </Badge>
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => toggleEnabled(install)}>
                        {install.enabled
                          ? t('admin.emailPlugins.action.disable')
                          : t('admin.emailPlugins.action.enable')}
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
                        {t('admin.emailPlugins.action.remove')}
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
        title={t('admin.emailPlugins.browseTitle')}
        description={t('admin.emailPlugins.browseSubtitle')}
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
              <p style={{ margin: 0, color: '#666', fontSize: 13, flex: 1 }}>{plugin.description}</p>
              <Button size="sm" onClick={() => openInstall(plugin.id)}>
                {t('admin.emailPlugins.install')}
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
              ? t('admin.emailPlugins.configureTitle')
              : t('admin.emailPlugins.installTitle')
          }
          description={activePlugin?.description}
          maxWidth={560}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfigOpen(false)} disabled={saving}>
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
              <Label>{t('admin.emailPlugins.field.name')}</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                placeholder={activePlugin?.name}
              />
              <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {t('admin.emailPlugins.field.nameHint')}
              </p>
            </div>
            <div>
              <Label>{t('admin.emailPlugins.field.order')}</Label>
              <Input
                type="number"
                value={draft.order}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, order: Number(e.target.value) || 0 } : d))
                }
              />
            </div>
            {activePlugin?.secretName && (
              <div
                style={{
                  background: '#f7f8fa',
                  border: '1px solid #e1e4e8',
                  borderRadius: 'var(--caspian-radius, 8px)',
                  padding: 12,
                  fontSize: 13,
                }}
              >
                <strong style={{ display: 'block', marginBottom: 6 }}>
                  {t('admin.emailPlugins.secretSetup.title')}
                </strong>
                <p style={{ margin: '0 0 8px', color: '#555' }}>
                  {t('admin.emailPlugins.secretSetup.body')}
                </p>
                <code
                  style={{
                    display: 'block',
                    background: '#0d1117',
                    color: '#e6edf3',
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12,
                    overflowX: 'auto',
                  }}
                >
                  firebase functions:secrets:set {activePlugin.secretName}
                </code>
                <p style={{ margin: '8px 0 0', color: '#666', fontSize: 12 }}>
                  {t('admin.emailPlugins.secretSetup.deployHint')}
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
