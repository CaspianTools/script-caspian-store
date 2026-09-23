'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SiteSettings } from '../types';
import { getSiteSettings } from '../services/site-settings-service';
import { useCaspianFirebase, useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Badge, Skeleton } from '../ui/misc';
import { Switch } from '../ui/switch';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { useToast } from '../ui/toast';
import { ISO_COUNTRIES, type IsoCountry } from './country-picker-dialog';
import {
  configError,
  createPluginInstall,
  deletePluginInstall,
  findCatalogPlugin,
  listPluginInstalls,
  nextPluginOrder,
  pluginSettingsHref,
  pluginStatus,
  pluginWriteErrorMessage,
  savePluginInstall,
  setPluginInstallEnabled,
  type AnyPluginInstall,
  type CatalogPlugin,
} from './admin-plugin-registry';
import {
  PluginInstallForm,
  draftFromDefaults,
  draftFromInstall,
  draftToWrite,
  type PluginInstallDraft,
} from './admin-plugin-config-forms';
import { PluginStatusLabel } from './admin-plugins-page';
import { usePluginEnableToggle } from './use-plugin-enable-toggle';
import { notifyPluginInstallsChanged } from './use-enabled-plugin-installs';

export interface AdminPluginSettingsPageProps {
  /** Catalog plugin id (e.g. `flat-rate`, `stripe`, `sendgrid`). */
  pluginId: string;
  /** Scroll to and focus this install's section once loaded. `#<installId>` in the URL does the same. */
  focusInstallId?: string;
  className?: string;
}

/**
 * A plugin's own settings page at `/admin/plugins/<pluginId>`: header with the
 * Enable switch, then one form section per install. A plugin with no install
 * yet shows the form prefilled with the catalog defaults, and Save creates
 * it. Shipping plugins may have several installs (each is a separate delivery
 * option at checkout), so they get "Add another … method".
 */
export function AdminPluginSettingsPage({
  pluginId,
  focusInstallId,
  className,
}: AdminPluginSettingsPageProps) {
  const plugin = findCatalogPlugin(pluginId);
  if (!plugin) return <UnknownPlugin pluginId={pluginId} className={className} />;
  return (
    <PluginSettings
      key={plugin.id}
      plugin={plugin}
      focusInstallId={focusInstallId}
      className={className}
    />
  );
}

const PAGE_MAX_WIDTH = 760;

function BackLink() {
  const Link = useCaspianLink();
  const t = useT();
  return (
    <Link
      href="/admin/plugins"
      style={{ fontSize: 13, color: '#666', textDecoration: 'none', display: 'inline-block' }}
    >
      ← {t('admin.plugins.title')}
    </Link>
  );
}

function UnknownPlugin({ pluginId, className }: { pluginId: string; className?: string }) {
  const t = useT();
  return (
    <div className={className} style={{ maxWidth: PAGE_MAX_WIDTH }}>
      <BackLink />
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '16px 0 0' }}>
        {t('admin.plugins.unknown.title')}
      </h1>
      <p style={{ color: '#666', marginTop: 8 }}>
        {t('admin.plugins.unknown.body', { id: pluginId })}
      </p>
    </div>
  );
}

interface Section {
  /** Install id, or `new-<n>` for a form that has not been saved yet. */
  key: string;
  install: AnyPluginInstall | null;
}

