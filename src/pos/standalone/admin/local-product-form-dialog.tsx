'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select } from '../../../ui/select';
import { Dialog } from '../../../ui/dialog';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import { listLocalCategories, makeLocalProduct, saveLocalProduct } from '../local-db';
import { usePosShopSettings } from '../shop-settings-context';
import type { LocalCategory, LocalProduct } from '../types';
import { field, fieldLabel, row } from './panel-styles';

const BLANK = {
  name: '',
  price: '',
  sku: '',
  barcode: '',
  category: '',
  sizes: '',
  stock: '',
  description: '',
  tracksLots: false,
};

export interface LocalProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: LocalProduct | null;
  /** Prefills the barcode on a new item, for a code that has just been scanned. */
  initialBarcode?: string;
  onSaved?: (product: LocalProduct) => void;
}

/**
 * Add or edit a product in a modal.
 *
 * Used from the Quick Add menu, the Store page, the product page, and the
 * receiving screen -- where a scan of something the till has never seen opens
 * it with the barcode already filled in.
 */
export function LocalProductFormDialog({
  open,
  onOpenChange,
  product,
  initialBarcode,
  onSaved,
}: LocalProductFormDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const { settings } = usePosShopSettings();
  const [draft, setDraft] = useState(BLANK);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
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
        description: product.description,
        tracksLots: product.tracksLots,
      });
    } else {
      setDraft({ ...BLANK, barcode: initialBarcode ?? '' });
    }
  }, [open, product, initialBarcode]);

  useEffect(() => {
    if (!open || !settings.categoriesEnabled) return;
    let alive = true;
    void listLocalCategories().then((rows) => {
      if (alive) setCategories(rows);
    });
    return () => {
      alive = false;
    };
  }, [open, settings.categoriesEnabled]);

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
    const saved = makeLocalProduct({
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
      description: draft.description,
      tracksLots: draft.tracksLots,
    });
    await saveLocalProduct(saved);
    onOpenChange(false);
    onSaved?.(saved);
    toast({ title: t('pos.admin.products.saved') });
  };

  /**
   * The picker offers what the shop has filed plus whatever this product
   * already says, so an item categorised before the screen was switched on
   * keeps its group instead of being silently re-filed on the next save.
   */
  const categoryOptions = [
    { value: '', label: t('pos.admin.products.categoryNone') },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
    ...(draft.category && !categories.some((c) => c.name === draft.category)
      ? [{ value: draft.category, label: draft.category }]
      : []),
  ];

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
            {settings.categoriesEnabled ? (
              <Select
                value={draft.category}
                options={categoryOptions}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            ) : (
              <Input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            )}
          </div>
          <div style={{ ...field, flex: '1 1 120px' }}>
            <label style={fieldLabel}>{t('pos.admin.products.sizes')}</label>
            <Input
              value={draft.sizes}
              placeholder="S;M;L"
              onChange={(e) => setDraft({ ...draft, sizes: e.target.value })}
            />
          </div>
          {/*
            Absent for an item received in batches. For one of those,
            `LocalProduct.stock` is a projection of the batches, and a figure
            typed here would be written by a transaction that never touches
            them -- leaving the shelf saying one thing and the batches another,
            with the register selling against the wrong one. Stock reaches a
            batched item through Receive stock and Adjust stock, and nowhere
            else.
          */}
          {draft.tracksLots ? null : (
            <div style={{ ...field, flex: '1 1 140px' }}>
              <label style={fieldLabel}>{t('pos.admin.products.stock')}</label>
              <Input
                value={draft.stock}
                placeholder="_default:12"
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
              />
            </div>
          )}
        </div>
        <FieldDescription>
          {t(draft.tracksLots ? 'pos.admin.products.stockByBatch' : 'pos.admin.products.stockHelp')}
        </FieldDescription>

        <div style={field}>
          <label style={fieldLabel}>{t('pos.admin.products.description')}</label>
          <textarea
            value={draft.description}
            rows={3}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--cpos-border-strong, rgba(0,0,0,0.15))',
              borderRadius: 'var(--cpos-r-sm, 8px)',
              background: 'var(--cpos-surface, #fff)',
              color: 'var(--cpos-fg, inherit)',
              font: 'inherit',
              resize: 'vertical',
            }}
          />
          <FieldDescription>{t('pos.admin.products.descriptionHelp')}</FieldDescription>
        </div>

        {settings.lotTrackingEnabled ? (
          <div style={field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={draft.tracksLots}
                onChange={(e) => setDraft({ ...draft, tracksLots: e.target.checked })}
              />
              {t('pos.admin.products.tracksLots')}
            </label>
            <FieldDescription>{t('pos.admin.products.tracksLotsHelp')}</FieldDescription>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
