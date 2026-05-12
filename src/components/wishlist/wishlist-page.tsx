'use client';

import { useEffect, useState } from 'react';
import { useWishlist } from '../../context/wishlist-context';
import { useT } from '../../i18n/locale-context';
import { useCaspianLink } from '../../provider/caspian-store-provider';
import { WishlistGrid, type WishlistGridProps } from './wishlist-grid';

export interface WishlistPageProps extends WishlistGridProps {
  /** Where the soft banner's "Sign in" link points. Default: `/login`. */
  signInHref?: string;
}

const BANNER_DISMISS_KEY = 'caspian-wishlist-banner-dismissed-v1';

/**
 * Standalone `/wishlist` page — works for both anonymous and signed-in
 * shoppers. Anon shoppers see a dismissible "Sign in to save across devices"
 * banner above the grid. Signed-in shoppers see only the grid (the same one
 * rendered inside the account page's <WishlistPanel>).
 */
export function WishlistPage({
  signInHref = '/login',
  className,
  ...gridProps
}: WishlistPageProps) {
  const t = useT();
  const Link = useCaspianLink();
  const { signedIn } = useWishlist();
  const [bannerDismissed, setBannerDismissed] = useState(true); // start hidden to avoid SSR flash

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.sessionStorage.getItem(BANNER_DISMISS_KEY) === '1';
    setBannerDismissed(dismissed);
  }, []);

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(BANNER_DISMISS_KEY, '1');
      } catch {
        /* noop */
      }
    }
  };

  const showBanner = !signedIn && !bannerDismissed;

  return (
    <div
      className={`caspian-wishlist-page${className ? ` ${className}` : ''}`}
      style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}
    >
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('wishlist.panel.title')}
        </h1>
        <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>
          {t('wishlist.panel.subtitle')}
        </p>
      </header>

      {showBanner && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 16,
            background: '#f8f9fb',
            border: '1px solid #e5e7eb',
            borderRadius: 'var(--caspian-radius, 8px)',
          }}
        >
          <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>
            {t('wishlist.page.anonBanner')}{' '}
            <Link href={signInHref} style={{ color: '#2563eb', fontWeight: 500 }}>
              {t('wishlist.page.anonBannerCta')}
            </Link>
          </span>
          <button
            type="button"
            onClick={handleDismissBanner}
            aria-label={t('common.dismiss')}
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>
      )}

      <WishlistGrid {...gridProps} />
    </div>
  );
}
