'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useCaspianLink, useCaspianNavigation } from '../provider/caspian-store-provider';
import {
  DEFAULT_REPO_NAME,
  DEFAULT_REPO_OWNER,
  fetchRecentReleases,
  isUpdateAvailable,
} from '../services/github-updates-service';
import {
  AtSignIcon,
  BookmarkIcon,
  BookOpenIcon,
  ChevronDownIcon,
  CreditCardIcon,
  DashboardIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  HelpIcon,
  InboxIcon,
  InfoIcon,
  LayersIcon,
  MailIcon,
  MenuIcon,
  PackageIcon,
  PaletteIcon,
  PlugIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SlidersIcon,
  StarIcon,
  TagIcon,
  TicketIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from '../ui/icons';
import { Badge } from '../ui/misc';
import { cn } from '../utils/cn';
import { CASPIAN_STORE_VERSION } from '../version';
import { AdminNotificationsBell } from './admin-notifications-bell';
import { AdminOnboardingProgress } from './admin-onboarding-progress';
import {
  useEnabledPluginInstalls,
  type EnabledPluginCategory,
  type EnabledPluginInstall,
} from './use-enabled-plugin-installs';

export interface AdminNavLeaf {
  kind?: 'leaf';
  href: string;
  label: string;
  /** Optional icon — any renderable node. Defaults from the catalog below. */
  icon?: ReactNode;
}

export interface AdminNavGroup {
  kind: 'group';
  /** Stable key used to persist expand/collapse state in localStorage. */
  id: string;
  label: string;
  icon?: ReactNode;
  children: AdminNavLeaf[];
  /**
   * Optional URL the group's label navigates to when clicked. When set, the
   * label + icon become a link; the chevron on the right still toggles
   * expand/collapse independently. When omitted, clicking anywhere on the
   * header row toggles — the legacy behavior for container-only groups.
   * Added in v7.1.1 so the Plugins group's header opens the unified page
   * at `/admin/plugins` instead of only expanding.
   */
  href?: string;
}

export type AdminNavItem = AdminNavLeaf | AdminNavGroup;

function isGroup(item: AdminNavItem): item is AdminNavGroup {
  return (item as AdminNavGroup).kind === 'group';
}

const ICON_SIZE = 16;

export const DEFAULT_ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: <DashboardIcon size={ICON_SIZE} /> },
  {
    kind: 'group',
    id: 'catalog',
    label: 'Catalog',
    icon: <PackageIcon size={ICON_SIZE} />,
    children: [
      { href: '/admin/products', label: 'Products', icon: <TagIcon size={ICON_SIZE} /> },
      { href: '/admin/brands', label: 'Brands', icon: <BookmarkIcon size={ICON_SIZE} /> },
      { href: '/admin/categories', label: 'Categories', icon: <FolderIcon size={ICON_SIZE} /> },
      { href: '/admin/collections', label: 'Collections', icon: <LayersIcon size={ICON_SIZE} /> },
      { href: '/admin/promo-codes', label: 'Promo codes', icon: <TicketIcon size={ICON_SIZE} /> },
    ],
  },
  {
    kind: 'group',
    id: 'people',
    label: 'People',
    icon: <UsersIcon size={ICON_SIZE} />,
    children: [
      { href: '/admin/users', label: 'Users', icon: <UserIcon size={ICON_SIZE} /> },
      { href: '/admin/contacts', label: 'Contacts', icon: <MailIcon size={ICON_SIZE} /> },
      { href: '/admin/subscribers', label: 'Subscribers', icon: <MailIcon size={ICON_SIZE} /> },
    ],
  },
  {
    kind: 'group',
    id: 'sales',
    label: 'Sales',
    icon: <ShoppingCartIcon size={ICON_SIZE} />,
    children: [
      { href: '/admin/orders', label: 'Orders', icon: <ReceiptIcon size={ICON_SIZE} /> },
      { href: '/admin/reviews', label: 'Reviews', icon: <StarIcon size={ICON_SIZE} /> },
    ],
  },
  {
    kind: 'group',
    id: 'content',
    label: 'Content',
    icon: <FileTextIcon size={ICON_SIZE} />,
    children: [
      { href: '/admin/pages', label: 'Pages', icon: <FileIcon size={ICON_SIZE} /> },
      { href: '/admin/faqs', label: 'FAQs', icon: <HelpIcon size={ICON_SIZE} /> },
      { href: '/admin/journal', label: 'Journal', icon: <BookOpenIcon size={ICON_SIZE} /> },
    ],
  },
  {
    // Plugins became an AdminNavGroup in v7.1.0. Children are populated at
    // runtime inside <AdminShell> from enabled installs across the three
    // plugin collections — the group renders childless until a merchant
    // enables their first plugin. Keeping the id `plugins` matters: the
    // runtime injection finds its target by id, so consumers who pass
    // their own `navItems` prop still get dynamic children as long as the
    // group's id is `plugins`.
    kind: 'group',
    id: 'plugins',
    label: 'Plugins',
    icon: <PlugIcon size={ICON_SIZE} />,
    href: '/admin/plugins',
    children: [],
  },
  {
    kind: 'group',
    id: 'settings',
    label: 'Settings',
    icon: <SettingsIcon size={ICON_SIZE} />,
    href: '/admin/settings',
    children: [
      { href: '/admin/appearance', label: 'Appearance', icon: <PaletteIcon size={ICON_SIZE} /> },
    ],
  },
  { href: '/admin/about', label: 'About', icon: <InfoIcon size={ICON_SIZE} /> },
];

