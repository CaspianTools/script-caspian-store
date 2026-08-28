'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useCaspianNavigation, cn } from '@caspian-explorer/script-caspian-store';
import { ChevronLeftIcon, PackageIcon } from '../../../icons';
import { PosSelect } from '../ui/pos-field';
import {
  backfillLocalStockMovements,
  deleteLocalProduct,
  getLocalProduct,
  listLocalLots,
  listLocalMovements,
  listLocalSales,
  listLocalSuppliers,
} from '../local-db';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import { localDayKey } from '../opening-cash';
import { lotExpiryState, summariseProductMovements } from '../lot-allocation';
import {
  POS_RANGE_KEYS,
  productSaleRows,
  rangeStart,
  salesByProduct,
  type PosRange,
} from '../store-stats';
import type {
  LocalProduct,
  LocalSale,
  LocalStockLot,
  LocalStockMovement,
  LocalSupplier,
} from '../types';
import { LocalProductFormDialog } from './local-product-form-dialog';
import { LocalStockAdjustDialog } from './local-stock-adjust-dialog';
import { StoreScreenNav } from './store-screen-nav';
import { formatLocalMoney, formatSignedQuantity } from './local-money';
import { PanelLoadError } from './panel-load-error';
import { usePosConfirm } from '../ui/pos-confirm';

/** How many ledger rows a page shows before asking to be shown more. */
const HISTORY_PAGE = 25;

/**
 * One product, everything that has happened to it.
 *
 * The screen a shop opens to answer the two questions the list cannot: what is
 * this thing, and where did the stock go. The figures come off the movement
 * ledger rather than off `LocalProduct.stock`, so the two agreeing is itself
 * the check that nothing changed a quantity without saying why.
 */
