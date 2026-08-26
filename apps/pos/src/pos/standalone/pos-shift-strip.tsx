'use client';

import { useMemo } from 'react';
import {
  useT,
  useCaspianNavigation,
  useCaspianStandalone,
} from '@caspian-explorer/script-caspian-store';
import { usePosShift } from './shift-context';

/**
 * The line above the sale screen while a shift is open.
 *
 * Deliberately quiet, and deliberately not a dialog or a badge in the top bar:
 * `pos-topbar.tsx` is a shared file a cloud register renders, and reaching into
 * one of those is the signal a change has stopped being standalone. This is a
 * strip inside the register's own page instead.
 *
 * It carries the two figures a cashier is asked about -- who is on, and what
 * should be in the drawer -- and the way to the counting screen. Everything
 * else about the shift lives at `/pos/shift`, which has no sidebar entry: the
 * icon map lives in `pos-sidebar.tsx`, outside the standalone boundary, and the
 * strip is where somebody is already looking when they want to go home.
 */
export function PosShiftStrip() {
  const t = useT();
  const standalone = useCaspianStandalone();
  const { push } = useCaspianNavigation();
  const { required, shift, totals, currency } = usePosShift();

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

  if (!standalone || !required || !shift) return null;

  return (
    <div className="cpos-shiftstrip">
      <span className="cpos-shiftstrip__who">{shift.cashierName}</span>
      <span>{shift.terminalName}</span>
      <span className="cpos-shiftstrip__fig">
        {t('pos.shift.strip.sales', { count: totals.saleCount })}
      </span>
      <span className="cpos-shiftstrip__fig">
        {t('pos.shift.strip.drawer')} <b>{formatPrice(totals.expectedCash)}</b>
      </span>
      <span className="cpos-shiftstrip__spacer" />
      <span className="cpos-shiftstrip__acts">
        <button type="button" className="cpos-btn cpos-btn--sm" onClick={() => push('/pos/shift')}>
          {t('pos.shift.strip.manage')}
        </button>
      </span>
    </div>
  );
}
