'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useCaspianNavigation } from '@caspian-explorer/script-caspian-store';
import { PlusIcon, TruckIcon } from '../../../icons';
import { listLocalStockReceipts, listLocalSuppliers } from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import type { LocalStockReceipt, LocalSupplier } from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { PanelLoadError } from './panel-load-error';
import { usePosQuickAdd } from './quick-add/pos-quick-add-context';

/**
 * Who the shop buys from.
 *
 * A supplier is picked on a delivery and its name frozen onto the lots that
 * arrive, so this list is a convenience rather than a source of truth for
 * history.
 *
 * Adding moved to Quick add in v1.4.0, and editing, disabling and deleting moved
 * to the supplier's own page -- where there is room to say what they have
 * actually delivered before somebody decides to remove them.
 */
export function LocalSuppliersPanel() {
  const t = useT();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const quickAdd = usePosQuickAdd();
  const mayEdit = can(session.user?.role, 'store.edit');

  const [suppliers, setSuppliers] = useState<LocalSupplier[] | null>(null);
  const [receipts, setReceipts] = useState<LocalStockReceipt[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [rows, receiptRows] = await Promise.all([
        listLocalSuppliers(),
        listLocalStockReceipts(),
      ]);
      setSuppliers(rows);
      setReceipts(receiptRows);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, quickAdd.savedCount]);

  /** How much each supplier has delivered, off the posted receipts. */
  const activity = useMemo(() => {
    const out = new Map<string, { deliveries: number; total: number; lastAtMillis: number }>();
    for (const receipt of receipts) {
      if (!receipt.supplierId) continue;
      const current = out.get(receipt.supplierId) ?? { deliveries: 0, total: 0, lastAtMillis: 0 };
      out.set(receipt.supplierId, {
        deliveries: current.deliveries + 1,
        total: current.total + receipt.totalCost,
        lastAtMillis: Math.max(current.lastAtMillis, receipt.receivedAtMillis),
      });
    }
    return out;
  }, [receipts]);

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <TruckIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.store.supplier.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.store.supplier.subtitle')}</p>
        </span>
      </div>

      <StoreScreenNav current="suppliers" />

      <section className="cpos-section">
        <div className="cpos-row" style={{ alignItems: 'center' }}>
          <span className="cpos-section__title">
            {t('pos.store.supplier.listTitle', { count: suppliers?.length ?? 0 })}
          </span>
          {mayEdit ? (
            <div style={{ marginInlineStart: 'auto' }}>
              <button
                type="button"
                className="cpos-btn cpos-btn--primary"
                onClick={() => quickAdd.open('supplier')}
              >
                <PlusIcon size={16} />
                {t('pos.store.supplier.add')}
              </button>
            </div>
          ) : null}
        </div>

        {loadFailed ? (
          <PanelLoadError onRetry={() => void refresh()} />
        ) : suppliers === null ? (
          <div className="cpos-muted">{t('common.loading')}</div>
        ) : suppliers.length === 0 ? (
          <div className="cpos-empty">
            <span className="cpos-empty__icon cpos-empty__icon--neutral">
              <TruckIcon size={22} />
            </span>
            <p className="cpos-empty__title">{t('pos.store.supplier.empty')}</p>
            <p className="cpos-empty__text">{t('pos.store.supplier.emptyHelp')}</p>
          </div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.store.supplier.name')}</th>
                  <th>{t('pos.store.supplier.contact')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.deliveries')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.spent')}</th>
                  <th>{t('pos.store.supplier.last')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const stats = activity.get(supplier.id);
                  return (
                    <tr key={supplier.id}>
                      <td>
                        <button
                          type="button"
                          className="cpos-rowlink"
                          onClick={() => push(`/pos/store/suppliers/${supplier.id}`)}
                        >
                          {supplier.name}
                        </button>
                        {supplier.isActive ? null : (
                          <span className="cpos-muted"> · {t('pos.store.supplier.disabled')}</span>
                        )}
                      </td>
                      <td>
                        {[supplier.contactName, supplier.phone, supplier.email]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                      <td className="cpos-table__num">{stats?.deliveries ?? 0}</td>
                      <td className="cpos-table__num">
                        {formatLocalMoney(stats?.total ?? 0, settings.currency)}
                      </td>
                      <td>
                        {stats?.lastAtMillis
                          ? new Date(stats.lastAtMillis).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="cpos-btn cpos-btn--ghost cpos-btn--sm"
                            onClick={() => push(`/pos/store/suppliers/${supplier.id}`)}
                          >
                            {t('pos.store.open')}
                          </button>
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
