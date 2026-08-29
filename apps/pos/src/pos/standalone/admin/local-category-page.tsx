'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast, useCaspianNavigation } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import { ChevronLeftIcon, FolderIcon } from '../../../icons';
import { PosDialog } from '../ui/pos-dialog';
import { PosField, PosSelect } from '../ui/pos-field';
import {
  deleteLocalCategory,
  listLocalCategories,
  listLocalProducts,
  listLocalSales,
  renameLocalCategory,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import {
  POS_RANGE_KEYS,
  rangeStart,
  salesByProduct,
  unitsOnHand,
  type PosRange,
} from '../store-stats';
import type { LocalCategory, LocalProduct, LocalSale } from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { PanelLoadError } from './panel-load-error';
import { usePosConfirm } from '../ui/pos-confirm';
import { usePosMoney } from '../../use-pos-money';

/**
 * One category, and what it is worth.
 *
 * The Categories list answers "what groups exist"; this answers the question a
 * shop actually asks about a group -- what is in it, what it is holding, and
 * what it sold. That needs a join the sale itself cannot provide: a
 * `LocalSaleLine` records `productId` and never a category, so everything below
 * goes through the product's CURRENT `category` name.
 *
 * That is a real limitation and it is stated on the page rather than buried
 * here. Re-filing a product moves its entire sales history with it, because the
 * category lives on the product -- which is the same property that lets the
 * Categories screen be switched off without stranding a catalogue.
 */
export function LocalCategoryPage({ categoryId }: { categoryId: string }) {
  const t = useT();
  const confirm = usePosConfirm();
  const { toast } = useToast();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const mayEdit = can(session.user?.role, 'store.edit');

  const [category, setCategory] = useState<LocalCategory | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [sales, setSales] = useState<LocalSale[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [range, setRange] = useState<PosRange>('month');
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [categories, productRows, saleRows] = await Promise.all([
        listLocalCategories(),
        listLocalProducts(),
        listLocalSales(),
      ]);
      const row = categories.find((c) => c.id === categoryId);
      if (!row) {
        setState('missing');
        return;
      }
      setCategory(row);
      setProducts(productRows);
      setSales(saleRows);
      setState('ready');
    } catch {
      setState('failed');
    }
  }, [categoryId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const from = useMemo(() => rangeStart(range, Date.now()), [range]);
  const perProduct = useMemo(() => salesByProduct(sales, from), [sales, from]);

  const mine = useMemo(
    () =>
      category
        ? products
            .filter((p) => p.category.trim() === category.name)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [products, category],
  );

  const totals = useMemo(() => {
    let held = 0;
    let stockValue = 0;
    let unitsSold = 0;
    let revenue = 0;
    let grossProfit = 0;
    let unitsWithoutCost = 0;
    let active = 0;
    for (const product of mine) {
      const onHand = unitsOnHand(product);
      held += onHand;
      stockValue += onHand * product.costPrice;
      if (product.isActive) active += 1;
      const sold = perProduct.get(product.id);
      if (!sold) continue;
      unitsSold += sold.units;
      revenue += sold.revenue;
      if (product.costPrice > 0) grossProfit += sold.revenue - sold.units * product.costPrice;
      else unitsWithoutCost += sold.units;
    }
    return { held, stockValue, unitsSold, revenue, grossProfit, unitsWithoutCost, active };
  }, [mine, perProduct]);

  const money = usePosMoney(settings.currency);

  const rename = async () => {
    if (!category) return;
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === category.name) {
      setRenameOpen(false);
      return;
    }
    await renameLocalCategory(category.id, trimmed);
    setRenameOpen(false);
    await refresh();
    toast({ title: t('pos.store.category.renamed') });
  };

  const remove = async () => {
    if (!category) return;
    const ok = await confirm({
      title: t('pos.store.category.deleteTitle'),
      body: t('pos.store.category.confirmDelete', { name: category.name, count: mine.length }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    await deleteLocalCategory(category.id);
    push('/pos/store/categories');
  };

  if (state === 'loading') {
    return (
      <div className="cpos-page">
        <div className="cpos-muted">{t('common.loading')}</div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="cpos-page">
        <PanelLoadError onRetry={() => void refresh()} />
      </div>
    );
  }

  if (state === 'missing' || !category) {
    return (
      <div className="cpos-page">
        <div className="cpos-empty">
          <span className="cpos-empty__icon cpos-empty__icon--neutral">
            <FolderIcon size={22} />
          </span>
          <p className="cpos-empty__title">{t('pos.store.category.missing')}</p>
          <p className="cpos-empty__text">{t('pos.store.category.missingHelp')}</p>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => push('/pos/store/categories')}
          >
            {t('pos.store.category.backToList')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <FolderIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{category.name}</h1>
          <p className="cpos-pagehead__sub">
            {t('pos.store.category.pageSub', { count: mine.length })}
          </p>
        </span>
      </div>

      <StoreScreenNav current="categories" />

      {/* Pushes the list rather than calling back(): arriving here from a
          product page or a reload is common, and back() would then send
          somebody somewhere they never came from. */}
      <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="cpos-btn cpos-btn--ghost"
          onClick={() => push('/pos/store/categories')}
        >
          <ChevronLeftIcon size={16} />
          {t('pos.store.category.backToList')}
        </button>
        {mayEdit ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => {
              setDraftName(category.name);
              setRenameOpen(true);
            }}
          >
            {t('pos.store.category.rename')}
          </button>
        ) : null}
        {mayEdit ? (
          <button type="button" className="cpos-btn cpos-btn--danger" onClick={() => void remove()}>
            {t('common.delete')}
          </button>
        ) : null}
      </div>

      <section className="cpos-section">
        <div className="cpos-row" style={{ alignItems: 'center' }}>
          <h2 className="cpos-section__title">{t('pos.store.category.figures')}</h2>
          <div style={{ marginInlineStart: 'auto', minWidth: 170 }}>
            <PosSelect
              value={range}
              aria-label={t('pos.store.range.label')}
              onChange={(e) => setRange(e.target.value as PosRange)}
              options={POS_RANGE_KEYS.map((key) => ({
                value: key,
                label: t(`pos.store.range.${key}`),
              }))}
            />
          </div>
        </div>

        <div className="cpos-stats">
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.category.products')}</span>
            <span className="cpos-stat__value">{mine.length}</span>
            <span className="cpos-stat__hint">
              {t('pos.store.category.activeCount', { count: totals.active })}
            </span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.totalStock')}</span>
            <span className="cpos-stat__value">{totals.held}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.stockValue')}</span>
            <span className="cpos-stat__value">{money(totals.stockValue)}</span>
            <span className="cpos-stat__hint">{t('pos.store.product.stockValueHint')}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.sold')}</span>
            <span className="cpos-stat__value">{totals.unitsSold}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.revenue')}</span>
            <span className="cpos-stat__value">{money(totals.revenue)}</span>
          </div>
          {/*
            Absent, not zero, when nothing in this group has a cost price on
            file. Reporting the whole takings as profit is a number an owner
            would act on -- and `costPrice` is only stamped by a delivery, so a
            shop that typed its catalogue in by hand has none at all.
          */}
          {totals.grossProfit !== 0 || totals.unitsWithoutCost === 0 ? (
            <div className="cpos-stat">
              <span className="cpos-stat__label">{t('pos.store.grossProfit')}</span>
              <span className="cpos-stat__value">{money(totals.grossProfit)}</span>
              {totals.unitsWithoutCost > 0 ? (
                <span className="cpos-stat__hint">
                  {t('pos.store.grossProfitPartial', { count: totals.unitsWithoutCost })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="cpos-note cpos-note--brand">{t('pos.store.category.historyNote')}</div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.category.productsTitle')}</h2>
        {mine.length === 0 ? (
          <div className="cpos-muted">{t('pos.store.category.noProducts')}</div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.admin.products.name')}</th>
                  <th className="cpos-table__num">{t('pos.admin.products.price')}</th>
                  <th className="cpos-table__num">{t('pos.store.totalStock')}</th>
                  <th className="cpos-table__num">{t('pos.store.product.sold')}</th>
                  <th className="cpos-table__num">{t('pos.store.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((product) => {
                  const sold = perProduct.get(product.id);
                  return (
                    <tr key={product.id}>
                      <td>
                        <button
                          type="button"
                          className="cpos-rowlink"
                          onClick={() => push(`/pos/store/${product.id}`)}
                        >
                          {product.name}
                        </button>
                        {product.isActive ? null : (
                          <span className="cpos-muted"> · {t('pos.admin.products.hidden')}</span>
                        )}
                      </td>
                      <td className="cpos-table__num">{money(product.price)}</td>
                      <td className="cpos-table__num">{unitsOnHand(product)}</td>
                      <td className="cpos-table__num">{sold?.units ?? 0}</td>
                      <td className="cpos-table__num">{money(sold?.revenue ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PosDialog
        closeLabel={t('common.close')}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        size="sm"
        title={t('pos.store.category.rename')}
        description={t('pos.store.category.renameHelp')}
        foot={
          <>
            <button
              type="button"
              className="cpos-btn cpos-btn--outline"
              onClick={() => setRenameOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="cpos-btn cpos-btn--primary"
              onClick={() => void rename()}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        <PosField label={t('pos.store.category.name')}>
          <input
            className="cpos-input"
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void rename();
            }}
          />
        </PosField>
      </PosDialog>
    </div>
  );
}
