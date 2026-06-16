'use client';

import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { BottomSheet } from '../ui/bottom-sheet';
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
 * Mobile filter drawer — a thin wrapper over the shared `<BottomSheet>`
 * primitive. Keeps the legacy `caspian-shop-filter-drawer` class and moves
 * Reset + Apply into the sheet's sticky footer.
 */
export function ShopFilterDrawer({
  open,
  onOpenChange,
  state,
  onChange,
  availableCategories,
  categoryLabels,
  availableSizes,
  availableTaxonomies,
  resultCount,
  className,
}: ShopFilterDrawerProps) {
  const t = useT();
  const hasActive = countActiveShopFilters(state) > 0;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('shop.filters.title')}
      closeLabel={t('shop.filters.close')}
      className={cn('caspian-shop-filter-drawer', className)}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(EMPTY_SHOP_FILTERS)}
            disabled={!hasActive}
            style={{ flex: '0 0 auto' }}
          >
            {t('shop.filters.reset')}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} style={{ flex: 1 }}>
            {typeof resultCount === 'number'
              ? t('shop.filters.applyWithCount', { count: resultCount })
              : t('shop.filters.apply')}
          </Button>
        </>
      }
    >
      <ShopFilterFields
        state={state}
        onChange={onChange}
        availableCategories={availableCategories}
        categoryLabels={categoryLabels}
        availableSizes={availableSizes}
        availableTaxonomies={availableTaxonomies}
        resultCount={resultCount}
        hideHeader
        hideReset
      />
    </BottomSheet>
  );
}

export type { ShopFilterState };
