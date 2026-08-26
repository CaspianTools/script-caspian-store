'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useToast, useCaspianNavigation } from '@caspian-explorer/script-caspian-store';
import { ChevronLeftIcon, TruckIcon } from '../../../icons';
import { PosDialog } from '../ui/pos-dialog';
import {
  deleteLocalSupplier,
  listAllLocalLots,
  listLocalMovements,
  listLocalProducts,
  listLocalStockReceipts,
  listLocalSuppliers,
  saveLocalSupplier,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import { supplierTotals, type SupplierTotals } from '../store-stats';
import type {
  LocalProduct,
  LocalStockLot,
  LocalStockMovement,
  LocalStockReceipt,
  LocalSupplier,
} from '../types';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney } from './local-money';
import { PanelLoadError } from './panel-load-error';
import { LocalSupplierForm } from './quick-add/local-supplier-form';

/**
 * One supplier: what they have delivered, and what happened to it.
 *
 * The deliveries half is exact -- a posted receipt names its supplier and
 * freezes the name onto every lot it creates. The sold half is not, and cannot
 * be. A sale line records the product and never the batch it came off, so the
 * only path from a sale back to a supplier runs
 * `LocalStockLot.supplierId` -> `LocalStockMovement.lotId`, which exists only
 * for a product that tracks lots.
 *
 * Everything else this supplier delivers still sells; the till simply cannot say
 * whose stock it was. The page says that in words rather than showing a zero,
 * which would read as "sold nothing" -- and reports the COST of the units it can
 * attribute rather than their revenue, because cost is on the lot and revenue
 * would have to be apportioned across batches it cannot see.
 */
