'use client';

import type { CSSProperties } from 'react';
import type { BusinessHoursSchedule } from '../../types';
import { WEEKDAYS, formatHourLabel } from '../../utils/business-hours';
import { useT } from '../../i18n/locale-context';
import { cn } from '../../utils/cn';

/**
 * Storefront rendering of the structured weekly business hours. Renders nothing
 * unless the schedule is enabled. Day names + the "Closed" label come from
 * i18n; times are shown 12-hour via `formatHourLabel`.
 */
export function BusinessHoursCard({
  schedule,
  className,
}: {
  schedule: BusinessHoursSchedule;
  className?: string;
}) {
  const t = useT();
  if (!schedule.enabled) return null;

  return (
    <aside className={cn('caspian-business-hours', className)} style={cardStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>{t('businessHours.title')}</h2>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {WEEKDAYS.map((day) => {
          const d = schedule.days[day];
          return (
            <div
              key={day}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14 }}
            >
              <dt style={{ color: '#555' }}>{t(`businessHours.day.${day}`)}</dt>
              <dd style={{ margin: 0, fontWeight: 500, color: d.open ? '#111' : '#999' }}>
                {d.open
                  ? `${formatHourLabel(d.from)} – ${formatHourLabel(d.to)}`
                  : t('businessHours.closed')}
              </dd>
            </div>
          );
        })}
      </dl>
      {schedule.timezone ? (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#888' }}>
          {t('businessHours.timezoneNote', { tz: schedule.timezone })}
        </p>
      ) : null}
    </aside>
  );
}

const cardStyle: CSSProperties = {
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 'var(--caspian-radius, 8px)',
  padding: 20,
  background: '#fff',
};
