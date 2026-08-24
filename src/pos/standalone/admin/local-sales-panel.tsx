'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Select } from '../../../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { ReceiptIcon } from '../../../ui/icons';
import { toCsv, type CsvCell } from '../../../utils/csv';
import { listLocalSales, readLocalShopSettings } from '../local-db';
import { saveTextFile } from '../local-backup';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import type { LocalSale } from '../types';
import { actions, fieldLabel, muted, row, section } from './panel-styles';
import { PosAdminPage } from './pos-admin-page';

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
 * What the till has taken.
 *
 * Read-only by design: a sale is written once and never edited, so there is
 * nothing here to change. A mistake is corrected by ringing another sale, which
 * is what keeps the paper in a customer's hand matching the record.
 */
export function LocalSalesPanel() {
  const t = useT();
  const { can } = usePosRoles();
  const session = usePosLocalSession();
  const mayExport = can(session.user?.role, 'sales.export');
  const [sales, setSales] = useState<LocalSale[] | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [range, setRange] = useState<Range>('today');

  const refresh = useCallback(async () => {
    const [rows, shop] = await Promise.all([listLocalSales(), readLocalShopSettings()]);
    setSales(rows);
    setCurrency(shop.currency || 'USD');
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

  const takings = visible.reduce((sum, s) => sum + s.total, 0);

  const exportCsv = () => {
    const rows: CsvCell[][] = [
      ['receiptNumber', 'dateTime', 'cashier', 'items', 'subtotal', 'discount', 'total', 'payment'],
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
      ]);
    }
    saveTextFile(`caspian-sales-${range}.csv`, toCsv(rows), 'text/csv');
  };

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

      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.sales.listTitle')}</span>
        {sales === null ? (
          <div style={muted}>{t('common.loading')}</div>
        ) : visible.length === 0 ? (
          <div style={muted}>{t('pos.admin.sales.empty')}</div>
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
  return (
    <PosAdminPage
      icon={<ReceiptIcon size={19} />}
      title={t('pos.admin.section.sales')}
      subtitle={t('pos.sales.subtitle')}
    >
      <LocalSalesPanel />
    </PosAdminPage>
  );
}
