'use client';

import { useMemo, useState } from 'react';
import { useCaspianFirebase, useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { SHIPPING_PLUGIN_CATALOG } from '../shipping/catalog';
import { PAYMENT_PLUGIN_CATALOG } from '../payments/catalog';
import { EMAIL_PLUGIN_CATALOG } from '../email/catalog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/misc';
import {
  useEnabledPluginInstalls,
  type EnabledPluginCategory,
} from './use-enabled-plugin-installs';

type StatusFilter = 'all' | 'installed' | 'available';
type CategoryFilter = 'all' | EnabledPluginCategory;

type PluginEntry =
  | {
      kind: 'install';
      category: EnabledPluginCategory;
      pluginId: string;
      installId: string;
      name: string;
      description: string;
    }
  | {
      kind: 'catalog';
      category: EnabledPluginCategory;
      pluginId: string;
      name: string;
      description: string;
    };

export interface AdminPluginsPageProps {
  className?: string;
}

/**
 * Unified plugin browser. One card grid covers both enabled installs and
 * catalog entries; status becomes a badge on the card, not a section
 * boundary. Filters are two dropdowns (Status × Category) sitting next
 * to the search input.
 *
 * Introduced v7.1.0 as split Installed-table + Available-grid. Rebuilt
 * in v7.3.1 into a single grid with dropdown filters per user feedback:
 * merchants searching for "stripe" don't care whether it's shipped
 * out-of-the-box or installed — the card is the same shape either way.
 */
export function AdminPluginsPage({ className }: AdminPluginsPageProps) {
  useCaspianFirebase();
  const Link = useCaspianLink();
  const nav = useCaspianNavigation();
  const t = useT();
  const { installs, loading } = useEnabledPluginInstalls();

  const [search, setSearch] = useState(() => nav.searchParams?.get('q') ?? '');
  const [status, setStatus] = useState<StatusFilter>(() => {
    const raw = nav.searchParams?.get('status') ?? '';
    return raw === 'installed' || raw === 'available' ? raw : 'all';
  });
  const [category, setCategory] = useState<CategoryFilter>(() => {
    const raw = nav.searchParams?.get('filter') ?? '';
    return raw === 'shipping' || raw === 'payment' || raw === 'email' ? raw : 'all';
  });

  const descriptionFor = (cat: EnabledPluginCategory, pluginId: string): string => {
    const catalog =
      cat === 'shipping'
        ? SHIPPING_PLUGIN_CATALOG
        : cat === 'payment'
          ? PAYMENT_PLUGIN_CATALOG
          : EMAIL_PLUGIN_CATALOG;
    return (catalog as Record<string, { description?: string }>)[pluginId]?.description ?? '';
  };

  const entries = useMemo<PluginEntry[]>(() => {
    const out: PluginEntry[] = [];
    // Track which `${category}:${pluginId}` pairs already have an install so
    // we can suppress the catalog card for the same plugin. Without this the
    // grid renders two cards per installed plugin — one "Configure" (from
    // the install) and one "Install" (from the static catalog) — which made
    // the page look like the install never happened. Re-installing a second
    // instance still works via /admin/plugins/manage/<category>.
    const installedKeys = new Set<string>();
    for (const x of installs) {
      installedKeys.add(`${x.category}:${x.pluginId}`);
      out.push({
        kind: 'install',
        category: x.category,
        pluginId: x.pluginId,
        installId: x.installId,
        name: x.name,
        description: descriptionFor(x.category, x.pluginId),
      });
    }
    for (const [cat, catalog] of [
      ['shipping', SHIPPING_PLUGIN_CATALOG],
      ['payment', PAYMENT_PLUGIN_CATALOG],
      ['email', EMAIL_PLUGIN_CATALOG],
    ] as const) {
      for (const entry of Object.values(catalog)) {
        if (installedKeys.has(`${cat}:${entry.id}`)) continue;
        out.push({
          kind: 'catalog',
          category: cat,
          pluginId: entry.id,
          name: entry.name,
          description: entry.description ?? '',
        });
      }
    }
    const categoryOrder: Record<EnabledPluginCategory, number> = {
      shipping: 0,
      payment: 1,
      email: 2,
    };
    out.sort((a, b) => {
      if (a.category !== b.category) return categoryOrder[a.category] - categoryOrder[b.category];
      if (a.kind !== b.kind) return a.kind === 'install' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return out;
    // descriptionFor is pure wrt the catalogs it references; catalogs are
    // module-scope constants so deps collapse to `installs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installs]);

  const normalized = search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      entries.filter((x) => {
        if (status === 'installed' && x.kind !== 'install') return false;
        if (status === 'available' && x.kind !== 'catalog') return false;
        if (category !== 'all' && x.category !== category) return false;
        if (!normalized) return true;
        return (
          x.name.toLowerCase().includes(normalized) ||
          x.description.toLowerCase().includes(normalized) ||
          x.pluginId.toLowerCase().includes(normalized)
        );
      }),
    [entries, status, category, normalized],
  );

  const manageHrefFor = (cat: EnabledPluginCategory): string => {
    switch (cat) {
      case 'shipping':
        return '/admin/plugins/manage/shipping';
      case 'payment':
        return '/admin/plugins/manage/payments';
      case 'email':
        return '/admin/plugins/manage/email-providers';
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('admin.plugins.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.plugins.subtitle')}</p>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.plugins.search.placeholder')}
          style={{ flex: '1 1 280px', maxWidth: 420 }}
          aria-label={t('admin.plugins.search.placeholder')}
        />
        <Select
          aria-label={t('admin.plugins.status.label')}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          options={[
            { value: 'all', label: t('admin.plugins.status.all') },
            { value: 'installed', label: t('admin.plugins.status.installed') },
            { value: 'available', label: t('admin.plugins.status.available') },
          ]}
        />
        <Select
          aria-label={t('admin.plugins.filter.label')}
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryFilter)}
          options={[
            { value: 'all', label: t('admin.plugins.filter.all') },
            { value: 'shipping', label: t('admin.plugins.filter.shipping') },
            { value: 'payment', label: t('admin.plugins.filter.payment') },
            { value: 'email', label: t('admin.plugins.filter.email') },
          ]}
        />
      </div>

      {loading ? (
        <div style={{ color: '#999', padding: 16 }}>{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#888',
            border: '1px dashed #ddd',
            borderRadius: 'var(--caspian-radius, 8px)',
            background: '#fafafa',
          }}
        >
          {t('admin.plugins.empty.all')}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.map((entry) => (
            <PluginCard
              key={
                entry.kind === 'install'
                  ? `install-${entry.installId}`
                  : `catalog-${entry.category}-${entry.pluginId}`
              }
              entry={entry}
              Link={Link}
              t={t}
              manageHrefFor={manageHrefFor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginCard({
  entry,
  Link,
  t,
  manageHrefFor,
}: {
  entry: PluginEntry;
  Link: ReturnType<typeof useCaspianLink>;
  t: ReturnType<typeof useT>;
  manageHrefFor: (cat: EnabledPluginCategory) => string;
}) {
  const href =
    entry.kind === 'install'
      ? `/admin/plugins/${entry.pluginId}/${entry.installId}`
      : manageHrefFor(entry.category);
  const actionLabel =
    entry.kind === 'install' ? t('admin.plugins.configure') : t('admin.plugins.install');
  return (
    <div
      style={{
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        padding: 14,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge variant="outline">
          {t(`admin.plugins.filter.${entry.category}`)}
        </Badge>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{entry.name}</span>
        {entry.kind === 'install' && (
          <Badge>{t('admin.plugins.badge.installed')}</Badge>
        )}
      </div>
      {entry.kind === 'install' && (
        <div style={{ color: '#888', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
          {entry.pluginId}
        </div>
      )}
      <p style={{ color: '#666', fontSize: 13, margin: 0, minHeight: 36 }}>
        {entry.description || '—'}
      </p>
      <Link href={href}>
        <Button size="sm" variant="outline" style={{ alignSelf: 'flex-start' }}>
          {actionLabel}
        </Button>
      </Link>
    </div>
  );
}
