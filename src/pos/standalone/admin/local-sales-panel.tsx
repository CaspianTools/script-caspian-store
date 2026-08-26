'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Select } from '../../../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { CashDrawerIcon, ReceiptIcon } from '../../../ui/icons';
import { cn } from '../../../utils/cn';
import { toCsv, type CsvCell } from '../../../utils/csv';
import { listLocalOpeningCash, listLocalSales, readLocalShopSettings } from '../local-db';
import { saveTextFile } from '../local-backup';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { usePosShopSettings } from '../shop-settings-context';
import type { LocalOpeningCash, LocalSale } from '../types';
import { actions, fieldLabel, muted, row, section } from './panel-styles';
import { PanelLoadError } from './panel-load-error';
import { PosAdminPage } from './pos-admin-page';
import { LocalShiftsPanel } from './local-shifts-panel';

type Range = 'today' | 'week' | 'month' | 'all';

function startOf(range: Range): number {
  if (range === 'all') return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (range === 'today') return now.getTime();
  if (range === 'week') return now.getTime() - 6 * 24 * 60 * 60 * 1000;
  return now.getTime() - 29 * 24 * 60 * 60 * 1000;
}

/**
 * What the till started with and what it has taken.
 *
 * Read-only by design: a sale is written once and never edited, so there is
 * nothing here to change. A mistake is corrected by ringing another sale, which
 * is what keeps the paper in a customer's hand matching the record. The
 * opening-cash declarations are read-only for the same reason and are kept
 * apart from the takings -- see the comment on `takings`.
 */
