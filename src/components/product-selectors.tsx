'use client';

import { cn } from '../utils/cn';
import { useT } from '../i18n/locale-context';

export interface SizeSelectorProps {
  sizes: string[];
  value?: string;
  onChange: (size: string) => void;
  className?: string;
  /**
   * Optional set of size strings that should render disabled (struck-through),
   * e.g. those at or below the merchant's out-of-stock threshold. Added in v2.9.
   */
  outOfStock?: string[];
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  className,
  outOfStock,
}: SizeSelectorProps) {
  const t = useT();
  const disabledSet = new Set(outOfStock ?? []);
  return (
    <div className={cn('caspian-size-selector', className)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {sizes.map((s) => {
        const active = s === value;
        const disabled = disabledSet.has(s);
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            title={disabled ? t('storefront.stock.outOfStock') : undefined}
            aria-pressed={active}
            style={{
              minWidth: 48,
              padding: '8px 12px',
              border: `1px solid ${active ? 'var(--caspian-primary, #111)' : 'rgba(0,0,0,0.15)'}`,
              background: active ? 'var(--caspian-primary, #111)' : 'transparent',
              color: disabled
                ? '#aaa'
                : active
                  ? 'var(--caspian-primary-foreground, #fff)'
                  : 'inherit',
              borderRadius: 'var(--caspian-radius, 6px)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: disabled ? 'line-through' : undefined,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn: React.CSSProperties = {
    width: 36,
    height: 36,
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
  };
  return (
    <div
      className={cn('caspian-quantity', className)}
      style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--caspian-radius, 6px)', overflow: 'hidden' }}
    >
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(clamp(value - 1))} style={btn}>
        −
      </button>
      <span style={{ minWidth: 40, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{value}</span>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(clamp(value + 1))} style={btn}>
        +
      </button>
    </div>
  );
}
