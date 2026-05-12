'use client';

import { useT } from '../../i18n/locale-context';
import { WishlistGrid, type WishlistGridProps } from '../wishlist/wishlist-grid';

export interface WishlistPanelProps extends WishlistGridProps {}

/**
 * Account-page panel that shows the signed-in user's saved products. Wraps
 * the shared <WishlistGrid /> in the account-card chrome. The same grid is
 * also mounted standalone at `/wishlist` via <WishlistPage />.
 *
 * No sign-in fallback here — this panel only renders inside <AccountPage />,
 * which already gates on auth.
 */
export function WishlistPanel(props: WishlistPanelProps) {
  const t = useT();
  return (
    <section className={props.className} style={cardStyle}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={titleStyle}>{t('wishlist.panel.title')}</h2>
        <p style={{ color: '#666', margin: '4px 0 0', fontSize: 13 }}>
          {t('wishlist.panel.subtitle')}
        </p>
      </header>
      <WishlistGrid {...props} className={undefined} />
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid #eee',
  borderRadius: 'var(--caspian-radius, 8px)',
  background: '#fff',
};
const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: 0,
};
