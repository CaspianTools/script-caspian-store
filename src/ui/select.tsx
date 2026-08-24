'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  className?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, className, style, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn('caspian-select', className)}
      style={{
        padding: '8px 28px 8px 12px',
        border: '1px solid var(--cpos-border-strong, rgba(0,0,0,0.15))',
        borderRadius: 'var(--caspian-radius, 6px)',
        fontSize: 14,
        background: 'var(--cpos-surface, #fff)',
        color: 'var(--cpos-fg, inherit)',
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = 'Select';
