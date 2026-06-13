'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { BottomSheet } from '../ui/bottom-sheet';
import { useInstallPrompt } from './install-app-prompt';

export interface MobileNavSheetItem {
  href: string;
  label: ReactNode;
}

export interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: MobileNavSheetItem[];
  accountHref: string;
  wishlistHref: string;
}

const linkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '14px 4px',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  font: 'inherit',
  fontSize: 16,
  color: '#111',
  textAlign: 'left',
  cursor: 'pointer',
  textDecoration: 'none',
};

/**
 * Mobile navigation drawer (a `<BottomSheet>`). Replaces the desktop header's
 * inline nav on small screens: the primary nav links, an account section, a
 * wishlist link, and an "Install app" affordance. Receives nav items as props
 * from `<SiteHeader>`.
 */
export function MobileNavSheet({
  open,
  onOpenChange,
  nav,
  accountHref,
  wishlistHref,
}: MobileNavSheetProps) {
  const t = useT();
  const Link = useCaspianLink();
  const { user, signOut } = useAuth();
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();

  const close = () => onOpenChange(false);
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      /* toast comes from the auth context if needed */
    } finally {
      close();
    }
  };

  const showInstall = canInstall || (isIOS && !isStandalone);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('navigation.menu')}
      closeLabel={t('navigation.closeMenu')}
    >
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        {nav.map((item, i) => (
          <Link key={i} href={item.href} style={linkStyle} onClick={close}>
            {item.label}
          </Link>
        ))}
        <Link href={wishlistHref} style={linkStyle} onClick={close}>
          {t('navigation.wishlist')}
        </Link>
        {user ? (
          <button type="button" style={{ ...linkStyle, borderBottom: 0 }} onClick={handleSignOut}>
            {t('navigation.signOut')}
          </button>
        ) : (
          <Link href={accountHref} style={{ ...linkStyle, borderBottom: 0 }} onClick={close}>
            {t('navigation.signIn')}
          </Link>
        )}
      </nav>

      {showInstall && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          {canInstall ? (
            <button
              type="button"
              style={{ ...linkStyle, borderBottom: 0, fontWeight: 600 }}
              onClick={() => {
                void promptInstall();
              }}
            >
              {t('pwa.install')}
            </button>
          ) : (
            <div style={{ padding: '8px 4px' }}>
              <strong style={{ display: 'block', fontSize: 14 }}>{t('pwa.iosHintTitle')}</strong>
              <span style={{ fontSize: 13, color: '#666' }}>{t('pwa.iosHintBody')}</span>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
