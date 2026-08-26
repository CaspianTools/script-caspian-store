'use client';

import type { ReactNode } from 'react';
import { cn } from '@caspian-explorer/script-caspian-store';

export interface PosSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /**
   * What the switch turns on, for a screen reader.
   *
   * Required rather than optional: the switch has no text of its own — that is
   * the point of it — so without this it announces as an unnamed control.
   */
  label: string;
}

/**
 * A switch, for a setting that lands the moment it is flipped.
 *
 * The library's `<Switch>` could not be reused. It is 38x22, half the
 * register's 44px touch floor, and it hardcodes `rgba(0,0,0,0.22)` and `#fff`,
 * neither of them a `--cpos-*` token, so on a till in dark mode it is
 * near-black on near-black. It gets away with that at `/admin/pos` only because
 * that surface is always light.
 *
 * This replaced the two-button `.cpos-choices` group App admin used to carry,
 * which named both states in words. That was the safer shape while the page had
 * four settings on it; it stops being safer at forty, where a column of
 * Ask-for-it / Do-not-ask pairs is harder to read down than a column of knobs
 * that are either at the left or at the right.
 */
export function PosSwitch({ checked, onChange, disabled, label }: PosSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn('cpos-switch', checked && 'cpos-switch--on')}
      onClick={() => onChange(!checked)}
    >
      <span className="cpos-switch__knob" />
    </button>
  );
}

export interface PosSwitchRowProps {
  /** The setting, said as the label of its own switch. */
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

/** A setting stated as a sentence, with its switch at the end of the line. */
export function PosSwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: PosSwitchRowProps) {
  return (
    <div className="cpos-switchrow">
      <span className="cpos-switchrow__text">
        <span className="cpos-switchrow__title">{title}</span>
        {description ? <span className="cpos-switchrow__sub">{description}</span> : null}
      </span>
      <PosSwitch checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}
