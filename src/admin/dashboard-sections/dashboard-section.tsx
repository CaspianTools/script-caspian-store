'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '../../ui/icons';
import { Badge } from '../../ui/misc';
import { cn } from '../../utils/cn';

/**
 * Shared collapsible section used on the admin Dashboard. Folds in the
 * content that lived on the standalone /admin/todos, /admin/notifications,
 * and /admin/search-terms pages before v3.0.0.
 */
export interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  /** Badge count shown in the header — 0 hides the badge. */
  count?: number;
  /** Header action slot — e.g. a "Refresh" or "Clear all" button. */
  action?: ReactNode;
  /** Whether the section is expanded on first render. Default: true. */
  defaultOpen?: boolean;
  /**
   * Stable id used for the section anchor (e.g. `#notifications`) and to
   * persist the expand/collapse state in localStorage so a user who closes
   * Search terms keeps it closed on the next visit.
   */
  anchorId: string;
  className?: string;
  children: ReactNode;
}

const STORAGE_KEY_PREFIX = 'caspian:admin:dashboardSection:';

export function DashboardSection({
  title,
  subtitle,
  count,
  action,
  defaultOpen = true,
  anchorId,
  className,
  children,
}: DashboardSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  // `null` until the first effect runs, then the persisted preference (if
  // any). A saved preference always beats `defaultOpen`, which callers derive
  // from data that is still loading on first render.
  const savedPreference = useRef<'open' | 'closed' | null | undefined>(undefined);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_PREFIX + anchorId);
      savedPreference.current = saved === 'open' || saved === 'closed' ? saved : null;
      if (saved === 'open') setOpen(true);
      else if (saved === 'closed') setOpen(false);
    } catch {
      savedPreference.current = null;
    }
    // Open + scroll to the section when the URL hash names it, so the header
    // bell's "View all" link (`/admin#notifications`) lands directly on it.
    // Runs on mount and on every later hash change (the dashboard may already
    // be mounted when the bell link is clicked, so a mount-only check would
    // miss it).
    const syncHash = () => {
      if (window.location.hash !== `#${anchorId}`) return;
      setOpen(true);
      setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [anchorId]);

  // `defaultOpen` is computed from async data (pending counts), so it usually
  // flips from false to true after mount. Honour that flip unless the user has
  // an explicit saved preference for this section.
  useEffect(() => {
    if (defaultOpen && savedPreference.current === null) setOpen(true);
  }, [defaultOpen]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY_PREFIX + anchorId, next ? 'open' : 'closed');
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  return (
    <section
      id={anchorId}
      className={cn('caspian-admin-dashboard-section', className)}
      style={{
        marginTop: 24,
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 16px',
          borderBottom: open ? '1px solid #eee' : 'none',
          background: '#fff',
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${anchorId}-body`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 0,
            background: 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#666',
            flexShrink: 0,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <ChevronDownIcon size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
            {typeof count === 'number' && count > 0 && (
              <Badge variant="secondary">{count}</Badge>
            )}
          </div>
          {subtitle && (
            <p style={{ margin: '2px 0 0', color: '#666', fontSize: 13 }}>{subtitle}</p>
          )}
        </div>
        {action}
      </header>

      {open && (
        <div id={`${anchorId}-body`} style={{ padding: 16 }}>
          {children}
        </div>
      )}
    </section>
  );
}
