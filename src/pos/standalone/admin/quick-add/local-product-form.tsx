'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../../i18n/locale-context';
import { useToast } from '../../../../ui/toast';
import { FieldDescription } from '../../../../ui/field-description';
import { PosCheck, PosField, PosSelect } from '../../ui/pos-field';
import { listLocalCategories, makeLocalProduct, saveLocalProduct } from '../../local-db';
import { DEFAULT_SIZE_KEY } from '../../lot-allocation';
import { usePosShopSettings } from '../../shop-settings-context';
import type { LocalCategory, LocalProduct } from '../../types';

interface Draft {
  name: string;
  price: string;
  sku: string;
  barcode: string;
  category: string;
  sizes: string;
  /**
   * The count per stock bucket, held as typed rather than as a number, so a box
   * somebody has just cleared stays cleared instead of snapping back to `0`
   * under their cursor.
   */
  stock: Record<string, string>;
  description: string;
  tracksLots: boolean;
}

const BLANK: Draft = {
  name: '',
  price: '',
  sku: '',
  barcode: '',
  category: '',
  sizes: '',
  stock: {},
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
 * the price parse and the stock rules -- and two screens that eventually
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

  const [draft, setDraft] = useState<Draft>(() =>
    product
      ? {
          name: product.name,
          price: String(product.price),
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          sizes: product.sizes.join(';'),
          stock: Object.fromEntries(
            Object.entries(product.stock).map(([key, count]) => [key, String(count)]),
          ),
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

  const sizeKeys = draft.sizes
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  /**
   * Which counts this item can hold, in the order they are shown.
   *
   * The counter never asks a cashier for a size. `usePosTicket` fills one in
   * only when the item has exactly one, and every other sale is priced with no
   * size and comes off `DEFAULT_SIZE_KEY` -- so that is the bucket the register
   * actually draws down, and it is hidden only when a single size shadows it.
   * Offering the sizes alone is how an item with three of them ended up with
   * stock in S, M and L and a shelf figure going negative on the first sale.
   */
  const stockKeys = sizeKeys.length === 1 ? sizeKeys : [DEFAULT_SIZE_KEY, ...sizeKeys];

  /**
   * Buckets this item arrived holding stock in. Frozen at mount rather than read
   * off the live draft: a box whose presence depended on its own value being
   * above zero vanished under the cursor the moment somebody backspaced it
   * empty, taking the field they were editing with it.
   */
  const [arrivedWithStock] = useState(() =>
    Object.entries(product?.stock ?? {})
      .filter(([, count]) => count > 0)
      .map(([key]) => key),
  );

  /**
   * A count sitting under a size this item no longer lists -- renamed, or
   * dropped while it still held stock. Shown so nothing is both invisible and
   * non-zero; the same posture as `categoryOptions` below. Typing the size back
   * into Sizes moves it into `stockKeys` and it stops being shown twice.
   */
  const unlistedKeys = arrivedWithStock.filter((key) => !stockKeys.includes(key));

  const setStock = (key: string, value: string) =>
    setDraft({ ...draft, stock: { ...draft.stock, [key]: value } });

  const save = async () => {
    const price = Number(draft.price);
    if (!draft.name.trim() || !Number.isFinite(price) || price < 0) {
      toast({ title: t('pos.admin.products.invalid'), variant: 'destructive' });
      return;
    }

    const stock: Record<string, number> = {};
    for (const key of [...stockKeys, ...unlistedKeys]) {
      const typed = (draft.stock[key] ?? '').trim();
      const count = typed === '' ? 0 : Number(typed);
      // Refused, not dropped. The box this replaced parsed `size:qty` and threw
      // away whatever did not match, so a plain `12` saved nothing at all and
      // correcting a shelf figure to `13` silently wiped the count that was
      // there. A shop had no way to tell either had happened.
      if (!Number.isInteger(count) || count < 0) {
        toast({ title: t('pos.admin.products.stockInvalid'), variant: 'destructive' });
        return;
      }
      // A listed bucket is written even at zero -- "none left" is a fact worth
      // recording. An unlisted one survives only while it still holds something.
      if (count > 0 || stockKeys.includes(key)) stock[key] = count;
    }

    const saved = makeLocalProduct({
      ...(product ?? {}),
      ...(editingId ? { id: editingId } : {}),
      name: draft.name,
      price,
      sku: draft.sku,
      barcode: draft.barcode,
      category: draft.category,
      sizes: sizeKeys,
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

  const stockBox = (key: string, unlisted: boolean) => (
    <PosField
      key={key}
      label={key === DEFAULT_SIZE_KEY ? t('pos.admin.products.stockNoSize') : key}
      help={unlisted ? t('pos.admin.products.stockUnlisted') : undefined}
      style={{ flex: '0 1 120px' }}
    >
      <input
        className="cpos-input"
        value={draft.stock[key] ?? ''}
        inputMode="numeric"
        placeholder="0"
        onChange={(e) => setStock(key, e.target.value)}
      />
    </PosField>
  );

  const onlyKey = stockKeys.length === 1 && unlistedKeys.length === 0 ? stockKeys[0] : null;

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
      </div>

      {/*
        Absent for an item received in batches. For one of those,
        `LocalProduct.stock` is a projection of the batches, and a figure typed
        here would be written by a transaction that never touches them --
        leaving the shelf saying one thing and the batches another, with the
        register selling against the wrong one. Stock reaches a batched item
        through Receive stock and Adjust stock, and nowhere else.
      */}
      {draft.tracksLots ? (
        <FieldDescription>{t('pos.admin.products.stockByBatch')}</FieldDescription>
      ) : onlyKey !== null ? (
        // In a `.cpos-row` even though it is alone: `.cpos-form` is a column, so
        // a flex basis on a direct child of it would size the field's height.
        <div className="cpos-row">
          <PosField
            label={t('pos.admin.products.stock')}
            help={t('pos.admin.products.stockHelp')}
            style={{ flex: '0 1 120px' }}
          >
            <input
              className="cpos-input"
              value={draft.stock[onlyKey] ?? ''}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => setStock(onlyKey, e.target.value)}
            />
          </PosField>
        </div>
      ) : (
        <PosField asDiv label={t('pos.admin.products.stock')}>
          <div className="cpos-row">
            {stockKeys.map((key) => stockBox(key, false))}
            {unlistedKeys.map((key) => stockBox(key, true))}
          </div>
          <FieldDescription>
            {t('pos.admin.products.stockHelp')} {t('pos.admin.products.stockNoSizeHelp')}
          </FieldDescription>
        </PosField>
      )}

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
