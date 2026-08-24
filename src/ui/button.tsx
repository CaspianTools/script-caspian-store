'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

const base =
  'caspian-btn caspian-inline-flex caspian-items-center caspian-justify-center';

function styleFor(variant: ButtonVariant, size: ButtonSize): React.CSSProperties {
  const sizing: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: 13, height: 32 },
    md: { padding: '8px 16px', fontSize: 14, height: 40 },
    lg: { padding: '12px 24px', fontSize: 15, height: 48 },
    icon: { width: 36, height: 36, padding: 0 },
  };
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--caspian-primary, #111)',
      color: 'var(--caspian-primary-foreground, #fff)',
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: 'inherit',
      border: '1px solid var(--cpos-border-strong, rgba(0,0,0,0.15))',
    },
    ghost: {
      background: 'transparent',
      color: 'inherit',
      border: '1px solid transparent',
    },
    destructive: {
      background: '#dc2626',
      color: '#fff',
      border: '1px solid transparent',
    },
  };
  return {
    ...sizing[size],
    ...variants[variant],
    borderRadius: 'var(--caspian-radius, 8px)',
    fontWeight: 500,
    cursor: 'pointer',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'opacity 0.15s, transform 0.05s',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, disabled, className, style, children, ...rest },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        className={cn(base, className)}
        disabled={isDisabled}
        style={{
          ...styleFor(variant, size),
          opacity: isDisabled ? 0.6 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
