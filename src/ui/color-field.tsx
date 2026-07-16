'use client';

import { Input, Label } from './input';

export interface ColorFieldProps {
  label?: string;
  /** Current value — a CSS color string. Empty = unset. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

/**
 * Color control: a native swatch picker paired with a free-text field (so
 * `transparent`, `rgba(...)`, or a token can be typed) and a clear button.
 * Empty value = inherit / no override.
 */
export function ColorField({ label, value, onChange, ariaLabel }: ColorFieldProps) {
  const hex = /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#000000';
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
            title="Clear"
            aria-label="Clear color"
            onClick={() => onChange('')}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
