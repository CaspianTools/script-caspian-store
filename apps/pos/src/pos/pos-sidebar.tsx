'use client';

import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { useCaspianLink, cn } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';
import {
  ChevronLeftIcon,
  InboxIcon,
  PanelLeftIcon,
  ReceiptIcon,
  ScanIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  StoreIcon,
  UsersIcon,
  XIcon,
} from '../icons';
import { usePosChrome } from './theme/pos-chrome-context';
import { usePosOverlay } from './standalone/ui/pos-dialog';

/**
 * A register screen the side menu can reach.
 *
 * `group` is what the menu prints above a run of items; items sharing a group
 * are rendered together in the order they were declared. `count` is the only
 * live number the menu shows — the outbox depth — because it is the one thing a
 * cashier needs to notice without opening the screen it belongs to.
 *
 * `bottom` is the exception: those items print no group label and sit in the
 * foot, below the scroll, for the screens a shop opens once a year.
 */
export interface PosNavItem {
  href: string;
  label: string;
  icon: 'register' | 'queue' | 'store' | 'sales' | 'people' | 'roles' | 'settings';
  group: 'counter' | 'shop' | 'system' | 'bottom';
  count?: number;
}

export interface PosSidebarProps {
  items: PosNavItem[];
  activeHref: string;
  roleLabel?: string;
}

const ICONS: Record<PosNavItem['icon'], (size: number) => ReactNode> = {
  register: (size) => <ScanIcon size={size} />,
  queue: (size) => <InboxIcon size={size} />,
  store: (size) => <StoreIcon size={size} />,
  sales: (size) => <ReceiptIcon size={size} />,
  people: (size) => <UsersIcon size={size} />,
  roles: (size) => <ShieldIcon size={size} />,
  settings: (size) => <SettingsIcon size={size} />,
};

const GROUP_ORDER = ['counter', 'shop', 'system'] as const;
const GROUP_LABEL: Record<(typeof GROUP_ORDER)[number], string> = {
  counter: 'pos.nav.group.counter',
  shop: 'pos.nav.group.shop',
  system: 'pos.nav.group.system',
};

/**
 * The register's side menu.
 *
 * This replaces the wrapping top bar the till used through v12. The old comment
 * on `PosShell` argued a sidebar costs pixels the sale needs, and that was true
 * of the admin panel's fixed 240px column — but the bar it defended had grown to
 * six links, a search box, two dropdowns, a status pill and an install button,
 * and `flexWrap` meant a narrow till stacked all of that into two or three rows.
 * On a 1024x768 tablet that cost about 120px of height out of 768. The rail
 * costs 72px of width out of 1024, and folds away entirely below that.
 *
 * Three states, and the screen picks between them rather than the operator:
 * a full column, an icon rail, and — under 1024px — an overlay drawer.
 */
