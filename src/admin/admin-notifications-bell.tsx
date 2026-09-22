'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { BellIcon } from '../ui/icons';
import {
  useAdminNotifications,
  type AdminNotification,
  type UseAdminNotificationsOptions,
} from '../hooks/use-admin-notifications';

export interface AdminNotificationsBellProps extends UseAdminNotificationsOptions {
  /** Where the "View all" link points. Default `/admin#notifications` (v3.0.0+). */
  viewAllHref?: string;
  className?: string;
}

export function AdminNotificationsBell({
  viewAllHref = '/admin#notifications',
  className,
  ...options
}: AdminNotificationsBellProps) {
  const Link = useCaspianLink();
  const t = useT();
  const { notifications, unreadCount } = useAdminNotifications(options);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    // Move focus into the panel so keyboard users land on the notifications
    // rather than tabbing through the rest of the header first.
    const first = panelRef.current?.querySelector<HTMLElement>('a, button');
    (first ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const preview = notifications.slice(0, 5);

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          unreadCount > 0
            ? t('admin.notificationsBell.labelWithCount', { count: unreadCount })
            : t('admin.notificationsBell.label')
        }
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'relative',
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
        }}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--caspian-primary, #111)',
              color: 'var(--caspian-primary-foreground, #fff)',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px #fff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={t('admin.notificationsBell.label')}
          tabIndex={-1}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 'var(--caspian-radius, 8px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid #f0f0f0',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>{t('admin.notificationsBell.label')}</span>
            <span style={{ color: '#888', fontWeight: 400 }}>
              {unreadCount === 0
                ? t('admin.notificationsBell.allClear')
                : t('admin.notificationsBell.unread', { count: unreadCount })}
            </span>
          </div>

          {preview.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
              {t('admin.notificationsBell.empty')}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {preview.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onSelect={() => setOpen(false)}
                />
              ))}
            </ul>
          )}

          <Link href={viewAllHref}>
            <div
              onClick={() => setOpen(false)}
              style={{
                padding: '10px 14px',
                borderTop: '1px solid #f0f0f0',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
                color: 'var(--caspian-primary, #111)',
                cursor: 'pointer',
              }}
            >
              {t('admin.notificationsBell.viewAll')}
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onSelect,
}: {
  notification: AdminNotification;
  onSelect?: () => void;
}) {
  const Link = useCaspianLink();
  const content = (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderBottom: '1px solid #f5f5f5',
        cursor: notification.href ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          minWidth: 8,
          marginTop: 6,
          borderRadius: '50%',
          background: 'var(--caspian-primary, #111)',
        }}
        aria-hidden
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{notification.title}</div>
        {notification.description && (
          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {notification.description}
          </div>
        )}
      </div>
    </div>
  );
  return notification.href ? (
    <li>
      <Link href={notification.href}>{content}</Link>
    </li>
  ) : (
    <li>{content}</li>
  );
}
