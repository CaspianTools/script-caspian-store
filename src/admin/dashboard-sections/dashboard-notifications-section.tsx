'use client';

import { useCaspianLink } from '../../provider/caspian-store-provider';
import { useT } from '../../i18n/locale-context';
import {
  useAdminNotifications,
  type AdminNotification,
  type AdminNotificationKind,
  type UseAdminNotificationsOptions,
} from '../../hooks/use-admin-notifications';
import { Button } from '../../ui/button';
import { RefreshIcon } from '../../ui/icons';
import { Badge, Skeleton } from '../../ui/misc';
import { DashboardSection } from './dashboard-section';

const KIND_LABEL_KEY: Record<AdminNotificationKind, string> = {
  'update-available': 'admin.dashboard.notifications.kind.update',
  'pending-reviews': 'admin.dashboard.notifications.kind.moderation',
  'pending-questions': 'admin.dashboard.notifications.kind.moderation',
  'new-contacts': 'admin.dashboard.notifications.kind.inbox',
};

export interface DashboardNotificationsSectionProps extends UseAdminNotificationsOptions {
  className?: string;
}

export function DashboardNotificationsSection(options: DashboardNotificationsSectionProps) {
  const { notifications, loading, refresh, unreadCount } = useAdminNotifications(options);
  const t = useT();

  return (
    <DashboardSection
      title={t('admin.dashboard.notifications.title')}
      subtitle={t('admin.dashboard.notifications.subtitle')}
      count={unreadCount}
      defaultOpen={unreadCount > 0}
      anchorId="notifications"
      action={
        <Button variant="outline" size="sm" onClick={refresh} loading={loading}>
          <RefreshIcon size={14} /> {t('admin.dashboard.notifications.refresh')}
        </Button>
      }
    >
      {loading && notifications.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 72 }} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: '#888',
            border: '1px dashed #ddd',
            borderRadius: 8,
          }}
        >
          {t('admin.dashboard.notifications.empty')}
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {notifications.map((n) => (
            <NotificationCard key={n.id} notification={n} />
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

function NotificationCard({ notification }: { notification: AdminNotification }) {
  const Link = useCaspianLink();
  const t = useT();
  const inner = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        background: '#fff',
        cursor: notification.href ? 'pointer' : 'default',
      }}
    >
      <Badge variant="outline">
        {KIND_LABEL_KEY[notification.kind] ? t(KIND_LABEL_KEY[notification.kind]) : notification.kind}
      </Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{notification.title}</div>
        {notification.description && (
          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{notification.description}</div>
        )}
      </div>
      {notification.createdAt && (
        <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
          {formatRelative(notification.createdAt, t)}
        </div>
      )}
    </div>
  );
  return (
    <li>{notification.href ? <Link href={notification.href}>{inner}</Link> : inner}</li>
  );
}

function formatRelative(iso: string, t: ReturnType<typeof useT>): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return t('admin.dashboard.relative.today');
  if (diff < 2 * day) return t('admin.dashboard.relative.yesterday');
  if (diff < 30 * day) return t('admin.dashboard.relative.daysAgo', { count: Math.floor(diff / day) });
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
