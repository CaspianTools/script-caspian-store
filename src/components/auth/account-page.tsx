'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useCaspianLink, useCaspianNavigation } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import { Button } from '../../ui/button';
import { Avatar } from '../../ui/misc';
import { OrderHistoryList } from '../order-history-list';
import { ProfileCard } from './profile-card';
import { AddressBook } from './address-book';
import { ChangePasswordCard } from './change-password-card';
import { ProfilePhotoCard } from './profile-photo-card';
import { DeleteAccountCard } from './delete-account-card';
import { WishlistPanel } from './wishlist-panel';
import {
  AccountSidebar,
  ACCOUNT_SECTION_ICONS,
  type AccountSection,
  type AccountSidebarItem,
} from './account-sidebar';

export interface AccountPageProps {
  signInHref?: string;
  /** Hide sections you don't want to render. */
  hideOrders?: boolean;
  hideAddresses?: boolean;
  hidePassword?: boolean;
  hidePhoto?: boolean;
  hideDeleteAccount?: boolean;
  hideWishlist?: boolean;
  /** Base path for the account page. Default: `/account`. */
  basePath?: string;
  className?: string;
}

const VALID_SECTIONS: AccountSection[] = [
  'profile',
  'orders',
  'addresses',
  'wishlist',
  'security',
];

function resolveSection(searchParams: URLSearchParams | undefined): AccountSection {
  const raw = searchParams?.get('section') ?? '';
  return (VALID_SECTIONS as string[]).includes(raw) ? (raw as AccountSection) : 'profile';
}

function readWindowSection(): AccountSection {
  if (typeof window === 'undefined') return 'profile';
  const raw = new URLSearchParams(window.location.search).get('section') ?? '';
  return (VALID_SECTIONS as string[]).includes(raw) ? (raw as AccountSection) : 'profile';
}

export function AccountPage({
  signInHref = '/login',
  hideOrders,
  hideAddresses,
  hidePassword,
  hidePhoto,
  hideDeleteAccount,
  hideWishlist,
  basePath = '/account',
  className,
}: AccountPageProps) {
  const { user, userProfile, loading, signOut } = useAuth();
  const Link = useCaspianLink();
  const nav = useCaspianNavigation();
  const t = useT();

  const [active, setActive] = useState<AccountSection>(() =>
    resolveSection(nav.searchParams) !== 'profile'
      ? resolveSection(nav.searchParams)
      : readWindowSection(),
  );

  // Keep local state in sync with the URL for: (a) deep-links from the header
  // dropdown, (b) browser back/forward (popstate), (c) consumer adapters whose
  // `searchParams` IS reactive (nav.searchParams flips → we pick it up).
  useEffect(() => {
    const fromNav = resolveSection(nav.searchParams);
    if (fromNav !== active) setActive(fromNav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setActive(readWindowSection());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleSelect = useCallback(
    (next: AccountSection) => {
      setActive(next);
      const href = next === 'profile' ? basePath : `${basePath}?section=${next}`;
      nav.push(href);
    },
    [nav, basePath],
  );

  if (loading) return <p style={{ padding: 40, color: '#888' }}>{t('common.loading')}</p>;

  if (!user) {
    return (
      <div className={className} style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {t('account.signInRequired.title')}
        </h1>
        <p style={{ color: '#666', marginTop: 8 }}>{t('account.signInRequired.subtitle')}</p>
        <div style={{ marginTop: 16 }}>
          <Link href={signInHref}>{t('signInGate.signInLink')}</Link>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    nav.push('/');
  };

  const displayedName = userProfile?.displayName || user.email;

  const sidebarItems: AccountSidebarItem[] = [
    { id: 'profile', label: t('account.menu.profile'), icon: ACCOUNT_SECTION_ICONS.profile },
    ...(!hideOrders
      ? [{ id: 'orders' as const, label: t('account.menu.orders'), icon: ACCOUNT_SECTION_ICONS.orders }]
      : []),
    ...(!hideAddresses
      ? [
          {
            id: 'addresses' as const,
            label: t('account.menu.addresses'),
            icon: ACCOUNT_SECTION_ICONS.addresses,
          },
        ]
      : []),
    ...(!hideWishlist
      ? [
          {
            id: 'wishlist' as const,
            label: t('account.menu.wishlist'),
            icon: ACCOUNT_SECTION_ICONS.wishlist,
          },
        ]
      : []),
    ...(!hidePassword || !hideDeleteAccount
      ? [
          {
            id: 'security' as const,
            label: t('account.menu.security'),
            icon: ACCOUNT_SECTION_ICONS.security,
          },
        ]
      : []),
  ];

  return (
    <div
      className={`caspian-account-page${className ? ` ${className}` : ''}`}
      style={{ maxWidth: 1200, margin: '0 auto', padding: '32px clamp(16px, 4vw, 24px)' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: 'clamp(16px, 4vw, 24px)',
          marginBottom: 24,
          borderRadius: 'var(--caspian-radius, 12px)',
          background: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
          border: '1px solid #eee',
        }}
      >
        <Avatar src={userProfile?.photoURL} fallback={displayedName ?? '?'} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t('account.title')}</h1>
          <p
            style={{
              color: '#666',
              marginTop: 4,
              marginBottom: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('account.signedInAs', { name: displayedName ?? '' })}
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          {t('account.signOut')}
        </Button>
      </header>

      <div className="caspian-account-grid">
        <AccountSidebar items={sidebarItems} active={active} onSelect={handleSelect} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {active === 'profile' && (
            <>
              {!hidePhoto && <ProfilePhotoCard />}
              <ProfileCard />
            </>
          )}
          {active === 'orders' && !hideOrders && (
            <section style={sectionStyle}>
              <h2 style={h2Style}>{t('account.sections.recentOrders')}</h2>
              <OrderHistoryList />
            </section>
          )}
          {active === 'addresses' && !hideAddresses && <AddressBook />}
          {active === 'wishlist' && !hideWishlist && <WishlistPanel />}
          {active === 'security' && (
            <>
              {!hidePassword && <ChangePasswordCard />}
              {!hideDeleteAccount && <DeleteAccountCard />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
  background: '#fff',
};
const h2Style: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 12 };