export function LocalSupplierPage({ supplierId }: { supplierId: string }) {
  const t = useT();
  const { toast } = useToast();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const mayEdit = can(session.user?.role, 'store.edit');

  const [supplier, setSupplier] = useState<LocalSupplier | null>(null);
  const [receipts, setReceipts] = useState<LocalStockReceipt[]>([]);
  const [lots, setLots] = useState<LocalStockLot[]>([]);
  const [movements, setMovements] = useState<LocalStockMovement[]>([]);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [editOpen, setEditOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [suppliers, receiptRows, lotRows, productRows] = await Promise.all([
        listLocalSuppliers(),
        listLocalStockReceipts(),
        listAllLocalLots(),
        listLocalProducts(),
      ]);
      const row = suppliers.find((s) => s.id === supplierId);
      if (!row) {
        setState('missing');
        return;
      }
      // The ledger is read per product rather than whole: `listLocalMovements`
      // takes a product id, and only the products this supplier has actually
      // delivered can carry one of its lots. On a shop with one supplier and
      // four hundred products that is four hundred reads avoided.
      const mineIds = new Set(
        receiptRows
          .filter((r) => r.supplierId === supplierId && r.status === 'posted')
          .flatMap((r) => r.lines.map((l) => l.productId)),
      );
      const ledgers = await Promise.all([...mineIds].map((id) => listLocalMovements(id)));

      setSupplier(row);
      setReceipts(receiptRows);
      setLots(lotRows);
      setMovements(ledgers.flat());
      setProducts(productRows);
      setState('ready');
    } catch {
      setState('failed');
    }
  }, [supplierId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals: SupplierTotals = useMemo(
    () => supplierTotals({ supplierId, receipts, lots, movements }),
    [supplierId, receipts, lots, movements],
  );

  const myReceipts = useMemo(
    () =>
      receipts
        .filter((r) => r.supplierId === supplierId && r.status === 'posted')
        .sort((a, b) => b.receivedAtMillis - a.receivedAtMillis),
    [receipts, supplierId],
  );

  const tracksLots = useMemo(
    () => new Map(products.map((p) => [p.id, p.tracksLots] as const)),
    [products],
  );

  const money = (amount: number) => formatLocalMoney(amount, settings.currency);

  const toggle = async () => {
    if (!supplier) return;
    await saveLocalSupplier({
      ...supplier,
      isActive: !supplier.isActive,
      updatedAtMillis: Date.now(),
    });
    await refresh();
  };

  const remove = async () => {
    if (!supplier) return;
    if (totals.deliveries > 0) {
      // Deleting one that has delivered would leave its receipts naming a
      // supplier the shop can no longer look up. Disabling does the job.
      toast({ title: t('pos.store.supplier.deleteBlocked'), variant: 'destructive' });
      return;
    }
    if (!window.confirm(t('pos.store.supplier.confirmDelete', { name: supplier.name }))) return;
    await deleteLocalSupplier(supplier.id);
    push('/pos/store/suppliers');
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

  if (state === 'missing' || !supplier) {
    return (
      <div className="cpos-page">
        <div className="cpos-empty">
          <span className="cpos-empty__icon cpos-empty__icon--neutral">
            <TruckIcon size={22} />
          </span>
          <p className="cpos-empty__title">{t('pos.store.supplier.missing')}</p>
          <p className="cpos-empty__text">{t('pos.store.supplier.missingHelp')}</p>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => push('/pos/store/suppliers')}
          >
            {t('pos.store.supplier.backToList')}
          </button>
        </div>
      </div>
    );
  }

  const contact = [supplier.contactName, supplier.phone, supplier.email, supplier.address]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <TruckIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">
            {supplier.name}
            {supplier.isActive ? null : (
              <span className="cpos-badge" style={{ marginInlineStart: 10, verticalAlign: 'middle' }}>
                {t('pos.store.supplier.disabled')}
              </span>
            )}
          </h1>
          <p className="cpos-pagehead__sub">{contact || t('pos.store.supplier.noContact')}</p>
        </span>
      </div>

      <StoreScreenNav current="suppliers" />

      <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="cpos-btn cpos-btn--ghost"
          onClick={() => push('/pos/store/suppliers')}
        >
          <ChevronLeftIcon size={16} />
          {t('pos.store.supplier.backToList')}
        </button>
        {mayEdit ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => setEditOpen(true)}
          >
            {t('common.edit')}
          </button>
        ) : null}
        {mayEdit ? (
          <button type="button" className="cpos-btn cpos-btn--outline" onClick={() => void toggle()}>
            {t(supplier.isActive ? 'pos.store.supplier.disable' : 'pos.store.supplier.enable')}
          </button>
        ) : null}
        {mayEdit ? (
          <button type="button" className="cpos-btn cpos-btn--danger" onClick={() => void remove()}>
            {t('common.delete')}
          </button>
        ) : null}
      </div>

      {supplier.note ? (
        <section className="cpos-section">
          <h2 className="cpos-section__title">{t('pos.store.adjust.note')}</h2>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{supplier.note}</p>
        </section>
      ) : null}

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.supplier.figures')}</h2>
        <div className="cpos-stats">
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.supplier.deliveries')}</span>
            <span className="cpos-stat__value">{totals.deliveries}</span>
            {totals.lastAtMillis ? (
              <span className="cpos-stat__hint">
                {t('pos.store.supplier.lastOn', {
                  date: new Date(totals.lastAtMillis).toLocaleDateString(),
                })}
              </span>
            ) : null}
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.supplier.spent')}</span>
            <span className="cpos-stat__value">{money(totals.spend)}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.supplier.productsSupplied')}</span>
            <span className="cpos-stat__value">{totals.products.length}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.supplier.unitsReceived')}</span>
            <span className="cpos-stat__value">{totals.unitsReceived}</span>
          </div>
          {totals.hasLots ? (
            <>
              <div className="cpos-stat">
                <span className="cpos-stat__label">{t('pos.store.supplier.stillOnHand')}</span>
                <span className="cpos-stat__value">{totals.unitsOnHandFromLots}</span>
                <span className="cpos-stat__hint">
                  {t('pos.store.supplier.atCost', { amount: money(totals.stockValueFromLots) })}
                </span>
              </div>
              <div className="cpos-stat">
                <span className="cpos-stat__label">{t('pos.store.supplier.soldFromBatches')}</span>
                <span className="cpos-stat__value">{totals.unitsSoldFromLots}</span>
                <span className="cpos-stat__hint">
                  {t('pos.store.supplier.atCost', {
                    amount: money(totals.costOfUnitsSoldFromLots),
                  })}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/*
          Said plainly, both ways round. A shop with batch tracking on gets the
          figures above and needs to know they cover only the batched items; a
          shop without it gets no sold figure at all and needs to know that is
          the data model, not a bug it can fix by waiting.
        */}
        <div className="cpos-note cpos-note--warning">
          {t(
            totals.hasLots
              ? 'pos.store.supplier.attributionPartial'
              : 'pos.store.supplier.attributionNone',
          )}
        </div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.supplier.deliveriesTitle')}</h2>
        {myReceipts.length === 0 ? (
          <div className="cpos-muted">{t('pos.store.supplier.noDeliveries')}</div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.store.receive.reference')}</th>
                  <th>{t('pos.store.product.when')}</th>
                  <th className="cpos-table__num">{t('pos.store.receive.lines')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.unitsReceived')}</th>
                  <th className="cpos-table__num">{t('pos.store.receive.totalCost')}</th>
                  <th>{t('pos.store.product.who')}</th>
                </tr>
              </thead>
              <tbody>
                {myReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {receipt.reference || '—'}
                    </td>
                    <td>{new Date(receipt.receivedAtMillis).toLocaleString()}</td>
                    <td className="cpos-table__num">{receipt.lines.length}</td>
                    <td className="cpos-table__num">
                      {receipt.lines.reduce((n, l) => n + l.quantity, 0)}
                    </td>
                    <td className="cpos-table__num">{money(receipt.totalCost)}</td>
                    <td>{receipt.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.supplier.productsTitle')}</h2>
        {totals.products.length === 0 ? (
          <div className="cpos-muted">{t('pos.store.supplier.noProducts')}</div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.admin.products.name')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.unitsReceived')}</th>
                  <th className="cpos-table__num">{t('pos.store.receive.unitCost')}</th>
                  <th className="cpos-table__num">{t('pos.store.supplier.soldFromBatches')}</th>
                </tr>
              </thead>
              <tbody>
                {totals.products.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <button
                        type="button"
                        className="cpos-rowlink"
                        onClick={() => push(`/pos/store/${row.productId}`)}
                      >
                        {row.productName}
                      </button>
                    </td>
                    <td className="cpos-table__num">{row.unitsReceived}</td>
                    <td className="cpos-table__num">{money(row.lastUnitCost)}</td>
                    {/* An em dash, not a zero: this item is not received in
                        batches, so the till has no way to know and saying "0"
                        would be a claim it cannot make. */}
                    <td className="cpos-table__num">
                      {tracksLots.get(row.productId) ? row.unitsSoldFromLots : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PosDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        size="md"
        title={t('pos.store.supplier.editTitle')}
        foot={
          <>
            <button
              type="button"
              className="cpos-btn cpos-btn--outline"
              onClick={() => setEditOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="cpos-supplier-edit"
              className="cpos-btn cpos-btn--primary"
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        <LocalSupplierForm
          formId="cpos-supplier-edit"
          supplier={supplier}
          onSaved={() => {
            setEditOpen(false);
            void refresh();
          }}
        />
      </PosDialog>
    </div>
  );
}
