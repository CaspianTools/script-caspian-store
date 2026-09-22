'use client';

import type { ReactNode } from 'react';
import {
  HeartIcon,
  LockIcon,
  MapPinIcon,
  PackageIcon,
  UserIcon,
} from '../../ui/icons';

export type AccountSection = 'profile' | 'orders' | 'addresses' | 'wishlist' | 'security';

export interface AccountSidebarItem {
  id: AccountSection;
  label: string;
  icon?: ReactNode;
}

export interface AccountSidebarProps {
  items: AccountSidebarItem[];
  active: AccountSection;
  /**
   * Called when the user picks a section. Parents should set their own state
   * here so the UI swaps synchronously, then optionally mirror to the URL for
   * deep-linking / history. Driving the view from local state rather than the
   * navigation adapter's `searchParams` keeps the panel switch working even on
   * consumer adapters whose `searchParams` isn't reactive.
   */
  onSelect: (section: AccountSection) => void;
  className?: string;
}

/**
 * Left-rail nav for `<AccountPage>`. Renders as a vertical list on desktop and
 * as a horizontal scrollable strip on mobile (via the `caspian-account-sidebar`
 * class hooked up in globals.css). Section switching fires `onSelect` — the
 * parent owns state and optionally mirrors to the URL. Keeping the view off
 * the navigation adapter's `searchParams` means the panel swaps synchronously
 * on click even when the consumer's adapter isn't reactive on query changes.
 */
export function AccountSidebar({ items, active, onSelect, className }: AccountSidebarProps) {
  return (
    <nav
      aria-label="Account sections"
      className={`caspian-account-sidebar${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 8,
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        background: '#fff',
        alignSelf: 'start',
      }}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className="caspian-account-sidebar__item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              padding: '10px 14px',
              border: 0,
              background: isActive ? 'var(--caspian-primary, #111)' : 'transparent',
              color: isActive ? 'var(--caspian-primary-foreground, #fff)' : '#222',
              borderRadius: 'var(--caspian-radius, 6px)',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              whiteSpace: 'nowrap',
            }}
          >
            {item.icon && (
              <span
                aria-hidden
                style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
              >
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const ACCOUNT_SECTION_ICONS = {
  profile: <UserIcon size={16} />,
  orders: <PackageIcon size={16} />,
  addresses: <MapPinIcon size={16} />,
  wishlist: <HeartIcon size={16} />,
  security: <LockIcon size={16} />,
} as const;
