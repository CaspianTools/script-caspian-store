'use client';

import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  /** Optional call to action — a button or link rendered under the copy. */
  action?: ReactNode;
  className?: string;
}

/**
 * The one empty state every storefront list shares (shop, search, wishlist,
 * collections, journal, FAQs). Centred, muted body, optional CTA.
 */
export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('caspian-empty-state', className)}
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 8,
      }}
    >
      {icon && (
        <div style={{ display: 'inline-flex', color: '#999', marginBottom: 4 }} aria-hidden>
          {icon}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</p>
      {body && (
        <p style={{ margin: 0, fontSize: 14, color: '#777', maxWidth: 420, lineHeight: 1.5 }}>
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
