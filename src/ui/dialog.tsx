'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidth?: number;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  zIndex: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const panelStyle: React.CSSProperties = {
  background: 'var(--cpos-surface, #fff)',
  color: 'var(--cpos-fg, #111)',
  border: '1px solid var(--cpos-border, transparent)',
  borderRadius: 'var(--caspian-radius, 8px)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  width: '100%',
  boxSizing: 'border-box',
  maxHeight: '90vh',
  overflow: 'auto',
  padding: 24,
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  maxWidth = 480,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className={cn('caspian-dialog', className)}
        style={{ ...panelStyle, maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <header style={{ marginBottom: 16 }}>
            {title && <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h2>}
            {description && (
              <p style={{ color: 'var(--cpos-fg-muted, #666)', fontSize: 14, marginTop: 4, marginBottom: 0 }}>
                {description}
              </p>
            )}
          </header>
        )}
        <div>{children}</div>
        {footer && (
          <footer style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
