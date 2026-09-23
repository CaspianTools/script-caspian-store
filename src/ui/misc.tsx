'use client';

import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('caspian-skeleton', className)}
      style={{
        background: 'linear-gradient(90deg, #eee, #f5f5f5, #eee)',
        backgroundSize: '200% 100%',
        animation: 'caspian-pulse 1.5s ease-in-out infinite',
        borderRadius: 'var(--caspian-radius, 6px)',
        ...style,
      }}
    />
  );
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  className?: string;
}) {
  const palette = {
    default: { bg: 'var(--caspian-primary, #111)', color: 'var(--caspian-primary-foreground, #fff)' },
    secondary: { bg: '#f1f5f9', color: '#111' },
    destructive: { bg: '#fee2e2', color: '#991b1b' },
    success: { bg: '#dcfce7', color: '#166534' },
    warning: { bg: '#fef3c7', color: '#92400e' },
    outline: { bg: 'transparent', color: 'inherit', border: '1px solid rgba(0,0,0,0.2)' as const },
  }[variant];
  return (
    <span
      className={cn('caspian-badge', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        border: 'border' in palette ? palette.border : undefined,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </span>
  );
}

export function Avatar({
  src,
  alt,
  fallback,
  size = 40,
  className,
}: {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('caspian-avatar', className)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#e5e7eb',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 600,
        color: '#555',
        flexShrink: 0,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        (fallback ?? '?').charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return (
    <hr
      className={cn('caspian-separator', className)}
      style={{ border: 0, borderTop: '1px solid rgba(0,0,0,0.1)', margin: '16px 0' }}
    />
  );
}
