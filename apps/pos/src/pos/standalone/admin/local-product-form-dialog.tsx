'use client';

import { useId } from 'react';
import { useT } from '@caspian-explorer/script-caspian-store';
import { PosDialog } from '../ui/pos-dialog';
import { LocalProductForm } from './quick-add/local-product-form';
import type { LocalProduct } from '../types';

export interface LocalProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LocalProduct | null;
  /** Prefills the barcode on a new item, for a code that has just been scanned. */
  initialBarcode?: string;
  onSaved?: (product: LocalProduct) => void;
}

/**
 * Edit a product in a modal.
 *
 * A shell over `LocalProductForm`, which Quick add renders too -- adding goes
 * through Quick add now, and this is what opens when somebody edits an item from
 * the Store list or its own page. It still accepts a blank product for the one
 * add path Quick add cannot serve: a scan on the receiving screen of something
 * the till has never seen, where the barcode has to arrive prefilled.
 *
 * `PosDialog` renders nothing while closed, so the form remounts on every open
 * and resets itself. The effect that used to copy the product into state on open
 * is gone with it.
 */
export function LocalProductFormDialog({
  open,
  onOpenChange,
  product,
  initialBarcode,
  onSaved,
}: LocalProductFormDialogProps) {
  const t = useT();
  const formId = useId();
  const editing = Boolean(product?.id);

  return (
    <PosDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? t('pos.admin.products.editTitle') : t('pos.admin.products.addTitle')}
      foot={
        <>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" form={formId} className="cpos-btn cpos-btn--primary">
            {editing ? t('pos.admin.products.update') : t('pos.admin.products.add')}
          </button>
        </>
      }
    >
      <LocalProductForm
        formId={formId}
        product={product}
        initialBarcode={initialBarcode}
        onSaved={(saved) => {
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </PosDialog>
  );
}
