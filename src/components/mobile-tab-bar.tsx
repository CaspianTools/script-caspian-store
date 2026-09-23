'use client';

import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { useScriptSettings } from '../context/script-settings-context';
import { useT } from '../i18n/locale-context';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { HeartIcon, HomeIcon, SearchIcon, ShoppingCartIcon, StoreIcon, UserIcon } from '../ui/icons';
import { cn } from '../utils/cn';
import { stripLocalePrefix } from '../utils/strip-locale-prefix';

export interface MobileTabBarProps {
  /** Opens the same `<SearchDialog>` the header owns. */
  onOpenSearch: () => void;
  /** Opens the same `<CartSheet>` the header owns. */
  onOpenCart: () => void;
  /** Mirrors `SiteHeaderProps.showSearch`. Default true. */
  showSearch?: boolean;
  /** Href for the wishlist page. Default `/wishlist`. */
  wishlistHref?: string;
  /** Href for the login page, used while signed out. Default `/login`. */
  accountHref?: string;
  className?: string;
}


/**
 * Phone-only bottom tab bar for the storefront (hidden ≥821px by
 * `.caspian-tabbar` in globals.css). Home / Shop / Search / Wishlist / Cart /
 * Account, with the Account item standing in for the header's Sign in link,
 * which the same stylesheet hides on phones.
 */
export function MobileTabBar({
  onOpenSearch,
  onOpenCart,
  showSearch = true,
  wishlistHref = '/wishlist',
  accountHref = '/login',
  className,
}: MobileTabBarProps) {
  const t = useT();
  const Link = useCaspianLink();
  const { user } = useAuth();
  const { count: cartCount } = useCart();
  const { settings } = useScriptSettings();
  const pathname = stripLocalePrefix(useCaspianNavigation().pathname);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const signedIn = !!user && !user.isAnonymous;
  const resolvedAccountHref = signedIn ? '/account' : accountHref;
  const badge = cartCount > 99 ? '99+' : String(cartCount);

  const tabLink = (href: string, label: string, icon: React.ReactNode, exact = false) => {
    const active = isActive(href, exact);
    return (
      <Link
        href={href}
        className={cn('caspian-tabbar__item', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className={cn('caspian-tabbar', className)} aria-label={t('navigation.menu')}>
      {tabLink('/', t('navigation.tabbar.home'), <HomeIcon size={22} />, true)}
      {tabLink('/shop', t('navigation.tabbar.shop'), <StoreIcon size={22} />)}
      {showSearch && (
        <button
          type="button"
          className="caspian-tabbar__item"
          onClick={onOpenSearch}
          aria-label={t('navigation.openSearch')}
          aria-haspopup="dialog"
        >
          <SearchIcon size={22} />
          <span>{t('navigation.tabbar.search')}</span>
        </button>
      )}
      {settings.features.wishlist &&
        tabLink(wishlistHref, t('navigation.tabbar.wishlist'), <HeartIcon size={22} />)}
      <button
        type="button"
        className="caspian-tabbar__item"
        onClick={onOpenCart}
        aria-label={cartCount > 0 ? `${t('navigation.openCart')} (${cartCount})` : t('navigation.openCart')}
        aria-haspopup="dialog"
      >
        <ShoppingCartIcon size={22} />
        {cartCount > 0 && (
          <span className="caspian-tabbar__badge" aria-hidden="true">
            {badge}
          </span>
        )}
        <span>{t('navigation.tabbar.cart')}</span>
      </button>
      {tabLink(resolvedAccountHref, t('navigation.tabbar.account'), <UserIcon size={22} />)}
    </nav>
  );
}
