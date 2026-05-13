'use client';

import { useEffect } from 'react';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { cn } from '../utils/cn';
import {
  EMPTY_SHOP_FILTERS,
  ShopFilterFields,
  countActiveShopFilters,
  type ShopFilterFieldsProps,
  type ShopFilterState,
} from './shop-filter-sidebar';

export interface ShopFilterDrawerProps
  extends Omit<ShopFilterFieldsProps, 'hideHeader' | 'hideReset'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/**
 * Mobile-first bottom drawer wrapping the shared filter fields. Reuses the
 * same overlay + Escape + body-overflow conventions as `<CartSheet>`, but
 * anchors to the bottom edge and shows a sticky footer with Reset + Apply.
 */
export function ShopFilterDrawer({
  open,
  onOpenChange,
  state,
  onChange,
  availableCategories,
  categoryLabels,
  availableSizes,
  resultCount,
  className,
}: ShopFilterDrawerProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const hasActive = countActiveShopFilters(state) > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('shop.filters.title')}
    >
      <aside
        className={cn('caspian-shop-filter-drawer', className)}
        style={{
          width: '100%',
          maxHeight: '85vh',
          background: '#fff',
          color: '#111',
          borderTopLeftRadius: 'var(--caspian-radius, 12px)',
          borderTopRightRadius: 'var(--caspian-radius, 12px)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'caspian-drawer-slide-up 220ms ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: 'rgba(0,0,0,0.18)',
            }}
          />
        </div>

        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {t('shop.filters.title')}
          </h2>
          <button
            type="button"
            aria-label={t('shop.filters.close')}
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: 0,
              fontSize: 22,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 4,
              color: '#444',
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 20px 20px',
          }}
        >
          <ShopFilterFields
            state={state}
            onChange={onChange}
            availableCategories={availableCategories}
            categoryLabels={categoryLabels}
            availableSizes={availableSizes}
            resultCount={resultCount}
            hideHeader
            hideReset
          />
        </div>

        <footer
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 20px max(12px, env(safe-area-inset-bottom))',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            background: '#fff',
          }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(EMPTY_SHOP_FILTERS)}
            disabled={!hasActive}
            style={{ flex: '0 0 auto' }}
          >
            {t('shop.filters.reset')}
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{ flex: 1 }}
          >
            {typeof resultCount === 'number'
              ? t('shop.filters.applyWithCount', { count: resultCount })
              : t('shop.filters.apply')}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

export type { ShopFilterState };
