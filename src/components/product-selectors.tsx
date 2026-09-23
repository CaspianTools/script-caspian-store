'use client';

import type { ColorVariant } from '../types';
import { cn } from '../utils/cn';
import { useT } from '../i18n/locale-context';
import { useCaspianImage } from '../provider/caspian-store-provider';

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

export interface ColorSelectorProps {
  variants: ColorVariant[];
  value?: string;
  onChange: (colorName: string) => void;
  className?: string;
}

/**
 * Image-swatch picker for `Product.colorVariants`. Each swatch shows the
 * variant's own image; the chosen name is what lands on the cart line as
 * `selectedColor`. Renders nothing when the product has no variants.
 */
export function ColorSelector({ variants, value, onChange, className }: ColorSelectorProps) {
  const Image = useCaspianImage();
  if (variants.length === 0) return null;
  return (
    <div
      className={cn('caspian-color-selector', className)}
      role="group"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
    >
      {variants.map((v) => {
        const active = v.name === value;
        return (
          <button
            key={v.name}
            type="button"
            onClick={() => onChange(v.name)}
            aria-pressed={active}
            aria-label={v.name}
            title={v.name}
            style={{
              position: 'relative',
              width: 56,
              height: 56,
              padding: 0,
              overflow: 'hidden',
              border: `2px solid ${active ? 'var(--caspian-primary, #111)' : 'rgba(0,0,0,0.12)'}`,
              borderRadius: 'var(--caspian-radius, 6px)',
              background: 'rgba(0,0,0,0.04)',
              cursor: 'pointer',
            }}
          >
            {v.imageUrl ? (
              <Image src={v.imageUrl} alt={v.name} fill />
            ) : (
              <span style={{ fontSize: 11, padding: 4 }}>{v.name}</span>
            )}
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
  const t = useT();
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn: React.CSSProperties = {
    width: 44,
    height: 44,
    flexShrink: 0,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
    color: 'inherit',
  };
  return (
    <div
      className={cn('caspian-quantity', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: 'var(--caspian-radius, 6px)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        aria-label={t('product.quantity.decrease')}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        style={{ ...btn, opacity: value <= min ? 0.4 : 1 }}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={t('product.quantity')}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        style={{
          width: 44,
          height: 44,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 600,
          border: 0,
          borderLeft: '1px solid rgba(0,0,0,0.1)',
          borderRight: '1px solid rgba(0,0,0,0.1)',
          background: 'transparent',
          color: 'inherit',
          outline: 'none',
          padding: 0,
        }}
      />
      <button
        type="button"
        aria-label={t('product.quantity.increase')}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        style={{ ...btn, opacity: value >= max ? 0.4 : 1 }}
      >
        +
      </button>
    </div>
  );
}
