'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCaspianFirebase, useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge, Skeleton } from '../ui/misc';
import { Switch } from '../ui/switch';
import {
  PLUGIN_CATEGORIES,
  listCatalogPlugins,
  listPluginInstalls,
  pluginSettingsHref,
  pluginStatus,
  pluginWriteErrorMessage,
  type AnyPluginInstall,
  type CatalogPlugin,
  type PluginCategory,
  type PluginStatus,
} from './admin-plugin-registry';
import { usePluginEnableToggle } from './use-plugin-enable-toggle';

type StatusFilter = 'all' | 'enabled' | 'disabled';
type CategoryFilter = 'all' | PluginCategory;

export interface AdminPluginsPageProps {
  className?: string;
  /**
   * Show only this category and hide the category filter. Used by the
   * `AdminShippingPluginsPage` / `AdminPaymentPluginsPage` /
   * `AdminEmailPluginsPage` wrappers.
   */
  category?: PluginCategory;
}

function parseCategory(raw: string | null | undefined): CategoryFilter {
  return raw === 'shipping' || raw === 'payment' || raw === 'email' ? raw : 'all';
}

function parseStatus(raw: string | null | undefined): StatusFilter {
  return raw === 'enabled' || raw === 'disabled' ? raw : 'all';
}

/**
 * The one Plugins screen: a card per catalog plugin (not per install), each
 * with an Enable switch and a link to that plugin's own settings page at
 * `/admin/plugins/<pluginId>`. Switching a plugin on creates its install from
 * the catalog defaults when those are valid; otherwise it opens the settings
 * page with `?enable=1` so the owner fills in what is missing first.
 */
