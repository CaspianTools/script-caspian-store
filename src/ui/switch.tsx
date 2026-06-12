'use client';

import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface SwitchProps {
  /** On/off state. */
  checked: boolean;
  /** Called with the next state when toggled. */
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /**
   * Optional label rendered to the right of the switch. When provided, the
   * component renders a row (`<label>` wrapping the switch + text) so clicking
   * the text also toggles. Omit for a bare switch you lay out yourself.
   */
  label?: ReactNode;
  /** Optional helper text under the label (only used together with `label`). */
  description?: ReactNode;
  /** Accessible name for the bare switch. Falls back to a string `label`. */
  ariaLabel?: string;
  id?: string;
  className?: string;
}

/**
 * On/off toggle switch — the standard control for enabling/disabling a setting
 * or feature (languages, feature flags, opt-ins, …). For *selecting* rows or
 * items from a set, keep a native checkbox instead.
 *
 * Self-styled (inline) so it renders identically in the admin and the
 * storefront. The "on" colour uses the storefront primary token with a dark
 * fallback.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  description,
  ariaLabel,
  id,
  className,
}: SwitchProps) {
  const knob = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn('caspian-switch', !label && className)}
      style={{
        position: 'relative',
        width: 38,
        height: 22,
        flexShrink: 0,
        padding: 0,
        border: 0,
        borderRadius: 999,
        background: checked ? 'var(--caspian-primary, #111)' : 'rgba(0,0,0,0.22)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );

  if (label === undefined) return knob;

  // Row is clickable for a larger hit target; the switch button stops
  // propagation so a click on it doesn't also trigger the row handler
  // (which would double-toggle).
  return (
    <div
      className={cn('caspian-switch-row', className)}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: description ? 'flex-start' : 'center',
        gap: 10,
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
        {knob}
      </span>
      <span>
        {label}
        {description}
      </span>
    </div>
  );
}
