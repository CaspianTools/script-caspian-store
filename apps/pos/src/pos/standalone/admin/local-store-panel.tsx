'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useCaspianNavigation, cn } from '@caspian-explorer/script-caspian-store';
import { PackageIcon, PlusIcon, StoreIcon } from '../../../icons';
import { PosSelect } from '../ui/pos-field';
import { deleteLocalProduct, listAllLocalLots, listLocalProducts } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import { localDayKey } from '../opening-cash';
import { lotExpiryState, sortLotsFefo, type LotExpiryState } from '../lot-allocation';
import type { LocalProduct, LocalStockLot } from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { PanelLoadError } from './panel-load-error';
import { usePosQuickAdd } from './quick-add/pos-quick-add-context';
import { usePosConfirm } from '../ui/pos-confirm';

/**
 * Storekeeper inventory page.
 *
 * The list is stock-centric, every row opens the item's own page, and the two
 * ways stock arrives -- a new item, or more of one already here -- are the two
 * buttons in the toolbar. Adding goes through Quick add, so the form is the same
 * one the top bar opens rather than a second copy of it.
 */
export function LocalStorePanel() {
  const t = useT();
  const confirm = usePosConfirm();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const quickAdd = usePosQuickAdd();
  // Seeing the shelf and restocking it are separate grants, so a role can be
  // given the stock list to count against without also being able to rewrite it.
  const mayEdit = can(session.user?.role, 'store.edit');
  const mayReceive = can(session.user?.role, 'stock.receive');

  const [products, setProducts] = useState<LocalProduct[] | null>(null);
  const [lots, setLots] = useState<LocalStockLot[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const refresh = useCallback(async () => {
    try {
      // Lots are read once for the whole list rather than per row -- the badge
      // is worth a single extra read and not worth one per product. Skipped
      // outright for a shop that does not track them.
      const [rows, allLots] = await Promise.all([
        listLocalProducts(),
        settings.lotTrackingEnabled ? listAllLocalLots() : Promise.resolve([]),
      ]);
      setProducts(rows);
      setLots(allLots);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [settings.lotTrackingEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh, quickAdd.savedCount]);

  const totalStock = (p: LocalProduct) =>
    (Object.values(p.stock) as number[]).reduce((a, b) => a + b, 0);

  /** The soonest live expiry per product, so a row can wear one badge. */
  const expiryByProduct = useMemo(() => {
    const today = localDayKey(Date.now(), new Date().getTimezoneOffset());
    const out = new Map<string, LotExpiryState>();
    const byProduct = new Map<string, LocalStockLot[]>();
    for (const lot of lots) {
      if (lot.remainingQty <= 0 || !lot.expiresOn) continue;
      byProduct.set(lot.productId, [...(byProduct.get(lot.productId) ?? []), lot]);
    }
    for (const [productId, rows] of byProduct) {
      const soonest = sortLotsFefo(rows)[0];
      if (soonest) out.set(productId, lotExpiryState(soonest.expiresOn, today));
    }
    return out;
  }, [lots]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const p of products ?? []) if (p.category.trim()) names.add(p.category.trim());
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (category && p.category !== category) return false;
      if (!needle) return true;
      return (
        p.nameLower.includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        p.barcode.toLowerCase().includes(needle)
      );
    });
  }, [products, search, category]);

  const remove = async (p: LocalProduct) => {
    const ok = await confirm({
      title: t('pos.admin.products.deleteTitle'),
      body: t('pos.admin.products.confirmDelete', { name: p.name }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    await deleteLocalProduct(p.id);
    await refresh();
  };

  const showCategory = settings.categoriesEnabled;

  return (
    <div className="cpos-page">
      {/* Mounted straight as a route rather than inside a wrapper, so the page
          title belongs to this component. */}
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <StoreIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.store.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.store.subtitle')}</p>
        </span>
      </div>

      <StoreScreenNav current="products" />

      <section className="cpos-section">
        <div className="cpos-row" style={{ alignItems: 'center' }}>
          <span className="cpos-section__title">
            {t('pos.admin.products.listTitle', { count: products?.length ?? 0 })}
          </span>
          {/*
            .cpos-actions rather than an anonymous inline flex: it right-aligns
            and wraps as a GROUP. The hand-rolled version wrapped each control
            independently, so at around 1200px the search box and Receive stock
            took the first line and left Add item -- the primary action --
            floating mid-row under them, aligned to nothing.
          */}
          <div className="cpos-actions" style={{ flex: '1 1 auto', alignItems: 'center' }}>
            <input
              className="cpos-input"
              type="search"
              style={{ maxWidth: 240 }}
              value={search}
              placeholder={t('pos.admin.products.search')}
              aria-label={t('pos.admin.products.search')}
              onChange={(e) => setSearch(e.target.value)}
            />
            {showCategory && categories.length ? (
              <PosSelect
                style={{ maxWidth: 200 }}
                value={category}
                aria-label={t('pos.store.allCategories')}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: '', label: t('pos.store.allCategories') },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
              />
            ) : null}
            {mayReceive ? (
              <button
                type="button"
                className="cpos-btn cpos-btn--outline"
                onClick={() => push('/pos/store/receive')}
              >
                {t('pos.store.receive.action')}
              </button>
            ) : null}
            {mayEdit ? (
              <button
                type="button"
                className="cpos-btn cpos-btn--primary"
                onClick={() => quickAdd.open('product')}
              >
                <PlusIcon size={16} />
                {t('pos.store.addTitle')}
              </button>
            ) : null}
          </div>
        </div>

        {loadFailed ? (
          <PanelLoadError onRetry={() => void refresh()} />
        ) : products === null ? (
          <div className="cpos-muted">{t('common.loading')}</div>
        ) : visible.length === 0 ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon cpos-empty__icon--neutral">
              <PackageIcon size={22} />
            </span>
            <p className="cpos-empty__title">{t('pos.admin.products.empty')}</p>
            {mayEdit ? (
              <p className="cpos-empty__text">{t('pos.store.emptyHelp')}</p>
            ) : null}
          </div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.admin.products.name')}</th>
                  <th>{t('pos.admin.products.barcode')}</th>
                  {showCategory ? <th>{t('pos.admin.products.category')}</th> : null}
                  <th className="cpos-table__num">{t('pos.admin.products.price')}</th>
                  <th className="cpos-table__num">{t('pos.store.totalStock')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const expiry = expiryByProduct.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        {/* A link rather than a row click: a row that navigates
                            also swallows the Delete button underneath it. */}
                        <button
                          type="button"
                          className="cpos-rowlink"
                          onClick={() => push(`/pos/store/${p.id}`)}
                        >
                          {p.name}
                        </button>
                        {p.isActive ? null : (
                          <span className="cpos-muted"> · {t('pos.admin.products.hidden')}</span>
                        )}
                        {expiry === 'expired' ? (
                          <span className="cpos-badge cpos-badge--danger" style={{ marginInlineStart: 8 }}>
                            {t('pos.store.lot.expired')}
                          </span>
                        ) : expiry === 'soon' ? (
                          <span className="cpos-badge cpos-badge--warning" style={{ marginInlineStart: 8 }}>
                            {t('pos.store.lot.expiringSoon')}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{p.barcode}</td>
                      {showCategory ? <td>{p.category}</td> : null}
                      <td className="cpos-table__num">
                        {formatLocalMoney(p.price, settings.currency)}
                      </td>
                      <td className={cn('cpos-table__num', totalStock(p) < 0 && 'cpos-neg')}>
                        {totalStock(p)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="cpos-btn cpos-btn--ghost cpos-btn--sm"
                            onClick={() => push(`/pos/store/${p.id}`)}
                          >
                            {t('pos.store.open')}
                          </button>
                          {mayEdit ? (
                            <button
                              type="button"
                              className="cpos-btn cpos-btn--danger cpos-btn--sm"
                              onClick={() => void remove(p)}
                            >
                              {t('common.delete')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
