'use client';

import { useEffect, type ReactNode } from 'react';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';
import { SETTINGS_SUB_NAV } from './admin-shell';
import { AdminSiteSettingsPage } from './admin-site-settings-page';
import { AdminSettingsTaxonomiesPage } from './admin-settings-taxonomies-page';
import { AdminEmailsPage } from './admin-emails-page';
import { AdminLanguagesPage } from './admin-languages-page';
import { AdminShippingOptionsPage } from './admin-shipping-options-page';
import { AdminSettingsImportExportPage } from './admin-settings-import-export-page';

export interface AdminSettingsShellProps {
  className?: string;
}

/**
 * Settings page with an internal sub-sidebar.
 *
 * Reads the current pathname from the framework-agnostic navigation adapter
 * and renders the matching sub-page. Landing on `/admin/settings` (no slug)
 * redirects to `/admin/settings/general` so the URL always names the active
 * panel. Plugin panels (shipping, payments, email providers) moved to
 * AdminPluginsShell in v5.0.0 (mod1197); legacy URLs still redirect there
 * for one release so existing bookmarks don't 404.
 */
export function AdminSettingsShell({ className }: AdminSettingsShellProps) {
  const nav = useCaspianNavigation();
  const Link = useCaspianLink();
  const t = useT();

  const raw = deriveRawSlug(nav.pathname);

  useEffect(() => {
    if (raw === null) {
      nav.replace('/admin/settings/general');
      return;
    }
    if (raw.kind === 'legacyPlugin') {
      nav.replace(`/admin/plugins/${raw.slug}`);
      return;
    }
    if (raw.kind === 'legacyAppearance') {
      nav.replace('/admin/appearance');
    }
  }, [raw, nav]);

  if (raw === null) return null;
  if (raw.kind === 'legacyPlugin') return null;
  if (raw.kind === 'legacyAppearance') return null;

  const slug = raw.slug;

  return (
    <div className={className}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('admin.settings.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.settings.subtitle')}</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <aside style={{ position: 'sticky', top: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#999',
              padding: '0 12px 8px',
            }}
          >
            {t('admin.settings.categories')}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            {SETTINGS_SUB_NAV.map((item) => {
              const active = nav.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('caspian-admin-nav-item', active && 'is-active')}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                      borderRadius: 8,
                      color: active ? '#111' : '#444',
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      textDecoration: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ display: 'flex', flexShrink: 0, color: active ? '#111' : '#888' }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div>
          <SettingsPanel slug={slug} />
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ slug }: { slug: SettingsSlug }): ReactNode {
  switch (slug) {
    case 'general':
      return <AdminSiteSettingsPage />;
    case 'taxonomies':
      return <AdminSettingsTaxonomiesPage />;
    case 'shipping-options':
      return <AdminShippingOptionsPage />;
    case 'emails':
      return <AdminEmailsPage />;
    case 'languages':
      return <AdminLanguagesPage />;
    case 'import-export':
      return <AdminSettingsImportExportPage />;
  }
}

type SettingsSlug =
  | 'general'
  | 'taxonomies'
  | 'shipping-options'
  | 'emails'
  | 'languages'
  | 'import-export';
type LegacyPluginSlug = 'shipping' | 'payments' | 'email-providers';

const KNOWN_SLUGS: readonly SettingsSlug[] = [
  'general',
  'taxonomies',
  'shipping-options',
  'emails',
  'languages',
  'import-export',
];
const LEGACY_PLUGIN_SLUGS: readonly LegacyPluginSlug[] = [
  'shipping',
  'payments',
  'email-providers',
];

type RawSlug =
  | { kind: 'settings'; slug: SettingsSlug }
  | { kind: 'legacyPlugin'; slug: LegacyPluginSlug }
  | { kind: 'legacyAppearance' };

function deriveRawSlug(pathname: string): RawSlug | null {
  const match = pathname.match(/^\/admin\/settings\/?(.*)$/);
  if (!match) return { kind: 'settings', slug: 'general' };
  const rest = match[1].split('/')[0];
  if (!rest) return null;
  // Reverted to top-level /admin/appearance in v8.2.0. Redirect for one release.
  if (rest === 'appearance') return { kind: 'legacyAppearance' };
  if ((LEGACY_PLUGIN_SLUGS as readonly string[]).includes(rest)) {
    return { kind: 'legacyPlugin', slug: rest as LegacyPluginSlug };
  }
  if ((KNOWN_SLUGS as readonly string[]).includes(rest)) {
    return { kind: 'settings', slug: rest as SettingsSlug };
  }
  return { kind: 'settings', slug: 'general' };
}
