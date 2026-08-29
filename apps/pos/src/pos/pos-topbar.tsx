'use client';

import { useCallback, useState } from 'react';
import {
  useCaspianNavigation,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  type UserProfile,
} from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';
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
  SunIcon,
  UserIcon,
  XIcon,
} from '../icons';
import { PosConnectionPill } from './pos-connection-pill';
import { PosInstallButton } from './pos-install-button';
import { usePosChrome } from './theme/pos-chrome-context';
import type { PosSaleQueue } from './offline/pos-sale-queue';

export interface PosTopbarProps {
  /** What the current screen is called, shown where a browser tab title would be. */
  title: string;
  whoIsHere: string;
  initials: string;
  userProfile?: UserProfile | null;
  queue?: PosSaleQueue | null;
  onExit: () => void;
}

/**
 * The bar above the sale, on a register backed by a Firebase project.
 *
 * Everything that used to be navigation moved to `PosSidebar`; what is left is
 * the work of the current screen -- where you are, what you are looking for, and
 * the state of the connection.
 *
 * A standalone till renders `PosLocalTopbar` instead, and does not come through
 * here at all. Until v1.4.0 it did, and this file carried five `local && …`
 * branches for it: a quick-add dropdown whose every entry was standalone-only,
 * and two form dialogs a cloud register imported and could never open. Those are
 * gone rather than gated harder -- pos/CLAUDE.md is explicit that a standalone
 * feature reaching into a shared screen is the signal it wants a file of its
 * own. Nothing a cloud register renders changed when they went.
 */
export function PosTopbar({
  title,
  whoIsHere,
  initials,
  userProfile,
  queue,
  onExit,
}: PosTopbarProps) {
  const { searchParams, replace } = useCaspianNavigation();
  const t = useT();
  const { compact, openDrawer, themeMode, cycleTheme } = usePosChrome();
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '');

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
          aria-label={t('pos.search.labelFindItem')}
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<SettingsIcon size={16} />}
            onSelect={() => replace('/pos/settings')}
          >
            {t('pos.nav.settings')}
          </DropdownMenuItem>
        </DropdownMenu>

        {queue ? <PosConnectionPill queue={queue} /> : null}
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
    </header>
  );
}
