'use client';

import { useEffect, type ComponentType, type ReactNode } from 'react';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';
import { BookmarkIcon } from '../ui/icons';
import { AdminProductBrandsPage } from './admin-product-brands-page';

const ICON_SIZE = 16;

interface TaxonomyEntry {
  slug: string;
  label: string;
  icon: ReactNode;
  Component: ComponentType<{ className?: string }>;
}

/**
 * Catalog of taxonomy types managed under /admin/taxonomies. Mirrors the
 * SETTINGS_SUB_NAV pattern but is catalog-driven — each entry renders its own
 * Component, so adding a future taxonomy is a one-line addition here plus
 * building its CRUD page. Brands is the first taxonomy to live here; it
 * previously sat as a direct Catalog sidebar child.
 */
export const TAXONOMY_CATALOG: TaxonomyEntry[] = [
  { slug: 'brands', label: 'Brands', icon: <BookmarkIcon size={ICON_SIZE} />, Component: AdminProductBrandsPage },
];

const DEFAULT_SLUG = TAXONOMY_CATALOG[0].slug;

export interface AdminTaxonomiesShellProps {
  className?: string;
}

/**
 * Taxonomies page with an internal sub-sidebar, modeled on AdminSettingsShell.
 * Reads the active taxonomy slug from the framework-agnostic navigation adapter;
 * landing on `/admin/taxonomies` (or an unknown slug) redirects to the first
 * taxonomy so the URL always names the active panel.
 */
export function AdminTaxonomiesShell({ className }: AdminTaxonomiesShellProps) {
  const nav = useCaspianNavigation();
  const Link = useCaspianLink();
  const t = useT();

  const slug = deriveSlug(nav.pathname);

  useEffect(() => {
    if (slug === null) {
      nav.replace(`/admin/taxonomies/${DEFAULT_SLUG}`);
    }
  }, [slug, nav]);

  if (slug === null) return null;

  const active = TAXONOMY_CATALOG.find((tax) => tax.slug === slug) ?? TAXONOMY_CATALOG[0];
  const Panel = active.Component;

  return (
    <div className={className}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('admin.taxonomies.title')}</h1>
        <p style={{ color: '#666', marginTop: 4 }}>{t('admin.taxonomies.subtitle')}</p>
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
            {t('admin.taxonomies.types')}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            {TAXONOMY_CATALOG.map((item) => {
              const isActive = item.slug === slug;
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

        <div>
          <Panel />
        </div>
      </div>
    </div>
  );
}

/**
 * Returns the active taxonomy slug, or null when the URL is bare
 * `/admin/taxonomies` (the caller then redirects to the default). Unknown
 * slugs fall back to the default rather than rendering nothing.
 */
function deriveSlug(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/taxonomies\/?(.*)$/);
  if (!match) return DEFAULT_SLUG;
  const rest = match[1].split('/')[0];
  if (!rest) return null;
  if (TAXONOMY_CATALOG.some((tax) => tax.slug === rest)) return rest;
  return DEFAULT_SLUG;
}
