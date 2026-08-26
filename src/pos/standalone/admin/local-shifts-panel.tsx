'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { readLocalShopSettings } from '../local-db';
import { listLocalShifts, summariseLocalShift } from '../local-shifts';
import { ShiftReport } from '../shift-report';
import type { ShiftTotals } from '../shift-totals';
import type { LocalShift } from '../types';
import { PanelLoadError } from './panel-load-error';

/**
 * Every turn worked at every counter, newest first.
 *
 * Read-only, like the sales list beside it and for the same reason: a closed
 * shift is a record of what somebody counted, and a screen that could edit one
 * would be a screen that could make a variance disappear. A miscount is put
 * right by a cash movement on the next shift.
 */
export function LocalShiftsPanel() {
  const t = useT();
  const [shifts, setShifts] = useState<LocalShift[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * Running figures for an OPEN shift being viewed here.
   *
   * A closed shift is read off the totals it was closed at and needs none of
   * this. An open one has none frozen yet, and rendering it without them would
   * show an expected figure of float-plus-movements -- understated by the whole
   * day's cash takings, which is the one number this screen exists to show.
   */
  const [liveTotals, setLiveTotals] = useState<ShiftTotals | null>(null);

  const refresh = useCallback(async () => {
    // Guarded because this rejects when IndexedDB will not open, and an
    // unhandled rejection would leave the list null forever.
    try {
      const [rows, shop] = await Promise.all([listLocalShifts(), readLocalShopSettings()]);
      setShifts(rows);
      setCurrency(shop.currency);
      setLoadFailed(false);
    } catch {
      setShifts([]);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const formatPrice = useMemo(
    () => (amount: number) => {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
      } catch {
        return amount.toFixed(2);
      }
    },
    [currency],
  );

  const opened = shifts?.find((s) => s.id === openId) ?? null;

  useEffect(() => {
    if (!opened || opened.status !== 'open') {
      setLiveTotals(null);
      return;
    }
    let alive = true;
    summariseLocalShift(opened)
      .then((next) => {
        if (alive) setLiveTotals(next);
      })
      .catch(() => {
        // Leaves `liveTotals` null, so the report falls back to the float and
        // the movements rather than refusing to render.
        if (alive) setLiveTotals(null);
      });
    return () => {
      alive = false;
    };
  }, [opened]);

  return (
    <>
      <section className="cpos-section">
        <strong>{t('pos.shift.list.title')}</strong>
        {loadFailed ? <PanelLoadError onRetry={refresh} /> : null}
        {shifts === null ? (
          <div className="cpos-skeleton" style={{ height: 120 }} />
        ) : shifts.length === 0 ? (
          <p className="cpos-muted">{t('pos.shift.list.empty')}</p>
        ) : (
          <div className="cpos-tablewrap">
            <table className="cpos-table">
              <thead>
              <tr>
                <th>{t('pos.shift.list.colDay')}</th>
                <th>{t('pos.shift.list.colCashier')}</th>
                <th>{t('pos.shift.list.colTerminal')}</th>
                <th>{t('pos.shift.list.colSales')}</th>
                <th>{t('pos.shift.list.colVariance')}</th>
                <th style={{ textAlign: 'right' }}>{t('pos.shift.list.colActions')}</th>
              </tr>
              </thead>
              <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td style={{ fontSize: 13 }}>{shift.businessDay}</td>
                  <td>{shift.cashierName}</td>
                  <td>{shift.terminalName}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {shift.status === 'open'
                      ? t('pos.shift.list.stillOpen')
                      : formatPrice(shift.salesTotal ?? 0)}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {/*
                      An open shift has no variance because nobody has counted
                      yet. Shown as a dash rather than as zero, which would read
                      as a drawer that balanced.
                    */}
                    {shift.status === 'open' || shift.variance === undefined
                      ? '—'
                      : shift.variance === 0
                        ? t('pos.shift.varianceExact')
                        : `${shift.variance < 0 ? '−' : '+'}${formatPrice(Math.abs(shift.variance))}`}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="cpos-btn cpos-btn--outline cpos-btn--sm"
                      onClick={() => setOpenId(openId === shift.id ? null : shift.id)}>
                      {openId === shift.id ? t('pos.shift.list.hide') : t('pos.shift.list.view')}
                    </button>
                  </td>
                </tr>
              ))}
              </tbody>
          </table>
        </div>
        )}
      </section>

      {opened ? (
        <section className="cpos-section">
          <strong>{t('pos.shift.zTitle')}</strong>
          <ShiftReport shift={opened} totals={liveTotals ?? undefined} formatPrice={formatPrice} />
        </section>
      ) : null}
    </>
  );
}
