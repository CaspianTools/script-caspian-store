'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { PackageIcon, StoreIcon } from '../../../ui/icons';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select } from '../../../ui/select';
import { useCaspianNavigation } from '../../../provider/caspian-store-provider';
import { deleteLocalProduct, listAllLocalLots, listLocalProducts } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import { localDayKey } from '../opening-cash';
import { lotExpiryState, sortLotsFefo, type LotExpiryState } from '../lot-allocation';
import type { LocalProduct, LocalStockLot } from '../types';
import { LocalProductFormDialog } from './local-product-form-dialog';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { PanelLoadError } from './panel-load-error';

/**
 * Storekeeper inventory page.
 *
 * The list is stock-centric, every row opens the item's own page, and the two
 * ways stock arrives -- a new item, or more of one already here -- are the two
 * buttons in the toolbar.
 */
export function LocalStorePanel() {
  const t = useT();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  // Seeing the shelf and restocking it are separate grants, so a role can be
  // given the stock list to count against without also being able to rewrite it.
  const mayEdit = can(session.user?.role, 'store.edit');
  const mayReceive = can(session.user?.role, 'stock.receive');

  const [products, setProducts] = useState<LocalProduct[] | null>(null);
  const [lots, setLots] = useState<LocalStockLot[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocalProduct | null>(null);

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
  }, [refresh]);

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

  const startAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const remove = async (p: LocalProduct) => {
    if (!window.confirm(t('pos.admin.products.confirmDelete', { name: p.name }))) return;
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
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginInlineStart: 'auto',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Input
              style={{ maxWidth: 240 }}
              value={search}
              placeholder={t('pos.admin.products.search')}
              onChange={(e) => setSearch(e.target.value)}
            />
            {showCategory && categories.length ? (
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: '', label: t('pos.store.allCategories') },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
              />
            ) : null}
            {mayReceive ? (
              <Button variant="outline" onClick={() => push('/pos/store/receive')}>
                {t('pos.store.receive.action')}
              </Button>
            ) : null}
            {mayEdit ? <Button onClick={startAdd}>{t('pos.store.addTitle')}</Button> : null}
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
                          className="cpos-strip__link"
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            font: 'inherit',
                            fontWeight: 600,
                            color: 'var(--cpos-brand)',
                            cursor: 'pointer',
                            textAlign: 'start',
                          }}
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
                      <td className="cpos-table__num">{totalStock(p)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Button variant="ghost" size="sm" onClick={() => push(`/pos/store/${p.id}`)}>
                            {t('pos.store.open')}
                          </Button>
                          {mayEdit ? (
                            <Button variant="destructive" size="sm" onClick={() => void remove(p)}>
                              {t('common.delete')}
                            </Button>
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

      <LocalProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
