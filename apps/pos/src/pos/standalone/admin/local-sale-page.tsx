'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCaspianNavigation, useFormatDate, cn } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import { ChevronLeftIcon, ReceiptIcon } from '../../../icons';
import { PosAdminPage } from './pos-admin-page';
import { PanelLoadError } from './panel-load-error';
import { getLocalSale } from '../local-db';
import { listRefundsForSale } from '../local-refunds';
import { summariseReturnedLines } from '../price-local-refund';
import { usePosShopSettings } from '../shop-settings-context';
import { usePosRoles } from '../role-context';
import { usePosLocalSession } from '../local-session-context';
import { usePosMoney } from '../../use-pos-money';
import { buildReceiptModel, type PosReceiptModel } from '../../receipt/build-receipt-model';
import { PosReceipt } from '../../receipt/pos-receipt';
import { LocalRefundDialog } from './local-refund-dialog';
import { isRefundSale, type LocalSale } from '../types';

const WHEN: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };

/**
 * One sale, everything that has happened to it, and the two things a shop asks
 * for daily: print that again, and take this back.
 *
 * The Sales list has been read-only since it shipped -- rows went nowhere, and
 * once "Sale complete" was dismissed the receipt was gone for good. Reprint is
 * the commonest counter request there is.
 */
export function LocalSalePage({ saleId }: { saleId: string }) {
  const t = useT();
  const { push } = useCaspianNavigation();
  const { settings } = usePosShopSettings();
  const { can } = usePosRoles();
  const { user } = usePosLocalSession();
  const money = usePosMoney(settings.currency);
  const formatWhen = useFormatDate(WHEN);

  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [sale, setSale] = useState<LocalSale | null>(null);
  const [refunds, setRefunds] = useState<LocalSale[]>([]);
  const [receipt, setReceipt] = useState<PosReceiptModel | null>(null);
  const [refunding, setRefunding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const row = await getLocalSale(saleId);
      if (!row) {
        setState('missing');
        return;
      }
      setSale(row);
      setRefunds(await listRefundsForSale(row.saleId));
      setState('ready');
    } catch {
      setState('failed');
    }
  }, [saleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Re-feed the stored sale through the same builder the original slip used.
   *
   * Three things must come off the RECORD rather than off today: the date
   * (`buildReceiptModel` defaults `at` to now, and a reprint stamped today is a
   * different document), the counter (`terminalName` is frozen on the sale for
   * exactly this, so a reprint from a second till does not claim to be from
   * that one), and the marker.
   */
  const reprint = () => {
    if (!sale) return;
    setReceipt(
      buildReceiptModel({
        receiptNumber: sale.receiptNumber,
        orderId: sale.saleId,
        lines: sale.lines,
        tenders: sale.tenders,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        cashierName: sale.cashierName,
        deviceLabel: sale.terminalName ?? '',
        receiptHeader: settings.receiptHeader,
        receiptFooter: settings.receiptFooter,
        at: sale.committedAtMillis,
        cashRounding: settings.roundCashTo,
        reprint: true,
      }),
    );
  };

  const page = (children: React.ReactNode) => (
    <PosAdminPage
      icon={<ReceiptIcon size={20} />}
      title={t('pos.sale.pageTitle')}
      subtitle={t('pos.sale.pageSubtitle')}
    >
      {children}
    </PosAdminPage>
  );

  if (state === 'failed') return page(<PanelLoadError onRetry={() => void refresh()} />);
  if (state === 'loading') return page(<div className="cpos-skeleton" style={{ height: 240 }} />);
  if (state === 'missing' || !sale) {
    // An id that no longer exists is worth saying out loud rather than
    // bouncing silently, the same posture `LocalCategoryPage` takes.
    return page(
      <div className="cpos-empty">
        <p className="cpos-empty__title">{t('pos.sale.missing')}</p>
        <div className="cpos-actions">
          <button
            type="button"
            className="cpos-btn cpos-btn--primary"
            onClick={() => push('/pos/sales')}
          >
            {t('pos.sale.backToSales')}
          </button>
        </div>
      </div>,
    );
  }

  const refund = isRefundSale(sale);
  const returned = summariseReturnedLines(sale, refunds);
  const refundedTotal = refunds.reduce((sum, row) => sum + Math.abs(row.total), 0);
  const anythingLeft = sale.lines.some(
    (line, index) => line.quantity - (returned[index]?.quantity ?? 0) > 0,
  );

  return page(
    <>
      {receipt ? (
        <PosReceipt
          model={receipt}
          formatPrice={money}
          autoPrint
          onAfterPrint={() => setReceipt(null)}
        />
      ) : null}

      <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
        {/* push, never back(): this page is reachable from the register too. */}
        <button
          type="button"
          className="cpos-btn cpos-btn--ghost"
          onClick={() => push('/pos/sales')}
        >
          <ChevronLeftIcon size={16} />
          {t('pos.sale.backToSales')}
        </button>
        <button type="button" className="cpos-btn cpos-btn--outline" onClick={reprint}>
          {t('pos.sale.reprint')}
        </button>
        {!refund && can(user?.role, 'sales.refund') && anythingLeft ? (
          <button
            type="button"
            className="cpos-btn cpos-btn--primary"
            onClick={() => setRefunding(true)}
          >
            {t('pos.refund.start')}
          </button>
        ) : null}
      </div>

      {refund ? (
        <div className="cpos-note cpos-note--warning">
          <span style={{ flex: 1 }}>
            {t('pos.sale.isRefundOf', { receipt: sale.originalReceiptNumber ?? '' })}
          </span>
          {sale.originalSaleId ? (
            <button
              type="button"
              className="cpos-rowlink"
              onClick={() => push(`/pos/sales/${sale.originalSaleId}`)}
            >
              {sale.originalReceiptNumber}
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.sale.figures')}</h2>
        <div className="cpos-stats">
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.admin.sales.receipt')}</span>
            <span className="cpos-stat__value">{sale.receiptNumber}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.admin.sales.when')}</span>
            <span className="cpos-stat__value">{formatWhen.format(sale.committedAtMillis)}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.admin.sales.cashier')}</span>
            <span className="cpos-stat__value">{sale.cashierName || '—'}</span>
          </div>
          <div className="cpos-stat">
            <span className="cpos-stat__label">{t('pos.admin.sales.total')}</span>
            <span className={cn('cpos-stat__value', sale.total < 0 && 'cpos-neg')}>
              {money(sale.total)}
            </span>
          </div>
          {refundedTotal > 0 ? (
            <div className="cpos-stat">
              <span className="cpos-stat__label">{t('pos.sale.refunded')}</span>
              <span className="cpos-stat__value cpos-neg">{money(-refundedTotal)}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.sale.lines')}</h2>
        <div className="cpos-tablewrap">
          <table className="cpos-table">
            <thead>
              <tr>
                <th>{t('pos.admin.products.name')}</th>
                <th className="cpos-table__num">{t('pos.store.adjust.quantity')}</th>
                {refunds.length ? (
                  <th className="cpos-table__num">{t('pos.sale.returned')}</th>
                ) : null}
                <th className="cpos-table__num">{t('pos.admin.sales.total')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((line, index) => (
                <tr key={`${line.productId}-${index}`}>
                  <td>
                    <button
                      type="button"
                      className="cpos-rowlink"
                      onClick={() => push(`/pos/store/${line.productId}`)}
                    >
                      {line.name}
                    </button>
                    {line.selectedSize ? (
                      <span className="cpos-muted"> · {line.selectedSize}</span>
                    ) : null}
                    {line.discountReason ? (
                      <div className="cpos-muted">
                        {t('pos.ticket.discount')} · {t(`pos.discount.reason.${line.discountReason}`)}
                      </div>
                    ) : null}
                  </td>
                  <td className="cpos-table__num">{line.quantity}</td>
                  {refunds.length ? (
                    <td className="cpos-table__num">{returned[index]?.quantity || ''}</td>
                  ) : null}
                  <td className={cn('cpos-table__num', line.lineTotal < 0 && 'cpos-neg')}>
                    {money(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.sale.tenders')}</h2>
        {sale.tenders.map((tender, index) => (
          <div key={index} style={{ display: 'flex', gap: 12, fontSize: 13.5 }}>
            <span style={{ minWidth: 90 }}>{t(`pos.tender.${tender.kind}`)}</span>
            <span className={cn(tender.amount < 0 && 'cpos-neg')}>{money(tender.amount)}</span>
            {tender.reference ? <span className="cpos-muted">{tender.reference}</span> : null}
          </div>
        ))}
      </section>

      {refunds.length ? (
        <section className="cpos-section">
          <h2 className="cpos-section__title">{t('pos.sale.refundsAgainst')}</h2>
          {refunds.map((row) => (
            <div key={row.saleId} style={{ display: 'flex', gap: 12, fontSize: 13.5 }}>
              <button
                type="button"
                className="cpos-rowlink"
                onClick={() => push(`/pos/sales/${row.saleId}`)}
              >
                {row.receiptNumber}
              </button>
              <span className="cpos-muted">{formatWhen.format(row.committedAtMillis)}</span>
              <span className="cpos-neg">{money(row.total)}</span>
            </div>
          ))}
        </section>
      ) : null}

      <LocalRefundDialog
        open={refunding}
        onOpenChange={setRefunding}
        sale={sale}
        returned={returned}
        onDone={() => {
          setRefunding(false);
          void refresh();
        }}
      />
    </>,
  );
}
