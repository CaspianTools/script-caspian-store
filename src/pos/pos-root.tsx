'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useAuth } from '../context/auth-context';
import { useT } from '../i18n/locale-context';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { usePosLicense } from './license/use-pos-license';
import { PosLicenseBanner } from './license/pos-license-banner';
import { PosInstallButton } from './pos-install-button';
import { PosQueuePage } from './pos-queue-page';
import { PosConnectionPill } from './pos-connection-pill';
import { PosSaleQueue } from './offline/pos-sale-queue';
import { getPosDeviceId } from './pos-device';
import { PosServiceWorker } from './pos-service-worker';
import { stripLocalePrefix } from '../utils/strip-locale-prefix';
import { PosRegister } from './pos-register';
import { PosSettingsPage } from './pos-settings-page';

/**
 * Full-screen chrome for the register.
 *
 * Deliberately not `AdminShell`: a till runs on a small screen that is often
 * touch-only, and every pixel the admin sidebar would take is a pixel not
 * showing the sale. The nav here is four items and nothing else.
 */
export function PosShell({ children }: { children: ReactNode }) {
  const { pathname: rawPathname } = useCaspianNavigation();
  // A consumer that puts the locale in the URL hands us `/az/pos/settings`.
  const pathname = stripLocalePrefix(rawPathname);
  const Link = useCaspianLink();
  const { userProfile, signOut } = useAuth();
  const { functions } = useCaspianFirebase();
  const t = useT();
  const license = usePosLicense(functions);
  // One queue instance for the chrome, so the pill reflects the same store the
  // register writes to. Cheap: it holds no connection, only a device id.
  const queue = useMemo(() => new PosSaleQueue(functions, getPosDeviceId()), [functions]);

  const items = [
    { href: '/pos', label: t('pos.nav.register') },
    { href: '/pos/queue', label: t('pos.nav.queue') },
    { href: '/pos/settings', label: t('pos.nav.settings') },
  ];

  return (
    <div style={shell}>
      <header style={header}>
        <strong style={{ fontSize: 16 }}>{t('pos.title')}</strong>
        <nav style={{ display: 'flex', gap: 4, marginInlineStart: 12 }}>
          {items.map((item) => {
            const active = item.href === '/pos' ? pathname === '/pos' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  textDecoration: 'none',
                  color: 'inherit',
                  background: active ? 'rgba(0,0,0,0.08)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            {userProfile?.displayName || userProfile?.email}
          </span>
          {userProfile?.role === 'admin' ? (
            <Link href="/admin" style={{ fontSize: 13 }}>
              {t('pos.nav.admin')}
            </Link>
          ) : null}
          <PosConnectionPill queue={queue} />
          <PosInstallButton />
          <button type="button" onClick={() => void signOut()} style={exitButton}>
            {t('pos.nav.exit')}
          </button>
        </div>
      </header>

      <PosServiceWorker />
      <PosLicenseBanner license={license} />

      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</main>
    </div>
  );
}

const shell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  // The register owns the viewport: a till has no storefront header, no
  // footer, and nothing to scroll past to reach the sale.
  height: '100dvh',
  background: 'var(--caspian-background, #fff)',
  color: 'var(--caspian-foreground, #111)',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderBottom: '1px solid rgba(0,0,0,0.1)',
  flexWrap: 'wrap',
};

const exitButton: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 8,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
};

/**
 * Dispatcher for every `/pos/**` route.
 *
 * Same contract as `AdminRoot`: new register screens land as a branch here,
 * never as a route file the consumer has to add. Unknown sub-paths fall back
 * to the register rather than a 404 — a cashier who mistypes a URL should end
 * up able to sell, not stuck.
 */
export function PosRoot(): ReactNode {
  const { pathname } = useCaspianNavigation();
  const after = stripLocalePrefix(pathname).replace(/^\/pos\/?/, '');
  const [head] = after.split('/');

  switch (head) {
    case 'settings':
      return <PosSettingsPage />;
    case 'queue':
      return <PosQueuePage />;
    default:
      return <PosRegister />;
  }
}
