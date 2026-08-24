'use client';

import { useState } from 'react';
import { useCaspianNavigation } from '../../../provider/caspian-store-provider';
import { useT } from '../../../i18n/locale-context';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { LocalPeoplePanel } from './local-people-panel';
import { LocalSalesPanel } from './local-sales-panel';
import { LocalShopPanel } from './local-shop-panel';
import { LocalBackupPanel } from './local-backup-panel';

export interface PosLocalAdminPageProps {
  className?: string;
}

type Section = 'products' | 'sales' | 'people' | 'shop' | 'backup';

interface NavItem {
  value: Section;
  labelKey: string;
}

const NAV: NavItem[] = [
  { value: 'sales', labelKey: 'pos.admin.section.sales' },
  { value: 'people', labelKey: 'pos.admin.section.people' },
  { value: 'shop', labelKey: 'pos.admin.section.shop' },
  { value: 'backup', labelKey: 'pos.admin.section.backup' },
];

/**
 * The back office of a standalone till, at `/pos/admin`.
 *
 * Replaces the old tab bar with a collapsible sidebar so the layout scales on
 * smaller screens and matches the new settings page. Items management has moved
 * to the dedicated Store page; this screen keeps sales, people, shop settings
 * and backups.
 */
export function PosLocalAdminPage({ className }: PosLocalAdminPageProps) {
  const t = useT();
  const { user } = usePosLocalSession();
  const { canAccess } = usePosRoles();
  const { searchParams, replace } = useCaspianNavigation();
  const [collapsed, setCollapsed] = useState(false);

  const sectionParam = searchParams?.get('section') as Section | null;
  const section: Section = NAV.some((n) => n.value === sectionParam) ? sectionParam! : 'sales';

  const setSection = (value: Section) => replace(`/pos/admin?section=${value}`);

  if (!canAccess(user?.role, 'admin')) {
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('pos.admin.deniedTitle')}</h1>
        <p style={{ color: '#666', marginTop: 8 }}>{t('pos.admin.deniedBody')}</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', gap: 24, padding: 24, maxWidth: 960, margin: '0 auto', alignItems: 'flex-start' }}
    >
      <aside
        style={{
          width: collapsed ? 44 : 180,
          flexShrink: 0,
          position: 'sticky',
          top: 16,
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 'var(--caspian-radius, 12px)',
          padding: 8,
          background: 'var(--caspian-background, #fff)',
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('common.expand') : t('common.collapse')}
          style={toggle}
        >
          {collapsed ? '›' : '‹'}
        </button>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {NAV.map((item) => {
            const active = section === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setSection(item.value)}
                style={{
                  ...navLink,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? 'var(--caspian-primary, #1a73e8)' : 'transparent',
                  color: active ? 'var(--caspian-primary-foreground, #fff)' : 'inherit',
                }}
                title={t(item.labelKey)}
              >
                {collapsed ? t(item.labelKey)[0].toUpperCase() : t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('pos.admin.title')}</h1>
          <p style={{ color: '#666', marginTop: 4, fontSize: 14 }}>{t('pos.admin.subtitle')}</p>
        </header>

        {section === 'sales' && <LocalSalesPanel />}
        {section === 'people' && <LocalPeoplePanel />}
        {section === 'shop' && <LocalShopPanel />}
        {section === 'backup' && <LocalBackupPanel />}
      </div>
    </div>
  );
}

const toggle: React.CSSProperties = {
  width: '100%',
  padding: '6px 0',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  color: '#666',
  borderRadius: 'calc(var(--caspian-radius, 8px) - 4px)',
};

const navLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  color: 'inherit',
  borderRadius: 'calc(var(--caspian-radius, 8px) - 4px)',
  textAlign: 'left',
  width: '100%',
};
