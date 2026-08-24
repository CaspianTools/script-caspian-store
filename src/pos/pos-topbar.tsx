'use client';

import { useCallback, useState } from 'react';
import { useCaspianNavigation } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import {
  ChevronDownIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  SunIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '../ui/icons';
import { PosConnectionPill } from './pos-connection-pill';
import { PosInstallButton } from './pos-install-button';
import { LocalProductFormDialog } from './standalone/admin/local-product-form-dialog';
import { LocalPersonFormDialog } from './standalone/admin/local-person-form-dialog';
import { usePosLocalSession } from './standalone/local-session-context';
import { usePosRoles } from './standalone/role-context';
import { usePosChrome } from './theme/pos-chrome-context';
import type { PosSaleQueue } from './offline/pos-sale-queue';
import type { UserProfile } from '../types';

export interface PosTopbarProps {
  /** What the current screen is called, shown where a browser tab title would be. */
  title: string;
  subtitle?: string;
  whoIsHere: string;
  initials: string;
  userProfile?: UserProfile | null;
  local: boolean;
  queue?: PosSaleQueue | null;
  onExit: () => void;
}

/**
 * The bar above the sale.
 *
 * Everything that used to be navigation has moved to `PosSidebar`; what is left
 * is the work of the current screen -- where you are, what you are looking for,
 * what you can add, and the state of the till. That is why it no longer wraps:
 * the old bar carried six links as well, and on a narrow till it stacked into
 * three rows that ate the ticket.
 */
export function PosTopbar({
  title,
  subtitle,
  whoIsHere,
  initials,
  userProfile,
  local,
  queue,
  onExit,
}: PosTopbarProps) {
  const { searchParams, replace } = useCaspianNavigation();
  const t = useT();
  const { compact, openDrawer, themeMode, cycleTheme } = usePosChrome();
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);

  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const role = session.user?.role;
  const mayAddProduct = local && can(role, 'store.edit');
  const mayAddPerson = local && can(role, 'people.edit');
  const maySeeStore = local && can(role, 'store.view');
  // A cloud till has no role definitions to consult, and settings answered to
  // nobody before capabilities existed, so it stays open there.
  const maySeeSettings = !local || can(role, 'settings.view');

  const submitSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      replace(trimmed ? `/pos?q=${encodeURIComponent(trimmed)}` : '/pos');
    },
    [replace],
  );

  const themeLabel = t(
    themeMode === 'light'
      ? 'pos.theme.light'
      : themeMode === 'dark'
        ? 'pos.theme.dark'
        : 'pos.theme.system',
  );

  return (
    <header className="cpos-topbar">
      {compact ? (
        <button
          type="button"
          className="cpos-iconbtn"
          onClick={openDrawer}
          aria-label={t('pos.nav.menu')}
        >
          <MenuIcon size={20} />
        </button>
      ) : null}

      <div className="cpos-topbar__title">
        <h1 className="cpos-topbar__h">{title}</h1>
        {subtitle ? <span className="cpos-topbar__sub">{subtitle}</span> : null}
      </div>

      <div className="cpos-topbar__spacer" />

      <form
        className="cpos-searchbox"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(search);
        }}
      >
        <span className="cpos-searchbox__icon">
          <SearchIcon size={16} />
        </span>
        <input
          className="cpos-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pos.scan.placeholder')}
          aria-label={t('pos.scan.placeholder')}
        />
        {search ? (
          <button
            type="button"
            className="cpos-searchbox__clear"
            onClick={() => {
              setSearch('');
              submitSearch('');
            }}
            aria-label={t('common.clear')}
          >
            <XIcon size={14} />
          </button>
        ) : null}
      </form>

      <div className="cpos-topbar__tools">
        <DropdownMenu
          trigger={
            <button type="button" className="cpos-btn cpos-btn--primary cpos-btn--sm">
              <PlusIcon size={16} />
              <span>{t('pos.quickAdd.title')}</span>
            </button>
          }
        >
          <DropdownMenuItem icon={<ShoppingCartIcon size={16} />} onSelect={() => replace('/pos')}>
            {t('pos.quickAdd.newSale')}
          </DropdownMenuItem>
          {/*
            A shortcut to something a role cannot do is worse than no shortcut:
            it offers the till's only route to a screen and then refuses it. Each
            of these asks for the same capability the screen behind it asks for.
          */}
          {mayAddProduct ? (
            <DropdownMenuItem icon={<TagIcon size={16} />} onSelect={() => setProductDialogOpen(true)}>
              {t('pos.quickAdd.product')}
            </DropdownMenuItem>
          ) : null}
          {mayAddPerson ? (
            <DropdownMenuItem icon={<UsersIcon size={16} />} onSelect={() => setPersonDialogOpen(true)}>
              {t('pos.quickAdd.person')}
            </DropdownMenuItem>
          ) : null}
          {maySeeStore ? (
            <DropdownMenuItem icon={<StoreIcon size={16} />} onSelect={() => replace('/pos/store')}>
              {t('pos.quickAdd.store')}
            </DropdownMenuItem>
          ) : null}
          {maySeeSettings ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<SettingsIcon size={16} />}
                onSelect={() => replace('/pos/settings')}
              >
                {t('pos.nav.settings')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenu>

        {!local && queue ? <PosConnectionPill queue={queue} /> : null}
        <PosInstallButton />

        <button
          type="button"
          className="cpos-iconbtn cpos-iconbtn--bordered"
          onClick={cycleTheme}
          aria-label={t('pos.theme.cycle', { mode: themeLabel })}
          title={themeLabel}
        >
          {themeMode === 'light' ? (
            <SunIcon size={18} />
          ) : themeMode === 'dark' ? (
            <MoonIcon size={18} />
          ) : (
            <MonitorIcon size={18} />
          )}
        </button>

        <DropdownMenu
          align="end"
          trigger={
            <button
              type="button"
              className="cpos-avatarbtn"
              aria-label={whoIsHere || t('pos.nav.user')}
            >
              <span className="cpos-avatar cpos-avatar--sm">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="" />
                ) : (
                  initials || <UserIcon size={14} />
                )}
              </span>
              <ChevronDownIcon size={14} />
            </button>
          }
        >
          <div className="cpos-menucard">
            <div className="cpos-menucard__name">{whoIsHere || t('pos.nav.user')}</div>
            {userProfile?.email ? (
              <div className="cpos-menucard__mail">{userProfile.email}</div>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          {maySeeSettings ? (
            <DropdownMenuItem
              icon={<SettingsIcon size={16} />}
              onSelect={() => replace('/pos/settings')}
            >
              {t('pos.nav.settings')}
            </DropdownMenuItem>
          ) : null}
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
