'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../../i18n/locale-context';
import { useToast } from '../../../../ui/toast';
import { FieldDescription } from '../../../../ui/field-description';
import { PosCheck, PosField, PosSelect } from '../../ui/pos-field';
import { listLocalCategories, makeLocalProduct, saveLocalProduct } from '../../local-db';
import { usePosShopSettings } from '../../shop-settings-context';
import type { LocalCategory, LocalProduct } from '../../types';

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

export interface LocalProductFormProps {
  /**
   * Ties this form to a submit button rendered outside it -- in the dialog's
   * pinned foot, or Quick add's. A native `form=` association, so the button
   * stays put while a long form scrolls under it and there is no ref to thread.
   */
  formId: string;
  /** Absent when adding. */
  product?: LocalProduct | null;
  /** Prefills the barcode on a new item, for a code that has just been scanned. */
  initialBarcode?: string;
  onSaved?: (product: LocalProduct) => void;
}

/**
 * The fields of a product, and the rules for saving them.
 *
 * Lifted out of `LocalProductFormDialog` in v1.4.0 so that Quick add and the
 * edit dialog render the same thing. Two copies of this would be two copies of
 * the price parse and the `size:qty` parse -- and two screens that eventually
 * disagree about what somebody typed.
 */
export function LocalProductForm({
  formId,
  product,
  initialBarcode,
  onSaved,
}: LocalProductFormProps) {
  const t = useT();
  const { toast } = useToast();
  const { settings } = usePosShopSettings();
  const editingId = product?.id ?? null;

  const [draft, setDraft] = useState(() =>
    product
      ? {
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
        }
      : { ...BLANK, barcode: initialBarcode ?? '' },
  );
  const [categories, setCategories] = useState<LocalCategory[]>([]);

  useEffect(() => {
    if (!settings.categoriesEnabled) return;
    let alive = true;
    void listLocalCategories().then((rows) => {
      if (alive) setCategories(rows);
    });
    return () => {
      alive = false;
    };
  }, [settings.categoriesEnabled]);

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
    onSaved?.(saved);
    toast({ title: t('pos.admin.products.saved') });
  };

  /**
   * The picker offers what the shop has filed plus whatever this product already
   * says, so an item categorised before the screen was switched on keeps its
   * group instead of being silently re-filed on the next save.
   */
  const categoryOptions = [
    { value: '', label: t('pos.admin.products.categoryNone') },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
    ...(draft.category && !categories.some((c) => c.name === draft.category)
      ? [{ value: draft.category, label: draft.category }]
      : []),
  ];

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="cpos-form"
    >
      <div className="cpos-row">
        <PosField label={t('pos.admin.products.name')} style={{ flex: '2 1 180px' }}>
          <input
            className="cpos-input"
            value={draft.name}
            autoFocus
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </PosField>
        <PosField label={t('pos.admin.products.price')} style={{ flex: '1 1 100px' }}>
          <input
            className="cpos-input"
            value={draft.price}
            inputMode="decimal"
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </PosField>
        <PosField label={t('pos.admin.products.barcode')} style={{ flex: '1 1 120px' }}>
          <input
            className="cpos-input"
            value={draft.barcode}
            onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
          />
        </PosField>
        <PosField label={t('pos.admin.products.sku')} style={{ flex: '1 1 100px' }}>
          <input
            className="cpos-input"
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
          />
        </PosField>
      </div>

      <div className="cpos-row">
        <PosField label={t('pos.admin.products.category')} style={{ flex: '1 1 140px' }}>
          {settings.categoriesEnabled ? (
            <PosSelect
              value={draft.category}
              options={categoryOptions}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          ) : (
            <input
              className="cpos-input"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          )}
        </PosField>
        <PosField label={t('pos.admin.products.sizes')} style={{ flex: '1 1 120px' }}>
          <input
            className="cpos-input"
            value={draft.sizes}
            placeholder="S;M;L"
            onChange={(e) => setDraft({ ...draft, sizes: e.target.value })}
          />
        </PosField>
        {/*
          Absent for an item received in batches. For one of those,
          `LocalProduct.stock` is a projection of the batches, and a figure typed
          here would be written by a transaction that never touches them --
          leaving the shelf saying one thing and the batches another, with the
          register selling against the wrong one. Stock reaches a batched item
          through Receive stock and Adjust stock, and nowhere else.
        */}
        {draft.tracksLots ? null : (
          <PosField label={t('pos.admin.products.stock')} style={{ flex: '1 1 140px' }}>
            <input
              className="cpos-input"
              value={draft.stock}
              placeholder="_default:12"
              onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            />
          </PosField>
        )}
      </div>
      <FieldDescription>
        {t(draft.tracksLots ? 'pos.admin.products.stockByBatch' : 'pos.admin.products.stockHelp')}
      </FieldDescription>

      <PosField
        label={t('pos.admin.products.description')}
        help={t('pos.admin.products.descriptionHelp')}
      >
        <textarea
          className="cpos-textarea"
          value={draft.description}
          rows={3}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </PosField>

      {settings.lotTrackingEnabled ? (
        <PosCheck
          checked={draft.tracksLots}
          onChange={(next) => setDraft({ ...draft, tracksLots: next })}
          label={t('pos.admin.products.tracksLots')}
          description={t('pos.admin.products.tracksLotsHelp')}
        />
      ) : null}
    </form>
  );
}
