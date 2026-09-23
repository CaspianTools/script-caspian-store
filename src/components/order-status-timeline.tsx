'use client';

import type { OrderStatus } from '../types';
import { useT } from '../i18n/locale-context';
import { cn } from '../utils/cn';

export interface OrderStatusTimelineProps {
  status: OrderStatus;
  className?: string;
}

// The happy path an online order walks. `pending` and `on-hold` both sit on
// the first step: the order exists but the money has not cleared yet.
const STEPS = ['placed', 'paid', 'processing', 'shipped', 'delivered'] as const;

const STEP_INDEX: Record<OrderStatus, number> = {
  pending: 0,
  'on-hold': 0,
  paid: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1,
};

/**
 * Horizontal progress line for an order: placed → paid → processing →
 * shipped → delivered, with every step up to the current status filled in.
 * A cancelled order shows a banner instead of the line.
 */
export function OrderStatusTimeline({ status, className }: OrderStatusTimelineProps) {
  const t = useT();
  const current = STEP_INDEX[status] ?? 0;

  if (current < 0) {
    return (
      <div
        className={cn('caspian-order-timeline', className)}
        role="status"
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--caspian-radius, 8px)',
          background: 'rgba(220, 38, 38, 0.08)',
          color: '#b91c1c',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {t('orderDetail.cancelled')}
      </div>
    );
  }

  return (
    <ol
      className={cn('caspian-order-timeline', className)}
      aria-label={t('orderDetail.progress')}
      style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0 }}
    >
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li
            key={step}
            aria-current={i === current ? 'step' : undefined}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ flex: 1, height: 2, background: i === 0 ? 'transparent' : done ? 'var(--caspian-primary, #111)' : '#e5e5e5' }} />
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: done ? 'var(--caspian-primary, #111)' : '#fff',
                  border: `2px solid ${done ? 'var(--caspian-primary, #111)' : '#d4d4d4'}`,
                }}
              />
              <span
                style={{
                  flex: 1,
                  height: 2,
                  background: i === STEPS.length - 1 ? 'transparent' : i < current ? 'var(--caspian-primary, #111)' : '#e5e5e5',
                }}
              />
            </div>
            <span
              style={{
                fontSize: 12,
                textAlign: 'center',
                color: done ? 'inherit' : '#999',
                fontWeight: i === current ? 600 : 400,
              }}
            >
              {t(`orderDetail.step.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
