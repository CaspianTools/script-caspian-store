'use client';

import { forwardRef, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from 'react';
import { FieldDescription } from '../../../ui/field-description';
import { cn } from '../../../utils/cn';

export interface PosFieldProps {
  label: string;
  children: ReactNode;
  /** Muted help text under the control. */
  help?: ReactNode;
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
export function PosField({ label, children, help, style, className, asDiv }: PosFieldProps) {
  const Tag = asDiv ? 'div' : 'label';
  return (
    <Tag className={cn('cpos-field', className)} style={style}>
      <span className="cpos-field__label">{label}</span>
      {children}
      {help ? <FieldDescription>{help}</FieldDescription> : null}
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
