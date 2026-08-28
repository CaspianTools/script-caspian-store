'use client';

import { forwardRef, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from 'react';
import { FieldDescription, cn } from '@caspian-explorer/script-caspian-store';

export interface PosFieldProps {
  label: string;
  children: ReactNode;
  /** Muted help text under the control. */
  help?: ReactNode;
  /**
   * What is wrong with what is in the control, in the danger tone. Replaces
   * `help` while it is set rather than stacking under it: two sentences under
   * one field is where a cashier stops reading either.
   *
   * Announced as part of the field's accessible NAME, not as a description,
   * because `PosField` renders a `<label>` wrapping its control. That reads
   * "Price, An item needs a price" without any id plumbing, which is the
   * behaviour wanted here -- the caller still sets `aria-invalid` on the
   * control itself so the state is exposed as well as the reason.
   */
  error?: string;
  /**
   * A flex basis, and nothing else.
   *
   * Every form in the till is `.cpos-row` holding fields of different widths --
   * a name wants twice a price -- and that basis is genuinely per-field. It is
   * the one inline value `pos/DESIGN.md` allows here.
   */
  style?: CSSProperties;
  className?: string;
  /**
   * Renders a `<div>` instead of a `<label>`. For a control that is not a single
   * form element -- a pair of radios, a group of buttons -- where wrapping it in
   * a label would make clicking the group focus the first child.
   */
  asDiv?: boolean;
}

/**
 * Label, control, help text. The shape every form field in the till has.
 *
 * Replaces the `field` / `fieldLabel` inline-style pair from the old
 * `panel-styles.ts`, which ten panels imported and which is now gone.
 */
export function PosField({
  label,
  children,
  help,
  error,
  style,
  className,
  asDiv,
}: PosFieldProps) {
  const Tag = asDiv ? 'div' : 'label';
  return (
    <Tag className={cn('cpos-field', className)} style={style}>
      <span className="cpos-field__label">{label}</span>
      {children}
      {error ? <span className="cpos-field__error">{error}</span> : null}
      {!error && help ? <FieldDescription>{help}</FieldDescription> : null}
    </Tag>
  );
}

export interface PosSelectOption {
  value: string;
  label: string;
}

export interface PosSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: PosSelectOption[];
}

/**
 * A dropdown on `.cpos-select`.
 *
 * The one wrapper the till keeps for a plain control, because eight call sites
 * hand it an options array and mapping that to `<option>` elements at each of
 * them is eight chances to forget the `key`. The signature deliberately matches
 * the `<Select>` it replaced, so the ports were mechanical.
 */
export const PosSelect = forwardRef<HTMLSelectElement, PosSelectProps>(
  ({ options, className, ...rest }, ref) => (
    <select ref={ref} className={cn('cpos-select', className)} {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
);
PosSelect.displayName = 'PosSelect';

export interface PosCheckProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** A second line under the label. */
  description?: string;
  disabled?: boolean;
}

/** A checkbox row on `.cpos-check`, sized to the register's touch floor. */
export function PosCheck({ checked, onChange, label, description, disabled }: PosCheckProps) {
  return (
    <label className={cn('cpos-check', checked && 'cpos-check--on')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="cpos-check__text">
        <span>{label}</span>
        {description ? <span className="cpos-check__sub">{description}</span> : null}
      </span>
    </label>
  );
}
