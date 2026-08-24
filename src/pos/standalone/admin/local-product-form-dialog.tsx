'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Dialog } from '../../../ui/dialog';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { makeLocalProduct, saveLocalProduct } from '../local-db';
import type { LocalProduct } from '../types';
import { field, fieldLabel, row } from './panel-styles';

const BLANK = { name: '', price: '', sku: '', barcode: '', category: '', sizes: '', stock: '' };

export interface LocalProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LocalProduct | null;
  onSaved?: () => void;
}

/**
 * Add or edit a product in a modal.
 *
 * Used from the Quick Add menu, the Store page, and anywhere else an item form
 * is needed without taking up permanent screen space.
 */
export function LocalProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: LocalProductFormDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const [draft, setDraft] = useState(BLANK);
  const editingId = product?.id ?? null;

  useEffect(() => {
    if (!open) return;
    if (product) {
      setDraft({
        name: product.name,
        price: String(product.price),
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        sizes: product.sizes.join(';'),
        stock: Object.entries(product.stock)
          .map(([k, v]) => `${k}:${v}`)
          .join(';'),
      });
    } else {
      setDraft(BLANK);
    }
  }, [open, product]);

  const save = async () => {
    const price = Number(draft.price);
    if (!draft.name.trim() || !Number.isFinite(price) || price < 0) {
      toast({ title: t('pos.admin.products.invalid'), variant: 'destructive' });
      return;
    }
    const stock: Record<string, number> = {};
    for (const part of draft.stock.split(/[;,]/)) {
      const [size, qty] = part.split(':');
      if (size?.trim() && Number.isFinite(Number(qty))) stock[size.trim()] = Number(qty);
    }
    await saveLocalProduct(
      makeLocalProduct({
        ...(product ?? {}),
        ...(editingId ? { id: editingId } : {}),
        name: draft.name,
        price,
        sku: draft.sku,
        barcode: draft.barcode,
        category: draft.category,
        sizes: draft.sizes
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        stock,
      }),
    );
    onOpenChange(false);
    onSaved?.();
    toast({ title: t('pos.admin.products.saved') });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingId ? t('pos.admin.products.editTitle') : t('pos.admin.products.addTitle')}
      maxWidth={640}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>
            {editingId ? t('pos.admin.products.update') : t('pos.admin.products.add')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={row}>
          <div style={{ ...field, flex: '2 1 180px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.name')}</label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div style={{ ...field, flex: '1 1 100px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.price')}</label>
            <Input
              value={draft.price}
              inputMode="decimal"
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.barcode')}</label>
            <Input value={draft.barcode} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} />
          </div>
          <div style={{ ...field, flex: '1 1 100px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.sku')}</label>
            <Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
          </div>
        </div>
        <div style={row}>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.category')}</label>
            <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.sizes')}</label>
            <Input
              value={draft.sizes}
              placeholder="S;M;L"
              onChange={(e) => setDraft({ ...draft, sizes: e.target.value })}
            />
          </div>
          <div style={{ ...field, flex: '1 1 140px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.stock')}</label>
            <Input
              value={draft.stock}
              placeholder="_default:12"
              onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            />
          </div>
        </div>
        <FieldDescription>{t('pos.admin.products.stockHelp')}</FieldDescription>
      </div>
    </Dialog>
  );
}
