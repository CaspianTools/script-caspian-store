'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { useWishlist } from '../hooks/use-wishlist';
import { useT } from '../i18n/locale-context';
import {
  useCaspianFirebase,
  useCaspianLink,
} from '../provider/caspian-store-provider';
import { getSiteSettings } from '../services/site-settings-service';
import type { SiteSettings } from '../types';
import { Button } from '../ui/button';
import { SearchIcon } from '../ui/icons';
import { Badge } from '../ui/misc';
import { CartSheet } from './cart-sheet';
import { SearchDialog } from './search-dialog';
import { StorefrontProfileMenu } from './storefront-profile-menu';

export interface SiteHeaderNavItem {
  href: string;
  label: ReactNode;
}

export interface SiteHeaderProps {
  /** Brand name fallback when `settings/site.brandName` is empty. */
  brandFallback?: string;
  /** Top-level nav items (rendered alongside the brand). */
  nav?: SiteHeaderNavItem[];
  /**
   * @deprecated since v8.1.2 — the "Pages" dropdown was removed (issue mod1205).
   *   The prop is accepted but ignored. Add extra links to `nav` instead.
   *   Will be removed in the next major version.
   */
  moreNav?: SiteHeaderNavItem[] | null;
  /** Right-side language switcher slot (e.g. <LanguageSwitcher />). */
  languageSwitcher?: ReactNode;
  /** Right-side user-menu slot for signed-in users. If omitted, renders an avatar + sign-in fallback. */
  userMenu?: ReactNode;
  /** Href for the account / login button (when no userMenu slot is provided). */
  accountHref?: string;
  /** Href for the wishlist page. */
  wishlistHref?: string;
  /** Whether to show the search button (opens a popup with live product search). */
  showSearch?: boolean;
  className?: string;
}

const DEFAULT_NAV: SiteHeaderNavItem[] = [
  { href: '/shop', label: 'Shop' },
  { href: '/collections', label: 'Collections' },
];

export function SiteHeader({
  brandFallback = 'STORE',
  nav = DEFAULT_NAV,
  languageSwitcher,
  userMenu,
  accountHref = '/login',
  wishlistHref = '/wishlist',
  showSearch = true,
  className,
}: SiteHeaderProps) {
  const t = useT();
  const Link = useCaspianLink();
  const { db } = useCaspianFirebase();
  const { user, loading } = useAuth();
  const { count: cartCount } = useCart();
  const { wishlist } = useWishlist();
  const wishlistCount = wishlist.length;

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSiteSettings(db)
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db]);

  const brand = settings?.brandName?.trim() || brandFallback;

  return (
    <>
      <header
        className={className}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          width: '100%',
          borderBottom: '1px solid #eee',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            height: 80,
            padding: '0 24px',
            gap: 24,
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            {brand}
          </Link>

          <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }} className="caspian-site-nav">
            {nav.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: '#666',
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            {showSearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                aria-label={t('navigation.openSearch')}
              >
                <SearchIcon size={18} />
              </Button>
            )}

            {languageSwitcher}

            <Link href={wishlistHref}>
              <Button variant="outline" size="sm" style={{ position: 'relative' }}>
                ♥
                {wishlistCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      background: '#111',
                      color: '#fff',
                      borderRadius: 999,
                      fontSize: 10,
                      padding: '1px 5px',
                      lineHeight: 1.4,
                    }}
                  >
                    {wishlistCount}
                  </span>
                )}
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCartOpen(true)}
              aria-label={t('navigation.openCart')}
              style={{ position: 'relative' }}
            >
              🛒
              {cartCount > 0 && (
                <span style={{ marginLeft: 6 }}>
                  <Badge variant="default">{cartCount}</Badge>
                </span>
              )}
            </Button>

            {!loading && user ? (
              userMenu ?? <StorefrontProfileMenu />
            ) : (
              <Link href={accountHref}>
                <Button variant="outline" size="sm">
                  {t('navigation.signIn')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
