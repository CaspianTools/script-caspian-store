'use client';

import type { CSSProperties, ReactNode } from 'react';

export interface FieldDescriptionProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * Muted helper text placed under a form control to explain what a setting
 * does. Matches the 13px / #666 / 4px-top-margin convention used across the
 * admin site-settings page so new sections look uniform.
 */
export function FieldDescription({ children, style, className }: FieldDescriptionProps) {
  return (
    <p
      className={className}
      style={{
        color: 'var(--cpos-fg-muted, #666)',
        fontSize: 13,
        margin: '4px 0 0',
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </p>
  );
}
