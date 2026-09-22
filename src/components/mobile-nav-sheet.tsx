'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { BottomSheet } from '../ui/bottom-sheet';
import { DownloadIcon, HeartIcon, LogOutIcon, UserIcon } from '../ui/icons';
import { stripLocalePrefix } from '../utils/strip-locale-prefix';
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
  gap: 12,
  width: '100%',
  minHeight: 48,
  padding: '0 4px',
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

const headingStyle: React.CSSProperties = {
  margin: '0 0 4px',
  padding: '0 4px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#666',
};

const iconStyle: React.CSSProperties = { display: 'inline-flex', color: '#666', flexShrink: 0 };

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
  const pathname = stripLocalePrefix(useCaspianNavigation().pathname);

  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

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
      <nav
        aria-label={t('navigation.menu.browse')}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <p style={headingStyle}>{t('navigation.menu.browse')}</p>
        {nav.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            style={{ ...linkStyle, fontWeight: isCurrent(item.href) ? 600 : 400 }}
            aria-current={isCurrent(item.href) ? 'page' : undefined}
            onClick={close}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label={t('navigation.menu.account')}
        style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}
      >
        <p style={headingStyle}>{t('navigation.menu.account')}</p>
        <Link
          href={wishlistHref}
          style={linkStyle}
          aria-current={isCurrent(wishlistHref) ? 'page' : undefined}
          onClick={close}
        >
          <span aria-hidden="true" style={iconStyle}>
            <HeartIcon size={18} />
          </span>
          {t('navigation.wishlist')}
        </Link>
        {user ? (
          <button type="button" style={{ ...linkStyle, borderBottom: 0 }} onClick={handleSignOut}>
            <span aria-hidden="true" style={iconStyle}>
              <LogOutIcon size={18} />
            </span>
            {t('navigation.signOut')}
          </button>
        ) : (
          <Link
            href={accountHref}
            style={{ ...linkStyle, borderBottom: 0 }}
            aria-current={isCurrent(accountHref) ? 'page' : undefined}
            onClick={close}
          >
            <span aria-hidden="true" style={iconStyle}>
              <UserIcon size={18} />
            </span>
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
              <span aria-hidden="true" style={iconStyle}>
                <DownloadIcon size={18} />
              </span>
              {t('pwa.install')}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 12, padding: '8px 4px' }}>
              <span aria-hidden="true" style={{ ...iconStyle, marginTop: 2 }}>
                <DownloadIcon size={18} />
              </span>
              <div>
                <strong style={{ display: 'block', fontSize: 14 }}>{t('pwa.iosHintTitle')}</strong>
                <span style={{ fontSize: 13, color: '#666' }}>{t('pwa.iosHintBody')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
