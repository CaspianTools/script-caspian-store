'use client';

import { useT } from '../../i18n/locale-context';
import { Skeleton } from '../../ui/misc';
import type { ShippingRate } from '../../shipping/types';

export interface ShippingRatePickerProps {
  rates: ShippingRate[] | null;
  selectedInstallId: string | null;
  onSelect: (rate: ShippingRate) => void;
  formatPrice: (n: number) => string;
  className?: string;
}

export function ShippingRatePicker({
  rates,
  selectedInstallId,
  onSelect,
  formatPrice,
  className,
}: ShippingRatePickerProps) {
  const t = useT();

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