export function LocalProductPage({ productId }: { productId: string }) {
  const t = useT();
  const confirm = usePosConfirm();
  const { push } = useCaspianNavigation();
  const session = usePosLocalSession();
  const { can } = usePosRoles();
  const { settings } = usePosShopSettings();
  const role = session.user?.role;
  const mayEdit = can(role, 'store.edit');
  const mayReceive = can(role, 'stock.receive');

  const [product, setProduct] = useState<LocalProduct | null>(null);
  const [lots, setLots] = useState<LocalStockLot[]>([]);
  const [movements, setMovements] = useState<LocalStockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<LocalSupplier[]>([]);
  const [sales, setSales] = useState<LocalSale[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [shown, setShown] = useState(HISTORY_PAGE);
  const [range, setRange] = useState<PosRange>('month');
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // Run before the ledger is read, and only here: a shop upgrading into
      // this release has a year of sales that predate the ledger, and this page
      // is the first and only one that would show "Sold 0" beside them. It is
      // guarded by a counter row, so every visit after the first is one cheap
      // read. Deliberately not at register boot -- a cashier must not wait on a
      // migration to open the till.
      await backfillLocalStockMovements();
      const [row, lotRows, movementRows, supplierRows, saleRows] = await Promise.all([
        getLocalProduct(productId),
        listLocalLots(productId),
        listLocalMovements(productId),
        settings.suppliersEnabled ? listLocalSuppliers() : Promise.resolve([]),
        // Every sale, filtered in memory. The same thing the Sales screen does,
        // and fine at one till's volume -- `localSales` has no per-product index
        // and adding one to serve this page would be an upgrade every shop pays
        // for so that one screen can skip a scan it does not notice.
        listLocalSales(),
      ]);
      if (!row) {
        setState('missing');
        return;
      }
      setProduct(row);
      setLots(lotRows);
      setMovements(movementRows);
      setSuppliers(supplierRows);
      setSales(saleRows);
      setState('ready');
    } catch {
      setState('failed');
    }
  }, [productId, settings.suppliersEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => summariseProductMovements(movements), [movements]);
  const today = useMemo(() => localDayKey(Date.now(), new Date().getTimezoneOffset()), []);

  const from = useMemo(() => rangeStart(range, Date.now()), [range]);
  const sold = useMemo(
    () => salesByProduct(sales, from).get(productId) ?? null,
    [sales, from, productId],
  );
  const saleRows = useMemo(
    () => productSaleRows(sales, productId, from),
    [sales, productId, from],
  );
  const supplierName = useCallback(
    (id: string) => suppliers.find((s) => s.id === id)?.name ?? '',
    [suppliers],
  );

  const onHand = product
    ? (Object.values(product.stock) as number[]).reduce((a, b) => a + b, 0)
    : 0;
  const money = (amount: number) => formatLocalMoney(amount, settings.currency);

  const remove = async () => {
    if (!product) return;
    const ok = await confirm({
      title: t('pos.admin.products.deleteTitle'),
      body: t('pos.admin.products.confirmDelete', { name: product.name }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    await deleteLocalProduct(product.id);
    push('/pos/store');
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

  if (state === 'missing' || !product) {
    return (
      <div className="cpos-page">
        <div className="cpos-empty">
          <span className="cpos-empty__icon cpos-empty__icon--neutral">
            <PackageIcon size={22} />
          </span>
          <p className="cpos-empty__title">{t('pos.store.product.missing')}</p>
          <p className="cpos-empty__text">{t('pos.store.product.missingHelp')}</p>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => push('/pos/store')}
          >
            {t('pos.store.backToProducts')}
          </button>
        </div>
      </div>
    );
  }

  /**
   * Sell price against what the last delivery cost.
   *
   * Hidden rather than shown as zero when nothing has been received: a margin
   * of 100% on a cost nobody has entered is a number a shop would act on.
   */
  const margin =
    product.costPrice > 0 && product.price > 0
      ? Math.round(((product.price - product.costPrice) / product.price) * 100)
      : null;

  const visibleMovements = movements.slice(0, shown);

  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <PackageIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">
            {product.name}
            {product.isActive ? null : (
              <span className="cpos-badge" style={{ marginInlineStart: 10, verticalAlign: 'middle' }}>
                {t('pos.admin.products.hidden')}
              </span>
            )}
          </h1>
          <p className="cpos-pagehead__sub">
            {[
              product.barcode && `${t('pos.admin.products.barcode')} ${product.barcode}`,
              product.sku && `${t('pos.admin.products.sku')} ${product.sku}`,
              product.category,
            ]
              .filter(Boolean)
              .join(' · ') || t('pos.store.product.noCodes')}
          </p>
        </span>
      </div>

      <StoreScreenNav current="products" />

      <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
        {/*
          Pushes the list rather than calling `back()`. The register's own
          navigation adapter keeps a route stack, and the way in here is often
          not the list -- arriving from Receive stock, or from a reload -- so
          `back()` would send somebody to the delivery they just posted.
        */}
        <button
          type="button"
          className="cpos-btn cpos-btn--ghost"
          onClick={() => push('/pos/store')}
        >
          <ChevronLeftIcon size={16} />
          {t('pos.store.backToProducts')}
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
        {mayReceive ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => push(`/pos/store/receive?product=${product.id}`)}
          >
            {t('pos.store.receive.action')}
          </button>
        ) : null}
        {mayEdit ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => setAdjustOpen(true)}
          >
            {t('pos.store.adjust.action')}
          </button>
        ) : null}
        {mayEdit ? (
          <button type="button" className="cpos-btn cpos-btn--danger" onClick={() => void remove()}>
            {t('common.delete')}
          </button>
        ) : null}
      </div>

      {product.description ? (
        <section className="cpos-section">
          <h2 className="cpos-section__title">{t('pos.admin.products.description')}</h2>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{product.description}</p>
        </section>
      ) : null}

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.product.figures')}</h2>
        <div className="cpos-stats">
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.totalStock')}</span>
            <span className={cn('cpos-stat__value', onHand < 0 && 'cpos-neg')}>{onHand}</span>
            {onHand < 0 ? (
              // Colour is never the only signal: the badge says it in words for
              // anyone who cannot tell the red from the black.
              <span className="cpos-badge cpos-badge--danger">
                {t('pos.store.product.short')}
              </span>
            ) : null}
            {summary.onHand !== onHand ? (
              // Worth saying out loud rather than hiding: the ledger and the
              // shelf disagreeing means a quantity was written before the
              // ledger existed, or edited straight on the item form.
              <span className="cpos-stat__hint">
                {t('pos.store.product.ledgerSays', { count: summary.onHand })}
              </span>
            ) : null}
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.received')}</span>
            <span className="cpos-stat__value">{summary.received}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.sold')}</span>
            <span className="cpos-stat__value">{summary.sold}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.returned')}</span>
            <span className="cpos-stat__value">{summary.returned}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.adjusted')}</span>
            <span className="cpos-stat__value">{formatSignedQuantity(summary.adjusted)}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.price')}</span>
            <span className="cpos-stat__value">{money(product.price)}</span>
            {product.costPrice > 0 ? (
              <span className="cpos-stat__hint">
                {t('pos.store.product.lastCost', { amount: money(product.costPrice) })}
                {margin === null ? '' : ` · ${t('pos.store.product.margin', { percent: margin })}`}
              </span>
            ) : null}
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.stockValue')}</span>
            {/*
              The one place on this page that did not guard on a cost price, so
              an item added by hand -- which never gets one, since only a
              delivery stamps it -- showed 0.00 as though that were its shelf
              value. Oversold, `onHand * 0` is `-0`, and `Intl` renders that
              "-$0.00". An em dash is the honest answer to a figure the till
              does not have.
            */}
            <span className="cpos-stat__value">
              {product.costPrice > 0 ? money(onHand * product.costPrice) : '\u2014'}
            </span>
            <span className="cpos-stat__hint">{t('pos.store.product.stockValueHint')}</span>
          </div>
        </div>
      </section>

      {/*
        Distinct from Figures above, which counts the stock LEDGER over all time:
        this counts money, over a window somebody picked. The two would disagree
        about "sold" if they shared a heading -- the ledger records a movement
        for an oversell that no sale line priced -- so they are two sections and
        the labels say which question each is answering.
      */}
      <section className="cpos-section">
        <div className="cpos-row" style={{ alignItems: 'center' }}>
          <h2 className="cpos-section__title">{t('pos.store.product.salesTitle')}</h2>
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
            <span className="cpos-stat__label">{t('pos.store.product.sold')}</span>
            <span className="cpos-stat__value">{sold?.units ?? 0}</span>
            <span className="cpos-stat__hint">
              {t('pos.store.product.onSales', { count: sold?.saleCount ?? 0 })}
            </span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.revenue')}</span>
            <span className="cpos-stat__value">{money(sold?.revenue ?? 0)}</span>
            {sold && sold.discount > 0 ? (
              <span className="cpos-stat__hint">
                {t('pos.store.product.afterDiscount', { amount: money(sold.discount) })}
              </span>
            ) : null}
          </div>
          {/* Only where a delivery has stamped a cost. Same rule as the margin
              hint below Price: a profit computed against a cost of zero is the
              whole takings, and it is a number somebody would act on. */}
          {product.costPrice > 0 && sold ? (
            <div className="cpos-stat">
              <span className="cpos-stat__label">{t('pos.store.grossProfit')}</span>
              <span className="cpos-stat__value">
                {money(sold.revenue - sold.units * product.costPrice)}
              </span>
              <span className="cpos-stat__hint">
                {t('pos.store.product.lastCost', { amount: money(product.costPrice) })}
              </span>
            </div>
          ) : null}
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.averagePrice')}</span>
            <span className="cpos-stat__value">
              {sold && sold.units > 0 ? money(sold.revenue / sold.units) : '—'}
            </span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.store.product.lastSold')}</span>
            <span className="cpos-stat__value" style={{ fontSize: 16 }}>
              {sold?.lastAtMillis ? new Date(sold.lastAtMillis).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>

        {saleRows.length === 0 ? (
          <div className="cpos-muted">{t('pos.store.product.noSales')}</div>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
                <tr>
                  <th>{t('pos.admin.sales.receipt')}</th>
                  <th>{t('pos.store.product.when')}</th>
                  <th>{t('pos.admin.sales.cashier')}</th>
                  <th className="cpos-table__num">{t('pos.store.adjust.quantity')}</th>
                  <th className="cpos-table__num">{t('pos.admin.sales.total')}</th>
                </tr>
              </thead>
              <tbody>
                {saleRows.slice(0, HISTORY_PAGE).map((sale) => (
                  <tr key={sale.saleId}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {sale.receiptNumber}
                    </td>
                    <td>{new Date(sale.atMillis).toLocaleString()}</td>
                    <td>{sale.cashierName || '—'}</td>
                    <td className="cpos-table__num">{sale.quantity}</td>
                    <td className="cpos-table__num">{money(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {saleRows.length > HISTORY_PAGE ? (
          <div className="cpos-muted">
            {t('pos.admin.sales.truncated', { shown: HISTORY_PAGE, total: saleRows.length })}
          </div>
        ) : null}
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.product.bySize')}</h2>
        <div className="cpos-tablewrap">
          <table className="cpos-table">
            <thead>
              <tr>
                <th>{t('pos.admin.products.sizes')}</th>
                <th className="cpos-table__num">{t('pos.store.totalStock')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(product.stock).length === 0 ? (
                <tr>
                  <td colSpan={2} className="cpos-muted">
                    {t('pos.store.product.noStock')}
                  </td>
                </tr>
              ) : (
                Object.entries(product.stock).map(([size, qty]) => (
                  <tr key={size}>
                    <td>{size === '_default' ? t('pos.store.product.noSize') : size}</td>
                    <td className="cpos-table__num">{qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {product.tracksLots ? (
        <section className="cpos-section">
          <h2 className="cpos-section__title">{t('pos.store.lot.many')}</h2>
          {lots.length === 0 ? (
            <div className="cpos-muted">{t('pos.store.lot.none')}</div>
          ) : (
            <div className="cpos-tablewrap">
              <table className="cpos-table">
                <thead>
                  <tr>
                    <th>{t('pos.store.lot.code')}</th>
                    <th>{t('pos.admin.products.sizes')}</th>
                    <th>{t('pos.store.lot.expires')}</th>
                    <th className="cpos-table__num">{t('pos.store.lot.received')}</th>
                    <th className="cpos-table__num">{t('pos.store.lot.remaining')}</th>
                    <th className="cpos-table__num">{t('pos.store.receive.unitCost')}</th>
                    {settings.suppliersEnabled ? <th>{t('pos.store.supplier.one')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => {
                    const expiry = lotExpiryState(lot.expiresOn, today);
                    return (
                      <tr key={lot.id} style={lot.remainingQty <= 0 ? { opacity: 0.55 } : undefined}>
                        <td>{lot.lotCode || t('pos.store.lot.untitled')}</td>
                        <td>{lot.sizeKey === '_default' ? t('pos.store.product.noSize') : lot.sizeKey}</td>
                        <td>
                          {lot.expiresOn || t('pos.store.lot.noExpiry')}
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
                        <td className="cpos-table__num">{lot.receivedQty}</td>
                        <td className="cpos-table__num">{lot.remainingQty}</td>
                        <td className="cpos-table__num">{money(lot.unitCost)}</td>
                        {settings.suppliersEnabled ? <td>{supplierName(lot.supplierId)}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.store.product.history')}</h2>
        {movements.length === 0 ? (
          <div className="cpos-muted">{t('pos.store.product.noHistory')}</div>
        ) : (
          <>
            <div className="cpos-tablewrap">
              <table className="cpos-table">
                <thead>
                  <tr>
                    <th>{t('pos.store.product.when')}</th>
                    <th>{t('pos.store.product.what')}</th>
                    <th className="cpos-table__num">{t('pos.store.adjust.quantity')}</th>
                    <th>{t('pos.admin.products.sizes')}</th>
                    <th>{t('pos.store.product.reference')}</th>
                    <th>{t('pos.store.product.who')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{new Date(movement.atMillis).toLocaleString()}</td>
                      <td>
                        <span
                          className={
                            movement.kind === 'receipt'
                              ? 'cpos-badge cpos-badge--success'
                              : movement.kind === 'sale'
                                ? 'cpos-badge cpos-badge--brand'
                                : movement.kind === 'return'
                                  ? 'cpos-badge cpos-badge--warning'
                                  : 'cpos-badge'
                          }
                        >
                          {t(`pos.store.movement.${movement.kind}`)}
                        </span>
                        {movement.reason ? (
                          <span className="cpos-muted">
                            {' '}
                            {t(`pos.store.adjust.reason.${movement.reason}`)}
                          </span>
                        ) : null}
                        {movement.note ? <div className="cpos-muted">{movement.note}</div> : null}
                      </td>
                      <td className="cpos-table__num">{formatSignedQuantity(movement.quantity)}</td>
                      <td>
                        {movement.sizeKey === '_default'
                          ? t('pos.store.product.noSize')
                          : movement.sizeKey}
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                        {movement.reference}
                      </td>
                      <td>{movement.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < movements.length ? (
              <div className="cpos-actions">
                <button
                  type="button"
                  className="cpos-btn cpos-btn--outline"
                  onClick={() => setShown(shown + HISTORY_PAGE)}
                >
                  {t('pos.store.product.showMore', { count: movements.length - shown })}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <LocalProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        onSaved={() => void refresh()}
      />
      <LocalStockAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        product={product}
        lots={lots}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