export function PosSidebar({ items, activeHref, roleLabel }: PosSidebarProps) {
  const Link = useCaspianLink();
  const t = useT();
  const { rail, toggleRail, compact, drawerOpen, closeDrawer } = usePosChrome();

  const asideRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLButtonElement | null>(null);
  // TWO containers, not one. The scrim is a SIBLING of the panel, so a
  // single-container walk would inert it -- and click-to-dismiss is the way
  // most people close this thing.
  const containers = useRef([asideRef, scrimRef]).current;

  // As a drawer it is a modal overlay and takes the contract. As a permanent
  // column it is just navigation, and trapping focus in the page's own nav
  // would be a bug rather than a feature -- hence the `compact` gate.
  usePosOverlay({
    open: compact && drawerOpen,
    containers,
    onDismiss: closeDrawer,
    dismissOn: { escape: true },
  });

  /**
   * Put focus in the drawer when it opens, the way `PosDialog` does for itself.
   *
   * Not optional here, and not merely nice: the hamburger that opened the
   * drawer lives in `.cpos-column`, which `applyInert` has just marked inert,
   * and the HTML focus-fixup rule blurs an element that becomes inert. Focus
   * therefore lands on `<body>` -- so the `role="dialog"` this change adds is
   * never announced, and Shift+Tab escapes the trap because the handler only
   * rewrites Tab at the two ends. Focusing the panel rather than the close
   * button is what makes a screen reader read the drawer's name.
   */
  useEffect(() => {
    if (compact && drawerOpen) asideRef.current?.focus();
  }, [compact, drawerOpen]);

  // The drawer is always full width: it is already an overlay, so parking it as
  // a rail would trade the one advantage it has for nothing.
  const asRail = rail && !compact;
  if (compact && !drawerOpen) return null;

  const groups = GROUP_ORDER.map((group) => ({
    group,
    entries: items.filter((item) => item.group === group),
  })).filter((section) => section.entries.length > 0);

  const pinned = items.filter((item) => item.group === 'bottom');

  const renderItem = (item: PosNavItem) => {
    const active = item.href === activeHref;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn('cpos-navitem', active && 'cpos-navitem--active')}
        aria-current={active ? 'page' : undefined}
        onClick={compact ? closeDrawer : undefined}
      >
        <span className="cpos-navitem__icon">{ICONS[item.icon](19)}</span>
        {!asRail ? <span className="cpos-navitem__label">{item.label}</span> : null}
        {item.count ? (
          <span className="cpos-navitem__count">{item.count > 99 ? '99+' : item.count}</span>
        ) : null}
        {asRail ? <span className="cpos-navitem__tip">{item.label}</span> : null}
      </Link>
    );
  };

  return (
    <>
      {compact ? (
        // Not in the tab order: once the drawer has a real close button, a
        // full-bleed unlabelled button would be the trap's first stop.
        <button
          type="button"
          className="cpos-scrim"
          tabIndex={-1}
          aria-hidden="true"
          ref={scrimRef}
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        ref={asideRef}
        // Focusable only as a target for the line above; never a tab stop.
        tabIndex={compact ? -1 : undefined}
        className={cn(
          'cpos-sidebar',
          asRail && 'cpos-sidebar--rail',
          compact && 'cpos-sidebar--drawer',
        )}
        // Only as a drawer. A permanent column claiming to be a modal dialog
        // would be a lie a screen reader has to work around.
        role={compact ? 'dialog' : undefined}
        aria-modal={compact ? true : undefined}
        aria-label={t('pos.nav.menu')}
      >
        <div className="cpos-sidebar__brand">
          <span className="cpos-sidebar__mark">
            <ShoppingCartIcon size={18} />
          </span>
          {!asRail ? (
            <span className="cpos-sidebar__wordmark">
              <span className="cpos-sidebar__name">{t('pos.title')}</span>
              {roleLabel ? <span className="cpos-sidebar__sub">{roleLabel}</span> : null}
            </span>
          ) : null}
          {compact ? (
            // The drawer had no visible way out at all -- only the scrim, which
            // looks like nothing, and which a keyboard cannot reach.
            <button
              type="button"
              className="cpos-iconbtn cpos-iconbtn--onbrand cpos-sidebar__close"
              aria-label={t('common.close')}
              onClick={closeDrawer}
            >
              <XIcon size={18} />
            </button>
          ) : null}
        </div>

        <nav className="cpos-sidebar__nav">
          {groups.map((section) => (
            <Fragment key={section.group}>
              <div className="cpos-sidebar__grouplabel">{t(GROUP_LABEL[section.group])}</div>
              {section.entries.map(renderItem)}
            </Fragment>
          ))}
        </nav>

        {/*
          Who is signed in, and the way out, both used to sit here. They are in
          the top bar's avatar menu as well, and saying it twice cost the foot
          the room the pinned items now use.
        */}
        <div className="cpos-sidebar__foot">
          {pinned.map(renderItem)}

          {!compact ? (
            <button
              type="button"
              className="cpos-navitem"
              onClick={toggleRail}
              aria-pressed={asRail}
            >
              <span className="cpos-navitem__icon">
                {asRail ? <PanelLeftIcon size={19} /> : <ChevronLeftIcon size={19} />}
              </span>
              {!asRail ? <span className="cpos-navitem__label">{t('pos.nav.collapse')}</span> : null}
              {asRail ? <span className="cpos-navitem__tip">{t('pos.nav.expand')}</span> : null}
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