function PluginSettings({
  plugin,
  focusInstallId,
  className,
}: {
  plugin: CatalogPlugin;
  focusInstallId?: string;
  className?: string;
}) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const { toast } = useToast();
  const t = useT();

  const enableRequested = nav.searchParams?.get('enable') === '1';
  const [installs, setInstalls] = useState<AnyPluginInstall[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeReason, setNoticeReason] = useState<string | null>(null);
  const [enableOnSave, setEnableOnSave] = useState(enableRequested);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const newCounter = useRef(0);
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [removeAllOpen, setRemoveAllOpen] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);

  useEffect(() => {
    if (enableRequested) setNotice(t('admin.plugins.settingsPage.enableNotice'));
    // Only on arrival; the notice is dismissed by saving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    listPluginInstalls(db, plugin.category)
      .then((list) => {
        if (alive) setInstalls(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to list plugin installs:', error);
        if (!alive) return;
        setLoadError(pluginWriteErrorMessage(t, error));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, plugin.category]);

  useEffect(() => {
    if (plugin.category !== 'shipping') return;
    let alive = true;
    getSiteSettings(db)
      .then((s) => {
        if (alive) setSite(s ?? null);
      })
      .catch(() => {
        if (alive) setSite(null);
      });
    return () => {
      alive = false;
    };
  }, [db, plugin.category]);

  const countrySource = useMemo<readonly IsoCountry[]>(() => {
    if (site?.supportedCountries && site.supportedCountries.length > 0) {
      return site.supportedCountries.map((c) => ({ code: c.code, name: c.name }));
    }
    return ISO_COUNTRIES;
  }, [site]);

  const mine = useMemo(
    () => (installs ?? []).filter((x) => x.pluginId === plugin.id),
    [installs, plugin.id],
  );
  const status = pluginStatus(plugin, mine);
  const hasInstall = mine.length > 0;

  // A plugin with nothing saved yet always shows one blank form to fill in.
  const sections: Section[] = useMemo(() => {
    const out: Section[] = mine.map((x) => ({ key: x.id, install: x }));
    if (installs !== null && mine.length === 0 && newKeys.length === 0) {
      out.push({ key: 'new-0', install: null });
    }
    for (const k of newKeys) out.push({ key: k, install: null });
    return out;
  }, [mine, newKeys, installs]);

  const { toggle, busy } = usePluginEnableToggle({
    installs: installs ?? [],
    setInstalls,
    onNeedsSettings: (_plugin, reason) => {
      setNotice(t('admin.plugins.settingsPage.enableNotice'));
      setNoticeReason(reason);
      setEnableOnSave(true);
    },
  });

  // Deep link: /admin/plugins/<pluginId>/<installId> or #<installId>.
  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current || installs === null || typeof window === 'undefined') return;
    const target = focusInstallId || window.location.hash.replace(/^#/, '');
    if (!target) return;
    const el = document.getElementById(target);
    if (!el) return;
    focusedRef.current = true;
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  }, [installs, focusInstallId]);

  const onCreated = (key: string, install: AnyPluginInstall) => {
    setInstalls((prev) => [...(prev ?? []), install]);
    setNewKeys((prev) => prev.filter((k) => k !== key));
    if (install.enabled) {
      setNotice(null);
      setNoticeReason(null);
      setEnableOnSave(false);
      if (enableRequested) nav.replace(pluginSettingsHref(plugin.id));
    }
  };

  const onUpdated = (install: AnyPluginInstall) => {
    setInstalls((prev) => (prev ?? []).map((x) => (x.id === install.id ? install : x)));
    if (install.enabled) {
      setNotice(null);
      setNoticeReason(null);
      setEnableOnSave(false);
      if (enableRequested) nav.replace(pluginSettingsHref(plugin.id));
    }
  };

  const onRemoved = (id: string) => {
    setInstalls((prev) => (prev ?? []).filter((x) => x.id !== id));
  };

  const addAnother = () => {
    newCounter.current += 1;
    setNewKeys((prev) => [...prev, `new-${newCounter.current}`]);
  };

  const removeAll = async () => {
    setRemovingAll(true);
    try {
      for (const x of mine) await deletePluginInstall(db, plugin.category, x.id);
      notifyPluginInstallsChanged();
      toast({ title: t('admin.plugins.toasts.removed', { name: plugin.name }), variant: 'success' });
      setRemoveAllOpen(false);
      nav.push('/admin/plugins');
    } catch (error) {
      console.error('[caspian-store] Removing plugin failed:', error);
      toast({
        title: t('admin.plugins.errors.removeFailed'),
        description: pluginWriteErrorMessage(t, error),
        variant: 'destructive',
      });
      // Some installs may already be gone; re-read so the page tells the truth.
      listPluginInstalls(db, plugin.category).then(setInstalls, () => undefined);
    } finally {
      setRemovingAll(false);
    }
  };

  const headerChecked = hasInstall ? status === 'enabled' : enableOnSave;
  const pendingOrderBase = nextPluginOrder(installs ?? [], plugin.category);
  const multiple = sections.length > 1;

  return (
    <div className={className} style={{ maxWidth: PAGE_MAX_WIDTH }}>
      <BackLink />

      <header
        className="caspian-admin-page-head"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          margin: '12px 0 24px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{plugin.name}</h1>
            <Badge variant="outline">{t(`admin.plugins.filter.${plugin.category}`)}</Badge>
          </div>
          <p style={{ color: '#666', margin: '6px 0 0', fontSize: 14, lineHeight: 1.5 }}>
            {plugin.description}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: 10,
            background: '#fff',
          }}
        >
          <span style={{ fontSize: 13, color: '#444' }}>
            {hasInstall ? (
              <PluginStatusLabel status={status} />
            ) : (
              t('admin.plugins.settingsPage.enableOnSave')
            )}
          </span>
          <Switch
            checked={headerChecked}
            disabled={installs === null || !!busy[plugin.id]}
            onChange={(next) => (hasInstall ? void toggle(plugin, next) : setEnableOnSave(next))}
            ariaLabel={t('admin.plugins.enableAria', { name: plugin.name })}
          />
        </div>
      </header>

      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #fde68a',
            background: '#fffbeb',
            color: '#92400e',
            fontSize: 14,
          }}
        >
          <strong style={{ display: 'block' }}>{notice}</strong>
          {noticeReason && <span style={{ fontSize: 13 }}>{noticeReason}</span>}
        </div>
      )}

      {loadError ? (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: 13,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 2 }}>
            {t('admin.plugins.errors.loadFailed')}
          </strong>
          {loadError}
        </div>
      ) : installs === null ? (
        <Skeleton style={{ height: 320, borderRadius: 12 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map((s, i) => (
            <InstallSection
              key={s.key}
              plugin={plugin}
              install={s.install}
              initialDraft={
                s.install
                  ? draftFromInstall(s.install)
                  : draftFromDefaults(plugin, pendingOrderBase + Math.max(0, newKeys.indexOf(s.key)))
              }
              showTitle={multiple}
              isNewExtra={!s.install && hasInstall}
              enableOnCreate={enableOnSave || status === 'enabled'}
              enableOnUpdate={enableOnSave}
              countrySource={countrySource}
              index={i}
              onCreated={(install) => onCreated(s.key, install)}
              onUpdated={onUpdated}
              onRemoved={onRemoved}
              onCancel={() => setNewKeys((prev) => prev.filter((k) => k !== s.key))}
            />
          ))}

          {plugin.category === 'shipping' && hasInstall && (
            <div>
              <Button variant="outline" onClick={addAnother}>
                {t('admin.plugins.settingsPage.addAnother', { name: plugin.name })}
              </Button>
            </div>
          )}

          {hasInstall && (
            <section
              style={{
                marginTop: 12,
                padding: 20,
                border: '1px solid #fecaca',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 280px' }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {t('admin.plugins.settingsPage.removeTitle')}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
                  {t('admin.plugins.settingsPage.removeBody')}
                </p>
              </div>
              <Button variant="destructive" onClick={() => setRemoveAllOpen(true)}>
                {t('admin.plugins.settingsPage.remove')}
              </Button>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removeAllOpen}
        onOpenChange={(v) => {
          if (!v) setRemoveAllOpen(false);
        }}
        title={t('admin.plugins.settingsPage.removeConfirmTitle', { name: plugin.name })}
        description={
          mine.length > 1
            ? t('admin.plugins.settingsPage.removeConfirmMany', { count: mine.length })
            : t('admin.plugins.settingsPage.removeConfirmOne')
        }
        confirmLabel={t('admin.plugins.settingsPage.remove')}
        destructive
        loading={removingAll}
        onConfirm={removeAll}
      />
    </div>
  );
}

function InstallSection({
  plugin,
  install,
  initialDraft,
  showTitle,
  isNewExtra,
  enableOnCreate,
  enableOnUpdate,
  countrySource,
  index,
  onCreated,
  onUpdated,
  onRemoved,
  onCancel,
}: {
  plugin: CatalogPlugin;
  install: AnyPluginInstall | null;
  initialDraft: PluginInstallDraft;
  /** Several sections on the page: give each a heading and its own switch. */
  showTitle: boolean;
  /** An extra unsaved section next to saved ones (shipping "Add another"). */
  isNewExtra: boolean;
  enableOnCreate: boolean;
  /** Save also switches an existing install on (arrived via `?enable=1`). */
  enableOnUpdate: boolean;
  countrySource: readonly IsoCountry[];
  index: number;
  onCreated: (install: AnyPluginInstall) => void;
  onUpdated: (install: AnyPluginInstall) => void;
  onRemoved: (id: string) => void;
  onCancel: () => void;
}) {
  const { db } = useCaspianFirebase();
  const { toast } = useToast();
  const t = useT();
  const [draft, setDraft] = useState<PluginInstallDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const sectionId = install ? install.id : undefined;

  const save = async () => {
    setError(null);
    if (!draft.name.trim()) {
      setError(t('admin.plugins.errors.nameRequired'));
      return;
    }
    const enabled = install ? install.enabled || enableOnUpdate : enableOnCreate;
    const write = draftToWrite(plugin, draft, enabled);
    const invalid = configError(plugin, write.config);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    try {
      if (install) {
        await savePluginInstall(db, plugin.category, install.id, write);
        onUpdated({ ...install, ...write });
      } else {
        const id = await createPluginInstall(db, plugin, write);
        onCreated({ category: plugin.category, id, pluginId: plugin.id, ...write });
      }
      notifyPluginInstallsChanged();
      toast({
        title: t(
          enabled && !(install?.enabled ?? false)
            ? 'admin.plugins.toasts.savedEnabled'
            : 'admin.plugins.toasts.saved',
          { name: write.name },
        ),
        variant: 'success',
      });
    } catch (err) {
      console.error('[caspian-store] Saving plugin settings failed:', err);
      const message = pluginWriteErrorMessage(t, err);
      setError(message);
      toast({ title: t('admin.plugins.errors.saveFailed'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleOwn = async (next: boolean) => {
    if (!install) return;
    if (next) {
      const invalid = configError(plugin, install.config);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setToggling(true);
    onUpdated({ ...install, enabled: next });
    try {
      await setPluginInstallEnabled(db, plugin.category, install.id, next);
      notifyPluginInstallsChanged();
    } catch (err) {
      console.error('[caspian-store] Toggling plugin install failed:', err);
      onUpdated({ ...install, enabled: !next });
      toast({
        title: t(next ? 'admin.plugins.errors.enableFailed' : 'admin.plugins.errors.disableFailed', {
          name: install.name,
        }),
        description: pluginWriteErrorMessage(t, err),
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  const remove = async () => {
    if (!install) return;
    setRemoving(true);
    try {
      await deletePluginInstall(db, plugin.category, install.id);
      notifyPluginInstallsChanged();
      toast({ title: t('admin.plugins.toasts.removed', { name: install.name }), variant: 'success' });
      setRemoveOpen(false);
      onRemoved(install.id);
    } catch (err) {
      console.error('[caspian-store] Removing plugin install failed:', err);
      toast({
        title: t('admin.plugins.errors.removeFailed'),
        description: pluginWriteErrorMessage(t, err),
        variant: 'destructive',
      });
    } finally {
      setRemoving(false);
    }
  };

  const title =
    install?.name ||
    t(plugin.category === 'shipping' ? 'admin.plugins.settingsPage.newMethod' : 'admin.plugins.settingsPage.newSetup');

  return (
    <section
      id={sectionId}
      tabIndex={sectionId ? -1 : undefined}
      aria-label={showTitle ? title : plugin.name}
      style={{
        border: '1px solid rgba(0,0,0,0.09)',
        borderRadius: 12,
        background: '#fff',
        padding: 20,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        outline: 'none',
        scrollMarginTop: 80,
      }}
    >
      {showTitle && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {title}
            {!install && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: '#888' }}>
                {t('admin.plugins.settingsPage.unsaved')}
              </span>
            )}
          </h2>
          {install && (
            <Switch
              checked={install.enabled}
              disabled={toggling}
              onChange={(next) => void toggleOwn(next)}
              ariaLabel={t('admin.plugins.enableAria', { name: install.name || `#${index + 1}` })}
            />
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <PluginInstallForm
          plugin={plugin}
          draft={draft}
          onChange={setDraft}
          countrySource={countrySource}
        />

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: '10px 12px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
            flexWrap: 'wrap',
          }}
        >
          {install && showTitle && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRemoveOpen(true)}
              style={{ color: '#b91c1c', marginRight: 'auto' }}
            >
              {t(
                plugin.category === 'shipping'
                  ? 'admin.plugins.settingsPage.removeMethod'
                  : 'admin.plugins.settingsPage.removeSetup',
              )}
            </Button>
          )}
          {isNewExtra && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </form>

      {install && (
        <ConfirmDialog
          open={removeOpen}
          onOpenChange={(v) => {
            if (!v) setRemoveOpen(false);
          }}
          title={t('admin.confirm.removeTitle')}
          description={t('admin.plugins.settingsPage.removeOneConfirm', { name: install.name })}
          confirmLabel={t('admin.confirm.remove')}
          destructive
          loading={removing}
          onConfirm={remove}
        />
      )}
    </section>
  );
}
