'use client';

import { useT } from '../i18n/locale-context';
import { Input, Label } from './input';

export interface ColorFieldProps {
  label?: string;
  /** Current value — a CSS color string. Empty = unset. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

/**
 * `<input type="color">` only accepts `#rrggbb`; shorthand and alpha forms
 * are valid CSS but leave the swatch black, so widen/truncate for the swatch
 * only — the text field keeps whatever the admin typed.
 */
function swatchHex(value: string): string {
  const m = /^#([0-9a-fA-F]{3,8})$/.exec(value);
  if (!m) return '#000000';
  const h = m[1];
  if (h.length === 6) return `#${h}`;
  if (h.length === 8) return `#${h.slice(0, 6)}`;
  if (h.length === 3 || h.length === 4) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return '#000000';
}

/**
 * Color control: a native swatch picker paired with a free-text field (so
 * `transparent`, `rgba(...)`, or a token can be typed) and a clear button.
 * Empty value = inherit / no override.
 */
export function ColorField({ label, value, onChange, ariaLabel }: ColorFieldProps) {
  const t = useT();
  const hex = swatchHex(value);
  return (
    <div className="pb-field">
      {label && <Label>{label}</Label>}
      <div className="pb-color-field">
        <input
          type="color"
          className="pb-color-swatch"
          aria-label={ariaLabel ?? label ?? 'Color'}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#111111" />
        {value ? (
          <button
            type="button"
            className="pb-color-clear"
            title={t('colorField.clear')}
            aria-label={t('colorField.clear')}
            onClick={() => onChange('')}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