export function LocalSalesPanel() {
  const t = useT();
  const { can } = usePosRoles();
  const session = usePosLocalSession();
  const mayExport = can(session.user?.role, 'sales.export');
  const [sales, setSales] = useState<LocalSale[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openingCash, setOpeningCash] = useState<LocalOpeningCash[] | null>(null);
  const [requireOpeningCash, setRequireOpeningCash] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [range, setRange] = useState<Range>('today');

  const refresh = useCallback(async () => {
    // Guarded because this rejects when IndexedDB will not open, and an
    // unhandled rejection left `sales` null forever -- a permanent "loading"
    // that reads, from the counter, as the day's takings having vanished.
    try {
      const [rows, shop, floats] = await Promise.all([
        listLocalSales(),
        readLocalShopSettings(),
        listLocalOpeningCash(),
      ]);
      setSales(rows);
      setCurrency(shop.currency || 'USD');
      setRequireOpeningCash(shop.requireOpeningCash);
      setOpeningCash(floats);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const format = useMemo(() => {
    return (amount: number) => {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
      } catch {
        return amount.toFixed(2);
      }
    };
  }, [currency]);

  const visible = useMemo(() => {
    const from = startOf(range);
    return (sales ?? []).filter((s) => s.committedAtMillis >= from);
  }, [sales, range]);

  /**
   * The same window the sales list uses, so the two halves of the day's story
   * always answer for the same period and there is no second filter to keep in
   * step with the first.
   */
  const visibleFloats = useMemo(() => {
    const from = startOf(range);
    return (openingCash ?? []).filter((r) => r.confirmedAtMillis >= from);
  }, [openingCash, range]);

  /**
   * The opening float is never added here, and never appears in the sales
   * table. Money the shop put in the drawer is not money the till took, and
   * folding one into the other is an accounting bug that reconciles to nothing.
   */
  const takings = visible.reduce((sum, s) => sum + s.total, 0);

  const exportCsv = () => {
    // `terminal` and `shift` are appended rather than slotted in beside the
    // cashier, so a spreadsheet somebody built against the old export keeps
    // working: every column it knows about is still in the position it was.
    // Both are empty on sales rung before the shop named a counter.
    const rows: CsvCell[][] = [
      [
        'receiptNumber',
        'dateTime',
        'cashier',
        'items',
        'subtotal',
        'discount',
        'total',
        'payment',
        'terminal',
        'shift',
      ],
    ];
    for (const s of visible) {
      rows.push([
        s.receiptNumber,
        new Date(s.committedAtMillis).toISOString(),
        s.cashierName,
        s.lines.reduce((n, l) => n + l.quantity, 0),
        s.subtotal,
        s.discount,
        s.total,
        s.tenders.map((x) => x.kind).join('+'),
        s.terminalName ?? '',
        s.shiftId ?? '',
      ]);
    }
    saveTextFile(`caspian-sales-${range}.csv`, toCsv(rows), 'text/csv');
  };

  const exportOpeningCashCsv = () => {
    const rows: CsvCell[][] = [['dateTime', 'cashier', 'device', 'amount']];
    for (const r of visibleFloats) {
      rows.push([
        new Date(r.confirmedAtMillis).toISOString(),
        r.cashierName,
        r.deviceLabel || r.deviceId,
        r.amount,
      ]);
    }
    saveTextFile(`caspian-opening-cash-${range}.csv`, toCsv(rows), 'text/csv');
  };

  /**
   * A shop that has never used this feature gets no empty box, but a shop that
   * used it and switched it off keeps the history it already produced.
   */
  const showOpeningCash = requireOpeningCash || visibleFloats.length > 0;

  return (
    <div>
      <section style={section}>
        <div style={row}>
          <div style={{ minWidth: 160 }}>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              options={[
                { value: 'today', label: t('pos.admin.sales.today') },
                { value: 'week', label: t('pos.admin.sales.week') },
                { value: 'month', label: t('pos.admin.sales.month') },
                { value: 'all', label: t('pos.admin.sales.all') },
              ]}
            />
          </div>
          <div style={{ marginInlineStart: 'auto', textAlign: 'end' }}>
            <div style={muted}>{t('pos.admin.sales.takings', { count: visible.length })}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{format(takings)}</div>
          </div>
        </div>
        {mayExport ? (
          <div style={actions}>
            <Button variant="outline" onClick={exportCsv} disabled={!visible.length}>
              {t('pos.admin.sales.export')}
            </Button>
          </div>
        ) : null}
      </section>

      {/*
        Between the summary and the sales list. The Monday-morning question is
        "what did the till start with, and what did it take", in that order, so
        the float belongs early in the day's story; sitting above the table also
        means an owner reads it without scrolling past two hundred sales.
      */}
      {showOpeningCash ? (
        <section id="pos-sales-opening-cash" className="cpos-section">
          <div style={row}>
            <span className="cpos-field__label">{t('pos.admin.openingCash.title')}</span>
            <div style={{ marginInlineStart: 'auto', textAlign: 'end' }}>
              <div className="cpos-muted">
                {t('pos.admin.openingCash.declared', { count: visibleFloats.length })}
              </div>
              {/*
                A total only for today. Adding up thirty separate morning floats
                produces a number that describes nothing that ever sat in a
                drawer, and printing it invites somebody to reconcile a month's
                takings against it.
              */}
              {range === 'today' && visibleFloats.length > 0 ? (
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {format(visibleFloats.reduce((sum, r) => sum + r.amount, 0))}
                </div>
              ) : null}
            </div>
          </div>

          {visibleFloats.length === 0 ? (
            <div className="cpos-muted">
              {t(
                range === 'today'
                  ? 'pos.admin.openingCash.emptyToday'
                  : 'pos.admin.openingCash.empty',
              )}
            </div>
          ) : (
            <>
              {mayExport ? (
                <div style={actions}>
                  <Button variant="outline" onClick={exportOpeningCashCsv}>
                    {t('pos.admin.openingCash.export')}
                  </Button>
                </div>
              ) : null}
              <Table>
                <THead>
                  <TR>
                    <TH>{t('pos.admin.sales.when')}</TH>
                    <TH>{t('pos.admin.sales.cashier')}</TH>
                    <TH>{t('pos.admin.openingCash.till')}</TH>
                    <TH>{t('pos.admin.openingCash.amount')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {/*
                    Two counts on one day by one cashier are two rows and stay
                    two rows. That pair is a drawer handover, and it is the
                    exact signal this record exists to keep -- de-duplicating it
                    would erase the thing worth looking at.
                  */}
                  {visibleFloats.slice(0, 60).map((r) => (
                    <TR key={r.id}>
                      <TD>{new Date(r.confirmedAtMillis).toLocaleString()}</TD>
                      <TD>{r.cashierName || '—'}</TD>
                      <TD>{r.deviceLabel || r.deviceId.slice(0, 8)}</TD>
                      <TD>{format(r.amount)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {visibleFloats.length > 60 ? (
                <div className="cpos-muted">
                  {t('pos.admin.sales.truncated', { shown: 60, total: visibleFloats.length })}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.sales.listTitle')}</span>
        {loadFailed ? (
          <PanelLoadError onRetry={() => void refresh()} />
        ) : sales === null ? (
          <div style={muted}>{t('common.loading')}</div>
        ) : visible.length === 0 ? (
          <div style={muted}>
            {/*
              Names the filter, because the picker defaults to Today and an
              empty table under it looks exactly like a till that has lost its
              history. Saying how many sales are on the machine altogether is
              what separates the two.
            */}
            {sales.length > 0
              ? t('pos.admin.sales.emptyForRange', { total: sales.length })
              : t('pos.admin.sales.empty')}
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('pos.admin.sales.receipt')}</TH>
                <TH>{t('pos.admin.sales.when')}</TH>
                <TH>{t('pos.admin.sales.cashier')}</TH>
                <TH>{t('pos.admin.sales.items')}</TH>
                <TH>{t('pos.admin.sales.total')}</TH>
              </TR>
            </THead>
            <TBody>
              {visible.slice(0, 200).map((s) => (
                <TR key={s.saleId}>
                  <TD style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                    {s.receiptNumber}
                  </TD>
                  <TD>{new Date(s.committedAtMillis).toLocaleString()}</TD>
                  <TD>{s.cashierName || '—'}</TD>
                  <TD>{s.lines.reduce((n, l) => n + l.quantity, 0)}</TD>
                  <TD>{format(s.total)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {visible.length > 200 ? (
          <div style={muted}>{t('pos.admin.sales.truncated', { shown: 200, total: visible.length })}</div>
        ) : null}
      </section>
    </div>
  );
}

/** The same panel as the screen it now has to itself. */
export function LocalSalesPage() {
  const t = useT();
  const { settings } = usePosShopSettings();
  const [tab, setTab] = useState<'sales' | 'shifts'>('sales');

  // The tabs appear only once a shop is running shifts. A till that is not
  // gets exactly the screen it had before, with no second tab to wonder about.
  const showShifts = settings.shiftsEnabled;

  return (
    <PosAdminPage
      icon={<ReceiptIcon size={19} />}
      title={t('pos.admin.section.sales')}
      subtitle={t('pos.sales.subtitle')}
    >
      {/*
        The same strip the store screens use, and for the same reason given on
        `StoreScreenNav`: a second sidebar entry for a screen an owner opens
        once a week is a bigger menu on a till that argues for a small one.
      */}
      {showShifts ? (
        <nav className="cpos-segmented" aria-label={t('pos.admin.section.sales')}>
          <button
            type="button"
            className={cn('cpos-segmented__btn', tab === 'sales' && 'cpos-segmented__btn--on')}
            aria-current={tab === 'sales' ? 'page' : undefined}
            onClick={() => setTab('sales')}
          >
            <span className="cpos-segmented__icon">
              <ReceiptIcon size={16} />
            </span>
            <span>{t('pos.admin.section.sales')}</span>
          </button>
          <button
            type="button"
            className={cn('cpos-segmented__btn', tab === 'shifts' && 'cpos-segmented__btn--on')}
            aria-current={tab === 'shifts' ? 'page' : undefined}
            onClick={() => setTab('shifts')}
          >
            <span className="cpos-segmented__icon">
              <CashDrawerIcon size={16} />
            </span>
            <span>{t('pos.shift.list.title')}</span>
          </button>
        </nav>
      ) : null}
      {showShifts && tab === 'shifts' ? <LocalShiftsPanel /> : <LocalSalesPanel />}
    </PosAdminPage>
  );
}