// Settings sub-sidebar items. Exported for use by AdminSettingsShell so both
// surfaces share the same ordering and icon set. Appearance promoted to a
// top-level Settings sidebar child in v8.2.0 (was a sub-tab here in v7.1.0–v8.1.x).
export const SETTINGS_SUB_NAV: AdminNavLeaf[] = [
  { href: '/admin/settings/general', label: 'General', icon: <SlidersIcon size={ICON_SIZE} /> },
  {
    href: '/admin/settings/shipping-options',
    label: 'Shipping options',
    icon: <TruckIcon size={ICON_SIZE} />,
  },
  { href: '/admin/settings/emails', label: 'Emails', icon: <InboxIcon size={ICON_SIZE} /> },
  { href: '/admin/settings/languages', label: 'Languages', icon: <GlobeIcon size={ICON_SIZE} /> },
];

export interface AdminShellProps {
  title?: string;
  navItems?: AdminNavItem[];
  /** Extra header content (search box, user menu, etc.). Placed at the far right. */
  headerRight?: ReactNode;
  /**
   * Show an "Update available" badge next to the title when the installed
   * library version is behind the latest public GitHub release. Default true.
   * Set false to skip the (unauthenticated) GitHub API call.
   */
  checkForUpdates?: boolean;
  /** GitHub owner to check for updates. Default: CaspianTools. */
  updateCheckOwner?: string;
  /** GitHub repo to check for updates. Default: script-caspian-store. */
  updateCheckRepo?: string;
  /**
   * Show the notifications bell in the header. Default true. Hide if the
   * consumer wants a custom bell in `headerRight`.
   */
  showNotificationsBell?: boolean;
  /** Where the bell's "View all" link points. Default `/admin`. */
  notificationsHref?: string;
  /**
   * Show the onboarding progress ring (seeded first-run todos) in the header.
   * Auto-hides at 100% completion. Default true. Added in v2.7.
   */
  showOnboardingProgress?: boolean;
  /**
   * Optional content slot rendered in the header between the onboarding ring
   * and the notifications bell — typically a help dropdown with docs/support
   * links. Added in v2.7.
   */
  headerHelp?: ReactNode;
  /** Initial sidebar state when no saved preference exists. Default true (open). */
  defaultSidebarOpen?: boolean;
  children: ReactNode;
  className?: string;
}

const SIDEBAR_STATE_KEY = 'caspian:admin:sidebarOpen';
const GROUPS_STATE_KEY = 'caspian:admin:nav:groups';

const EXPANDED_SIDEBAR_WIDTH = 240;
const COLLAPSED_SIDEBAR_WIDTH = 56;

