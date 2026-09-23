'use client';

import { useLocale, useT } from '../../i18n/locale-context';
import { Skeleton } from '../../ui/misc';
import type { ShippingRate } from '../../shipping/types';

export interface ShippingRatePickerProps {
  rates: ShippingRate[] | null;
  selectedInstallId: string | null;
  onSelect: (rate: ShippingRate) => void;
  formatPrice: (n: number) => string;
  className?: string;
}

/**
 * "Jun 3 – Jun 5": the calendar dates a rate's `estimatedDays` window lands
 * on, counted from `from` (today). Shoppers plan around dates, not day
 * counts. Returns '' when the window is missing or not a number.
 */
export function formatDeliveryWindow(
  estimatedDays: { min: number; max: number } | undefined,
  locale: string,
  from: Date = new Date(),
): string {
  const min = Number(estimatedDays?.min);
  const max = Number(estimatedDays?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
  const addDays = (n: number) => {
    const d = new Date(from);
    d.setDate(d.getDate() + n);
    return d;
  };
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  } catch {
    fmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
  }
  const first = fmt.format(addDays(min));
  return min === max ? first : `${first} – ${fmt.format(addDays(Math.max(min, max)))}`;
}

export function ShippingRatePicker({
  rates,
  selectedInstallId,
  onSelect,
  formatPrice,
  className,
}: ShippingRatePickerProps) {
  const t = useT();
  const locale = useLocale();

  if (rates === null) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton style={{ height: 48 }} />
        <Skeleton style={{ height: 48 }} />
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <p className={className} style={{ color: '#888', fontSize: 13, margin: 0 }}>
        {t('checkout.rate.noRatesAvailable')}
      </p>
    );
  }

  return (
    <div
      className={className}
      role="radiogroup"
      aria-label={t('checkout.rate.selectLabel')}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {rates.map((rate) => {
        const selected = rate.installId === selectedInstallId;
        return (
          <label
            key={rate.installId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 56,
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              border: `1px solid ${selected ? 'var(--caspian-primary, #111)' : '#e5e5e5'}`,
              borderRadius: 'var(--caspian-radius, 6px)',
              cursor: 'pointer',
              background: selected ? 'rgba(17,17,17,0.03)' : '#fff',
            }}
          >
            <input
              type="radio"
              name="caspian-shipping-rate"
              checked={selected}
              onChange={() => onSelect(rate)}
              style={{ margin: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{rate.label}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                {rate.estimatedDays.min === rate.estimatedDays.max
                  ? `${rate.estimatedDays.min} ${t('checkout.rate.daysSuffix')}`
                  : `${rate.estimatedDays.min}–${rate.estimatedDays.max} ${t('checkout.rate.daysSuffix')}`}
                {(() => {
                  const dates = formatDeliveryWindow(rate.estimatedDays, locale);
                  return dates ? ` · ${t('checkout.rate.arrives', { dates })}` : '';
                })()}
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {rate.price > 0 ? formatPrice(rate.price) : t('checkout.rate.free')}
            </div>
          </label>
        );
      })}
    </div>
  );
}
