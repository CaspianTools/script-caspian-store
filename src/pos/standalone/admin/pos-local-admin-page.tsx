'use client';

import { useT } from '../../../i18n/locale-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { usePosLocalSession } from '../local-session-context';
import { canAccess } from '../types';
import { LocalProductsPanel } from './local-products-panel';
import { LocalPeoplePanel } from './local-people-panel';
import { LocalSalesPanel } from './local-sales-panel';
import { LocalShopPanel } from './local-shop-panel';
import { LocalBackupPanel } from './local-backup-panel';

export interface PosLocalAdminPageProps {
  className?: string;
}

/**
 * The back office of a standalone till, at `/pos/admin`.
 *
 * Deliberately not the cloud `/admin`. That panel is built on Firestore
 * services that take a `Firestore` as their first argument and has nothing to
 * read here; reusing its screens would mean threading a null database through
 * every one of them to serve a mode they were never written for. These five
 * panels are the subset a shop with no website actually needs.
 */
export function PosLocalAdminPage({ className }: PosLocalAdminPageProps) {
  const t = useT();
  const { user } = usePosLocalSession();

  // The register nav only shows this link to someone who can open it, but the
  // URL is typeable and a cashier who guesses it must still be refused.
  if (!canAccess(user?.role, 'admin')) {
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {t('pos.admin.deniedTitle')}
        </h1>
        <p style={{ color: '#666', marginTop: 8 }}>{t('pos.admin.deniedBody')}</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('pos.admin.title')}</h1>
        <p style={{ color: '#666', marginTop: 4, fontSize: 14 }}>{t('pos.admin.subtitle')}</p>
      </header>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t('pos.admin.tab.products')}</TabsTrigger>
          <TabsTrigger value="sales">{t('pos.admin.tab.sales')}</TabsTrigger>
          <TabsTrigger value="people">{t('pos.admin.tab.people')}</TabsTrigger>
          <TabsTrigger value="shop">{t('pos.admin.tab.shop')}</TabsTrigger>
          <TabsTrigger value="backup">{t('pos.admin.tab.backup')}</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <LocalProductsPanel />
        </TabsContent>
        <TabsContent value="sales">
          <LocalSalesPanel />
        </TabsContent>
        <TabsContent value="people">
          <LocalPeoplePanel />
        </TabsContent>
        <TabsContent value="shop">
          <LocalShopPanel />
        </TabsContent>
        <TabsContent value="backup">
          <LocalBackupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
