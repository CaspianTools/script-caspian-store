'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--cpos-border-strong, rgba(0,0,0,0.15))',
  borderRadius: 'var(--caspian-radius, 6px)',
  fontSize: 14,
  outline: 'none',
  background: 'var(--cpos-surface, #fff)',
  color: 'var(--cpos-fg, inherit)',
  boxSizing: 'border-box',
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, style, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn('caspian-input', className)}
      style={{ ...inputStyle, ...style }}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, style, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn('caspian-textarea', className)}
    style={{ ...inputStyle, minHeight: 80, lineHeight: 1.5, fontFamily: 'inherit', ...style }}
    {...rest}
  />
));
Textarea.displayName = 'Textarea';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, style, ...rest }, ref) => (
    <label
      ref={ref}
      className={cn('caspian-label', className)}
      style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 4,
        ...style,
      }}
      {...rest}
    />
  ),
);
Label.displayName = 'Label';
