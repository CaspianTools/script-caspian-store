'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  useCaspianFirebase,
  useCaspianLink,
  useCaspianNavigation,
} from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';
import { getSiteSettings } from '../services/site-settings-service';
import { COMMON_TAXONOMIES, enabledTaxonomyDefs } from '../taxonomies/catalog';
import { Skeleton } from '../ui/misc';
import { AdminProductBrandsPage } from './admin-product-brands-page';
import { AdminTaxonomyTermsPage } from './admin-taxonomy-terms-page';

/**
 * The full taxonomy catalog. Re-exported through the barrels for back-compat
 * (was a one-entry `{ slug, label, icon, Component }[]` in v9.12.0; now the
 * grouped catalog of all common taxonomies). The Settings page and onboarding
 * step also consume `COMMON_TAXONOMIES` directly from `src/taxonomies`.
 */
export const TAXONOMY_CATALOG = COMMON_TAXONOMIES;

export interface AdminTaxonomiesShellProps {
  className?: string;
}

interface VisibleEntry {
  slug: string;
  label: string;
  icon: ReactNode;
  render: () => ReactNode;
}

/**
 * Taxonomies page with an internal sub-sidebar, modeled on AdminSettingsShell.
 * Only the taxonomies the store has ENABLED (Settings → Taxonomies / onboarding)
 * appear in the sidebar — no empty pages for disabled types. The active slug is
 * read from the framework-agnostic navigation adapter; a bare or unknown URL
 * canonicalizes to the first enabled taxonomy. Brands renders its bespoke page;
 * generic taxonomies render the shared term CRUD page.
 */
export function AdminTaxonomiesShell({ className }: AdminTaxonomiesShellProps) {
  const nav = useCaspianNavigation();
  const Link = useCaspianLink();
  const { db } = useCaspianFirebase();
  const t = useT();

  const [state, setState] = useState<{ loaded: boolean; enabled: string[] | undefined }>({
    loaded: false,
    enabled: undefined,
  });

  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => alive && setState({ loaded: true, enabled: s?.enabledTaxonomies }))
      .catch(() => alive && setState({ loaded: true, enabled: undefined }));
    return () => {
      alive = false;
    };
  }, [db]);

  const visible: VisibleEntry[] = state.loaded
    ? enabledTaxonomyDefs(state.enabled).map((def) => ({
        slug: def.id,
        label: t(def.labelKey),
        icon: def.icon,
        render:
          def.kind === 'brands'
            ? () => <AdminProductBrandsPage />
            : () => <AdminTaxonomyTermsPage type={def.id} />,
      }))
    : [];
  const validSlugs = visible.map((v) => v.slug);
  const rest = parseRest(nav.pathname);
  const activeSlug = rest && validSlugs.includes(rest) ? rest : (validSlugs[0] ?? null);

  useEffect(() => {
    if (!state.loaded || validSlugs.length === 0) return;
    if (activeSlug && rest !== activeSlug) {
      nav.replace(`/admin/taxonomies/${activeSlug}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loaded, rest, activeSlug, validSlugs.length]);

  if (!state.loaded) {
    return (
      <div className={className}>
        <Skeleton style={{ height: 200 }} />
      </div>
    );
  }

  const header = (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.taxonomies.title')}</h1>
      <p style={{ color: '#666', marginTop: 4 }}>{t('admin.taxonomies.subtitle')}</p>
    </header>
  );

  if (visible.length === 0) {
    return (
      <div className={className}>
        {header}
        <div
          style={{
            border: '1px solid #e8eaed',
            borderRadius: 10,
            padding: 32,
            textAlign: 'center',
            color: '#666',
          }}
        >
          <p style={{ margin: '0 0 12px' }}>{t('admin.taxonomies.noneEnabled')}</p>
          <Link href="/admin/settings/taxonomies">
            <span style={{ color: 'var(--caspian-primary, #111)', fontWeight: 600 }}>
              {t('admin.taxonomies.manageLink')}
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const active = visible.find((v) => v.slug === activeSlug) ?? visible[0];

  return (
    <div className={className}>
      {header}

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
            {t('admin.taxonomies.types')}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            {visible.map((item) => {
              const isActive = item.slug === active.slug;
              return (
                <Link
                  key={item.slug}
                  href={`/admin/taxonomies/${item.slug}`}
                  className={cn('caspian-admin-nav-item', isActive && 'is-active')}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                      borderRadius: 8,
                      color: isActive ? '#111' : '#444',
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      textDecoration: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div>{active.render()}</div>
      </div>
    </div>
  );
}

/** Extract the `<slug>` from `/admin/taxonomies/<slug>` (empty string when bare). */
function parseRest(pathname: string): string {
  const match = pathname.match(/^\/admin\/taxonomies\/?(.*)$/);
  if (!match) return '';
  return match[1].split('/')[0];
}
