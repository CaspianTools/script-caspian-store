import type { BusinessHoursSchedule, Weekday } from '../types';

/** Weekdays in display order (Monday → Sunday). */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Default schedule: Mon–Fri 09:00–17:00 open, weekend closed, feature off.
 * `timezone: ''` defers to `SiteSettings.timezone` at render time.
 */
export const DEFAULT_BUSINESS_HOURS: BusinessHoursSchedule = {
  enabled: false,
  timezone: '',
  days: {
    mon: { open: true, from: '09:00', to: '17:00' },
    tue: { open: true, from: '09:00', to: '17:00' },
    wed: { open: true, from: '09:00', to: '17:00' },
    thu: { open: true, from: '09:00', to: '17:00' },
    fri: { open: true, from: '09:00', to: '17:00' },
    sat: { open: false, from: '09:00', to: '17:00' },
    sun: { open: false, from: '09:00', to: '17:00' },
  },
};

/**
 * Format a stored `'HH:MM'` (24h) time as a 12-hour label — `'09:00'` →
 * `'9:00 AM'`, `'17:30'` → `'5:30 PM'`. Returns `''` for empty/malformed input.
 * Pure and server-safe (no `Intl`/locale dependency).
 */
export function formatHourLabel(hhmm: string): string {
  if (!hhmm) return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
