'use client';

import { useCallback, useMemo, useState } from 'react';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import {
  ChevronDownIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from '../ui/icons';
import { PosConnectionPill } from './pos-connection-pill';
import { PosInstallButton } from './pos-install-button';
import { LocalProductFormDialog } from './standalone/admin/local-product-form-dialog';
import { LocalPersonFormDialog } from './standalone/admin/local-person-form-dialog';
import type { PosSaleQueue } from './offline/pos-sale-queue';
import type { UserProfile } from '../types';

export interface PosHeaderProps {
  items: { href: string; label: string }[];
  pathname: string;
  whoIsHere: string;
  userProfile?: UserProfile | null;
  local: boolean;
  queue?: PosSaleQueue | null;
  onExit: () => void;
}

export function PosHeader({ items, pathname, whoIsHere, userProfile, local, queue, onExit }: PosHeaderProps) {
  const Link = useCaspianLink();
  const { searchParams, replace } = useCaspianNavigation();
  const t = useT();
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);

  const initials = useMemo(() => {
    const name = whoIsHere || userProfile?.displayName || userProfile?.email || '';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [whoIsHere, userProfile]);

  const avatarUrl = userProfile?.photoURL;

  const submitSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (trimmed) {
        replace(`/pos?q=${encodeURIComponent(trimmed)}`);
      } else {
        replace('/pos');
      }
    },
    [replace],
  );

  const activeHref = useMemo(() => {
    const exact = items.find((i) => i.href === pathname);
    if (exact) return exact.href;
    return items.find((i) => pathname.startsWith(i.href) && i.href !== '/pos')?.href ?? '/pos';
  }, [items, pathname]);

  return (
    <header style={header}>
      <div style={brand}>
        <div style={brandIcon}>
          <ShoppingCartIcon size={18} />
        </div>
        <strong style={{ fontSize: 16, fontWeight: 700 }}>{t('pos.title')}</strong>
      </div>

      <nav style={nav}>
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...navLink,
                background: active ? 'var(--caspian-primary, #1a73e8)' : 'transparent',
                color: active ? 'var(--caspian-primary-foreground, #fff)' : 'inherit',
                boxShadow: active ? '0 2px 8px rgba(26,115,232,0.25)' : 'none',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={tools}>
        <form
          style={searchWrap}
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch(search);
          }}
        >
          <span style={searchIcon}>
            <SearchIcon size={16} />
          </span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pos.scan.placeholder')}
            aria-label={t('pos.scan.placeholder')}
            style={searchInput}
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                submitSearch('');
              }}
              style={searchClear}
              aria-label={t('common.clear')}
            >
              ×
            </button>
          ) : null}
        </form>

        <DropdownMenu
          trigger={
            <Button type="button" variant="primary" size="sm" style={{ gap: 6 }}>
              <PlusIcon size={16} />
              <span>{t('pos.quickAdd.title')}</span>
            </Button>
          }
        >
          <DropdownMenuItem
            icon={<ShoppingCartIcon size={16} />}
            onSelect={() => replace('/pos')}
          >
            {t('pos.quickAdd.newSale')}
          </DropdownMenuItem>
          {local ? (
            <DropdownMenuItem
              icon={<TagIcon size={16} />}
              onSelect={() => setProductDialogOpen(true)}
            >
              {t('pos.quickAdd.product')}
            </DropdownMenuItem>
          ) : null}
          {local ? (
            <DropdownMenuItem
              icon={<UsersIcon size={16} />}
              onSelect={() => setPersonDialogOpen(true)}
            >
              {t('pos.quickAdd.person')}
            </DropdownMenuItem>
          ) : null}
          {local ? (
            <DropdownMenuItem
              icon={<StoreIcon size={16} />}
              onSelect={() => replace('/pos/store')}
            >
              {t('pos.quickAdd.store')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<SettingsIcon size={16} />}
            onSelect={() => replace('/pos/settings')}
          >
            {t('pos.nav.settings')}
          </DropdownMenuItem>
        </DropdownMenu>

        {!local && queue ? <PosConnectionPill queue={queue} /> : null}
        <PosInstallButton />

        <DropdownMenu
          align="end"
          trigger={
            <button type="button" style={avatarTrigger} aria-label={whoIsHere || t('pos.nav.user')}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={avatarImg} />
              ) : (
                <span style={avatarFallback}>{initials || <UserIcon size={16} />}</span>
              )}
              <ChevronDownIcon size={14} />
            </button>
          }
        >
          <div style={userCard}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{whoIsHere || t('pos.nav.user')}</div>
            {userProfile?.email ? (
              <div style={{ fontSize: 12, color: '#666' }}>{userProfile.email}</div>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          {items.map((item) => (
            <DropdownMenuItem
              key={item.href}
              icon={<NavIcon href={item.href} />}
              onSelect={() => replace(item.href)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<SettingsIcon size={16} />}
            onSelect={() => replace('/pos/settings')}
          >
            {t('pos.nav.settings')}
          </DropdownMenuItem>
          <DropdownMenuItem icon={<LogOutIcon size={16} />} destructive onSelect={onExit}>
            {t('pos.nav.exit')}
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <LocalProductFormDialog open={productDialogOpen} onOpenChange={setProductDialogOpen} />
      <LocalPersonFormDialog open={personDialogOpen} onOpenChange={setPersonDialogOpen} />
    </header>
  );
}

/** Tiny icon helper for the avatar menu — keeps the menu visually scannable. */
function NavIcon({ href }: { href: string }) {
  if (href === '/pos') return <ShoppingCartIcon size={16} />;
  if (href === '/pos/store') return <StoreIcon size={16} />;
  if (href === '/pos/admin') return <SettingsIcon size={16} />;
  if (href === '/pos/app-admin') return <UserIcon size={16} />;
  if (href === '/pos/settings') return <SettingsIcon size={16} />;
  return <ShoppingCartIcon size={16} />;
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '10px 16px',
  background: 'var(--caspian-background, #fff)',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  flexWrap: 'wrap',
};

const brand: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const brandIcon: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--caspian-primary, #1a73e8)',
  color: 'var(--caspian-primary-foreground, #fff)',
  boxShadow: '0 2px 8px rgba(26,115,232,0.25)',
};

const nav: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: 4,
  borderRadius: 999,
  background: 'rgba(0,0,0,0.03)',
};

const navLink: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
};

const tools: React.CSSProperties = {
  marginInlineStart: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const searchWrap: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  width: 260,
  maxWidth: '40vw',
};

const searchIcon: React.CSSProperties = {
  position: 'absolute',
  left: 12,
  color: '#888',
  pointerEvents: 'none',
  display: 'inline-flex',
};

const searchInput: React.CSSProperties = {
  paddingLeft: 36,
  paddingRight: 28,
  borderRadius: 999,
  background: 'rgba(0,0,0,0.03)',
  borderColor: 'transparent',
  boxShadow: 'none',
  fontSize: 14,
};

const searchClear: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: 0,
  background: 'rgba(0,0,0,0.08)',
  color: '#666',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  lineHeight: 1,
};

const avatarTrigger: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 999,
  padding: '4px 4px 4px 4px',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  transition: 'box-shadow 0.15s, border-color 0.15s',
};

const avatarImg: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  objectFit: 'cover',
};

const avatarFallback: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--caspian-primary, #1a73e8)',
  color: 'var(--caspian-primary-foreground, #fff)',
  fontSize: 11,
  fontWeight: 700,
};

const userCard: React.CSSProperties = {
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};