export function AdminPluginsPage({ className, category: lockedCategory }: AdminPluginsPageProps) {
  const { db } = useCaspianFirebase();
  const nav = useCaspianNavigation();
  const t = useT();

  const [installs, setInstalls] = useState<AnyPluginInstall[] | null>(null);
  const [failedCategories, setFailedCategories] = useState<PluginCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const urlFilter = nav.searchParams?.get('filter');
  const [search, setSearch] = useState(() => nav.searchParams?.get('q') ?? '');
  const [status, setStatus] = useState<StatusFilter>(() =>
    parseStatus(nav.searchParams?.get('status')),
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() =>
    parseCategory(urlFilter),
  );
  // The page stays mounted when only the query string changes (a sidebar
  // click from `?filter=shipping` back to bare `/admin/plugins`).
  useEffect(() => {
    setCategoryFilter(parseCategory(urlFilter));
  }, [urlFilter]);
  const category: CategoryFilter = lockedCategory ?? categoryFilter;

  useEffect(() => {
    let alive = true;
    Promise.allSettled(PLUGIN_CATEGORIES.map((c) => listPluginInstalls(db, c))).then((results) => {
      if (!alive) return;
      const loaded: AnyPluginInstall[] = [];
      const failed: PluginCategory[] = [];
      let firstError: unknown = null;
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') loaded.push(...r.value);
        else {
          failed.push(PLUGIN_CATEGORIES[i]);
          firstError ??= r.reason;
          console.error('[caspian-store] Failed to list plugin installs:', r.reason);
        }
      });
      setInstalls(loaded);
      setFailedCategories(failed);
      setLoadError(failed.length ? pluginWriteErrorMessage(t, firstError) : null);
    });
    return () => {
      alive = false;
    };
    // Reloading on a locale switch is not needed; only the db matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const { toggle, busy } = usePluginEnableToggle({
    installs: installs ?? [],
    setInstalls,
    onNeedsSettings: (plugin) => nav.push(pluginSettingsHref(plugin.id, { enable: true })),
  });

  const cards = useMemo(() => {
    const byPlugin = new Map<string, AnyPluginInstall[]>();
    for (const x of installs ?? []) {
      const list = byPlugin.get(x.pluginId) ?? [];
      list.push(x);
      byPlugin.set(x.pluginId, list);
    }
    return listCatalogPlugins().map((plugin) => {
      const mine = byPlugin.get(plugin.id) ?? [];
      return { plugin, installs: mine, status: pluginStatus(plugin, mine) };
    });
  }, [installs]);

  const normalized = search.trim().toLowerCase();
  const visible = cards.filter(({ plugin, status: s }) => {
    if (category !== 'all' && plugin.category !== category) return false;
    if (status === 'enabled' && s !== 'enabled') return false;
    if (status === 'disabled' && s === 'enabled') return false;
    if (!normalized) return true;
    return (
      plugin.name.toLowerCase().includes(normalized) ||
      plugin.description.toLowerCase().includes(normalized) ||
      plugin.id.toLowerCase().includes(normalized)
    );
  });

  const groups = PLUGIN_CATEGORIES.map((c) => ({
    category: c,
    cards: visible.filter((x) => x.plugin.category === c),
  })).filter((g) => g.cards.length > 0);

  const renderGrid = (list: typeof visible) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}
    >
      {list.map(({ plugin, installs: mine, status: s }) => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          status={s}
          installCount={mine.length}
          // A category whose installs failed to load can't be toggled safely:
          // "no install" might be wrong and switching on would duplicate it.
          busy={!!busy[plugin.id] || failedCategories.includes(plugin.category)}
          onToggle={(next) => void toggle(plugin, next)}
        />
      ))}
    </div>
  );

  return (
    <div className={className}>
      <header className="caspian-admin-page-head" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {lockedCategory ? t(`admin.plugins.filter.${lockedCategory}`) : t('admin.plugins.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 4, marginBottom: 0 }}>
          {t('admin.plugins.subtitle')}
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.plugins.search.placeholder')}
          style={{ flex: '1 1 260px', maxWidth: 420 }}
          aria-label={t('admin.plugins.search.placeholder')}
        />
        {!lockedCategory && (
          <Select
            aria-label={t('admin.plugins.filter.label')}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            options={[
              { value: 'all', label: t('admin.plugins.filter.all') },
              { value: 'shipping', label: t('admin.plugins.filter.shipping') },
              { value: 'payment', label: t('admin.plugins.filter.payment') },
              { value: 'email', label: t('admin.plugins.filter.email') },
            ]}
          />
        )}
        <Select
          aria-label={t('admin.plugins.status.label')}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          options={[
            { value: 'all', label: t('admin.plugins.status.all') },
            { value: 'enabled', label: t('admin.plugins.status.enabled') },
            { value: 'disabled', label: t('admin.plugins.status.disabled') },
          ]}
        />
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
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
      )}

      {installs === null ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 176, borderRadius: 12 }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#888',
            border: '1px dashed #ddd',
            borderRadius: 12,
            background: '#fafafa',
          }}
        >
          {t('admin.plugins.empty.all')}
        </div>
      ) : category !== 'all' ? (
        renderGrid(visible)
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {groups.map((g) => (
            <section key={g.category} aria-labelledby={`caspian-plugins-${g.category}`}>
              <h2
                id={`caspian-plugins-${g.category}`}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#666',
                  margin: '0 0 12px',
                }}
              >
                {t(`admin.plugins.filter.${g.category}`)}
              </h2>
              {renderGrid(g.cards)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_COLOR: Record<PluginStatus, string> = {
  enabled: '#16a34a',
  disabled: '#9ca3af',
  'needs-setup': '#d97706',
};

const PLUGIN_STATUS_KEY: Record<PluginStatus, string> = {
  enabled: 'admin.plugins.status.enabled',
  disabled: 'admin.plugins.status.disabled',
  'needs-setup': 'admin.plugins.status.needsSetup',
};

export function PluginStatusLabel({ status }: { status: PluginStatus }) {
  const t = useT();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: STATUS_COLOR[status],
          flexShrink: 0,
        }}
      />
      {t(PLUGIN_STATUS_KEY[status])}
    </span>
  );
}

function PluginCard({
  plugin,
  status,
  installCount,
  busy,
  onToggle,
}: {
  plugin: CatalogPlugin;
  status: PluginStatus;
  installCount: number;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  const Link = useCaspianLink();
  const t = useT();
  const href = pluginSettingsHref(plugin.id);
  return (
    <article
      style={{
        border: '1px solid rgba(0,0,0,0.09)',
        borderRadius: 12,
        padding: 18,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Badge variant="outline">{t(`admin.plugins.filter.${plugin.category}`)}</Badge>
        <Switch
          checked={status === 'enabled'}
          disabled={busy}
          onChange={onToggle}
          ariaLabel={t('admin.plugins.enableAria', { name: plugin.name })}
        />
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
        <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
          {plugin.name}
        </Link>
      </h3>
      <p
        style={{
          margin: 0,
          color: '#666',
          fontSize: 13,
          lineHeight: 1.5,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {plugin.description}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 12,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ fontSize: 13, color: '#444' }}>
          <PluginStatusLabel status={status} />
          {installCount > 1 && (
            <span style={{ color: '#888' }}>
              {' · '}
              {t(
                plugin.category === 'shipping'
                  ? 'admin.plugins.card.countShipping'
                  : 'admin.plugins.card.count',
                { count: installCount },
              )}
            </span>
          )}
        </span>
        <Link href={href} aria-label={t('admin.plugins.settingsAria', { name: plugin.name })}>
          <Button size="sm" variant="outline" tabIndex={-1}>
            {t('admin.plugins.settings')}
          </Button>
        </Link>
      </div>
    </article>
  );
}