export function AdminShell({
  title = 'Admin',
  navItems = DEFAULT_ADMIN_NAV,
  headerRight,
  checkForUpdates = true,
  updateCheckOwner = DEFAULT_REPO_OWNER,
  updateCheckRepo = DEFAULT_REPO_NAME,
  showNotificationsBell = true,
  notificationsHref = '/admin',
  showOnboardingProgress = true,
  headerHelp,
  defaultSidebarOpen = true,
  children,
  className,
}: AdminShellProps) {
  const Link = useCaspianLink();
  const nav = useCaspianNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // v7.1.0 dynamic sidebar: enabled plugin installs appear as children
  // under any AdminNavGroup with id `plugins`. Re-fetches on window focus.
  const { installs: enabledInstalls } = useEnabledPluginInstalls();

  const navItemsWithDynamicPlugins = useMemo<AdminNavItem[]>(
    () => injectPluginChildren(navItems, enabledInstalls),
    [navItems, enabledInstalls],
  );

  const isActive = (href: string) =>
    nav.pathname === href || (href !== '/admin' && nav.pathname.startsWith(href));

  // Seed sidebar open/closed and per-group expanded state from localStorage.
  // Auto-expand the group containing the active route so a hard refresh on
  // `/admin/orders` lands with Sales already open.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STATE_KEY);
      if (saved === 'open') setSidebarOpen(true);
      else if (saved === 'closed') setSidebarOpen(false);
    } catch {
      /* no-op */
    }
    try {
      const raw = window.localStorage.getItem(GROUPS_STATE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      const seeded: Record<string, boolean> = { ...parsed };
      for (const item of navItemsWithDynamicPlugins) {
        if (isGroup(item)) {
          const containsActive = item.children.some((c) => isActive(c.href));
          if (containsActive) seeded[item.id] = true;
          else if (!(item.id in seeded)) seeded[item.id] = false;
        }
      }
      setExpandedGroups(seeded);
    } catch {
      /* no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, next ? 'open' : 'closed');
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(GROUPS_STATE_KEY, JSON.stringify(next));
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  // Flatten leaves for the collapsed-mode icon rail, preserving group order
  // with divider markers between groups.
  const railItems = useMemo<Array<AdminNavLeaf | { kind: 'divider'; id: string }>>(() => {
    const out: Array<AdminNavLeaf | { kind: 'divider'; id: string }> = [];
    let prevWasGroup = false;
    for (let i = 0; i < navItemsWithDynamicPlugins.length; i++) {
      const item = navItemsWithDynamicPlugins[i];
      if (isGroup(item)) {
        if (i > 0) out.push({ kind: 'divider', id: `div-before-${item.id}` });
        for (const c of item.children) out.push(c);
        prevWasGroup = true;
      } else {
        if (prevWasGroup) out.push({ kind: 'divider', id: `div-after-${item.href}` });
        out.push(item);
        prevWasGroup = false;
      }
    }
    return out;
  }, [navItemsWithDynamicPlugins]);

  const sidebarWidth = sidebarOpen ? EXPANDED_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH;

  return (
    <div
      className={cn('caspian-admin-shell', className)}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#fafafa',
      }}
    >
      <aside
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          borderRight: '1px solid #eee',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          transition: 'width 0.15s ease',
        }}
      >
        <div
          style={{
            padding: sidebarOpen ? '14px 16px' : '14px 0',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 49,
          }}
        >
          {sidebarOpen ? (
            <Link href="/admin">
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </span>
            </Link>
          ) : (
            <Link href="/admin" aria-label={title}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.04em',
                  color: '#111',
                }}
                title={title}
              >
                {title.slice(0, 1).toUpperCase()}
              </span>
            </Link>
          )}
        </div>

        {sidebarOpen ? (
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: 12,
              flex: 1,
            }}
          >
            {navItemsWithDynamicPlugins.map((item) =>
              isGroup(item) ? (
                <GroupNode
                  key={item.id}
                  group={item}
                  expanded={!!expandedGroups[item.id]}
                  onToggle={() => toggleGroup(item.id)}
                  isActive={isActive}
                  Link={Link}
                />
              ) : (
                <LeafLink key={item.href} leaf={item} active={isActive(item.href)} Link={Link} />
              ),
            )}
          </nav>
        ) : (
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '8px 0',
              flex: 1,
              alignItems: 'center',
            }}
          >
            {railItems.map((item) =>
              'kind' in item && item.kind === 'divider' ? (
                <hr
                  key={item.id}
                  style={{
                    width: '70%',
                    border: 0,
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    margin: '6px 0',
                  }}
                />
              ) : (
                <RailLink key={(item as AdminNavLeaf).href} leaf={item as AdminNavLeaf} active={isActive((item as AdminNavLeaf).href)} Link={Link} />
              ),
            )}
          </nav>
        )}
      </aside>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid #eee',
            background: '#fff',
            gap: 12,
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-pressed={sidebarOpen}
              style={{
                width: 36,
                height: 36,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0,0,0,0.1)',
                background: '#fff',
                borderRadius: 'var(--caspian-radius, 8px)',
                cursor: 'pointer',
                color: '#444',
                flexShrink: 0,
              }}
            >
              <MenuIcon size={18} />
            </button>
            {checkForUpdates && (
              <AdminUpdateBadge owner={updateCheckOwner} repo={updateCheckRepo} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showOnboardingProgress && <AdminOnboardingProgress />}
            {headerHelp}
            {showNotificationsBell && (
              <AdminNotificationsBell
                viewAllHref={notificationsHref}
                updateCheckOwner={updateCheckOwner}
                updateCheckRepo={updateCheckRepo}
                checkForUpdates={checkForUpdates}
              />
            )}
            {headerRight}
          </div>
        </header>

        <main style={{ flex: 1, minWidth: 0, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}

const leafRowStyle = (active: boolean, indent: number): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: `8px 12px 8px ${indent}px`,
  borderRadius: 'var(--caspian-radius, 6px)',
  background: active ? 'var(--caspian-primary, #111)' : 'transparent',
  color: active ? 'var(--caspian-primary-foreground, #fff)' : '#444',
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
});

function LeafLink({
  leaf,
  active,
  Link,
  indent = 12,
}: {
  leaf: AdminNavLeaf;
  active: boolean;
  Link: ReturnType<typeof useCaspianLink>;
  indent?: number;
}) {
  return (
    <Link
      href={leaf.href}
      className={cn('caspian-admin-nav-item', active && 'is-active')}
    >
      <span style={leafRowStyle(active, indent)}>
        {leaf.icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{leaf.icon}</span>}
        {leaf.label}
      </span>
    </Link>
  );
}

function RailLink({
  leaf,
  active,
  Link,
}: {
  leaf: AdminNavLeaf;
  active: boolean;
  Link: ReturnType<typeof useCaspianLink>;
}) {
  return (
    <Link
      href={leaf.href}
      aria-label={leaf.label}
      className={cn('caspian-admin-nav-item', active && 'is-active')}
    >
      <span
        title={leaf.label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 'var(--caspian-radius, 6px)',
          background: active ? 'var(--caspian-primary, #111)' : 'transparent',
          color: active ? 'var(--caspian-primary-foreground, #fff)' : '#444',
          textDecoration: 'none',
        }}
      >
        {leaf.icon ?? leaf.label.slice(0, 1).toUpperCase()}
      </span>
    </Link>
  );
}

function GroupNode({
  group,
  expanded,
  onToggle,
  isActive,
  Link,
}: {
  group: AdminNavGroup;
  expanded: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
  Link: ReturnType<typeof useCaspianLink>;
}) {
  const groupActive =
    (group.href && isActive(group.href)) ||
    group.children.some((c) => isActive(c.href));

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    borderRadius: 'var(--caspian-radius, 6px)',
    color: groupActive ? '#111' : '#444',
    fontSize: 14,
    fontWeight: groupActive ? 600 : 500,
  };

  const labelInnerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    flex: 1,
    minWidth: 0,
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: 0,
    textAlign: 'left',
    font: 'inherit',
  };

  const labelContent = (
    <>
      {group.icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{group.icon}</span>}
      <span style={{ flex: 1 }}>{group.label}</span>
    </>
  );

  return (
    <div>
      <div style={rowStyle}>
        {group.href ? (
          <Link href={group.href} style={labelInnerStyle}>
            {labelContent}
          </Link>
        ) : (
          <button type="button" onClick={onToggle} style={labelInnerStyle} aria-expanded={expanded}>
            {labelContent}
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse group' : 'Expand group'}
          aria-expanded={expanded}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            padding: '8px 10px',
            borderRadius: 'var(--caspian-radius, 6px)',
            color: '#999',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <ChevronDownIcon size={14} />
          </span>
        </button>
      </div>

      {expanded && (
        <div
          style={{
            marginLeft: 16,
            paddingLeft: 12,
            borderLeft: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            marginTop: 2,
          }}
        >
          {group.children.map((child) => (
            <LeafLink
              key={child.href}
              leaf={child}
              active={isActive(child.href)}
              Link={Link}
              indent={12}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminUpdateBadge({ owner, repo }: { owner: string; repo: string }) {
  const Link = useCaspianLink();
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRecentReleases(owner, repo, 1)
      .then((releases) => {
        if (!alive) return;
        const v = releases[0]?.version;
        if (v) setLatest(v);
      })
      .catch(() => {
        // Silent — badge is a nicety, not a hard requirement.
      });
    return () => {
      alive = false;
    };
  }, [owner, repo]);

  if (!latest || !isUpdateAvailable(CASPIAN_STORE_VERSION, latest)) return null;

  return (
    <Link href="/admin/about">
      <span style={{ textDecoration: 'none' }}>
        <Badge>Update available →</Badge>
      </span>
    </Link>
  );
}

/**
 * Returns a copy of `items` where any AdminNavGroup with id `plugins` has
 * its `children` replaced with a leaf per enabled install. Called on every
 * render of AdminShell so enabling/disabling a plugin updates the sidebar
 * without a page reload. Keeps other groups untouched.
 */
function injectPluginChildren(
  items: AdminNavItem[],
  installs: EnabledPluginInstall[],
): AdminNavItem[] {
  return items.map((item) => {
    if (!isGroup(item) || item.id !== 'plugins') return item;
    const children: AdminNavLeaf[] = installs.map((x) => ({
      href: `/admin/plugins/${x.pluginId}/${x.installId}`,
      label: x.name,
      icon: iconForPluginCategory(x.category),
    }));
    return { ...item, children };
  });
}

function iconForPluginCategory(category: EnabledPluginCategory): ReactNode {
  switch (category) {
    case 'shipping':
      return <TruckIcon size={ICON_SIZE} />;
    case 'payment':
      return <CreditCardIcon size={ICON_SIZE} />;
    case 'email':
      return <AtSignIcon size={ICON_SIZE} />;
  }
}
