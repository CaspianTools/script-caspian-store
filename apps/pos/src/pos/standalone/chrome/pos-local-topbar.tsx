'use client';

import { useCallback, useState } from 'react';
import {
  useCaspianNavigation,
  useT,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@caspian-explorer/script-caspian-store';
import {
  ChevronDownIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
  XIcon,
} from '../../../icons';
import { usePosChrome } from '../../theme/pos-chrome-context';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosQuickAdd } from '../admin/quick-add/pos-quick-add-context';

export interface PosLocalTopbarProps {
  /** What the current screen is called, shown where a browser tab title would be. */
  title: string;
  whoIsHere: string;
  initials: string;
  onExit: () => void;
}

/**
 * The standalone till's own top bar.
 *
 * Split from `pos-topbar.tsx` in v1.4.0. That file is shared with the
 * cloud-backed register and had grown five `local && …` branches -- a quick-add
 * dropdown whose every entry was standalone-only, and two form dialogs a cloud
 * register imported and could never open. pos/CLAUDE.md is explicit that a
 * standalone feature reaching into a shared screen is the signal it wants a file
 * of its own, so it got one, and the branches came out of the shared file rather
 * than growing a sixth.
 *
 * The bar says where you are, lets you find a product, and opens the one dialog
 * that creates things. Navigation is the sidebar's -- see the note on
 * `PosShellChrome` for why it is not back up here.
 */
export function PosLocalTopbar({ title, whoIsHere, initials, onExit }: PosLocalTopbarProps) {
  const { searchParams, replace } = useCaspianNavigation();
  const t = useT();
  const { compact, openDrawer, themeMode, cycleTheme } = usePosChrome();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const quickAdd = usePosQuickAdd();
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? '');

  const role = session.user?.role;
  // Quick add offers nothing at all to a role that may edit neither the
  // catalogue nor the staff, and a button that opens an empty dialog is worse
  // than no button.
  const mayCreate = can(role, 'store.edit') || can(role, 'people.edit');
  const maySeeSettings = can(role, 'settings.view');

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
        <span className="cpos-topbar__sub">{t('pos.storage.localShort')}</span>
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
        {/*
          One button, not a menu. It used to be a dropdown of four shortcuts --
          two of which were plain navigation the sidebar already carries -- and
          picking one of them opened a different-looking form each time. The
          dialog behind this button is the same one every Add button on every
          screen opens.
        */}
        {mayCreate ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--primary cpos-btn--sm"
            onClick={() => quickAdd.open()}
          >
            <PlusIcon size={16} />
            <span>{t('pos.quickAdd.title')}</span>
          </button>
        ) : null}

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
                {initials || <UserIcon size={14} />}
              </span>
              <ChevronDownIcon size={14} />
            </button>
          }
        >
          <div className="cpos-menucard">
            <div className="cpos-menucard__name">{whoIsHere || t('pos.nav.user')}</div>
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
    </header>
  );
}
