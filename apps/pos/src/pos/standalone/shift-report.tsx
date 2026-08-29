'use client';

import {
  useFormatDate,
} from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../i18n/use-pos-t';
import { summariseShift, type ShiftTotals } from './shift-totals';
import type { LocalShift } from './types';

/**
 * Hoisted, not inline. `useFormatDate` memoises on `[locale, options]`, and an
 * object literal written at the call site is a new reference every render --
 * which would rebuild an `Intl.DateTimeFormat` on every paint.
 */
const WHEN: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };

export interface ShiftReportProps {
  shift: LocalShift;
  /**
   * The running figures, for a shift that is still open.
   *
   * Ignored once the shift is closed: a closed row carries the totals it was
   * closed at, and those are what get read. Recomputing them would let a sale
   * deleted afterwards, or a clock corrected, change what somebody already
   * signed off on.
   */
  totals?: ShiftTotals;
  formatPrice: (amount: number) => string;
}

/**
 * One table of figures: the X-report on an open shift, the Z-report on a closed
 * one.
 *
 * The same rows either way. The count and the variance are simply absent while
 * the shift is open, because nobody has counted yet -- rather than being shown
 * as zero, which would read as a drawer that came to nothing.
 *
 * There is no refunds line. `priceLocalSale` clamps a total at zero, so this
 * till cannot make a negative sale, and a permanently empty row would imply a
 * returns screen the manual is explicit does not exist.
 */
export function ShiftReport({ shift, totals, formatPrice }: ShiftReportProps) {
  const t = useT();
  const formatWhen = useFormatDate(WHEN);
  const closed = shift.status === 'closed';

  // A closed shift is read off its own frozen fields; an open one off the
  // running figures. `summariseShift(shift, [])` is the floor for an open shift
  // whose sales could not be read -- it still gets the float and the movements.
  const running = totals ?? summariseShift(shift, []);
  const expected = closed ? (shift.expectedCash ?? 0) : running.expectedCash;
  const salesTotal = closed ? (shift.salesTotal ?? 0) : running.salesTotal;
  const saleCount = closed ? (shift.saleCount ?? 0) : running.saleCount;
  const byTender = closed ? (shift.totalsByTender ?? {}) : running.totalsByTender;

  // Summed off the row either way: the movements live on the shift, so an open
  // and a closed report agree without the closed one having frozen a second
  // copy of a figure it already holds the parts of.
  const movedIn = shift.movements
    .filter((m) => m.kind === 'in')
    .reduce((sum, m) => sum + Math.abs(m.amount), 0);
  const movedOut = shift.movements
    .filter((m) => m.kind === 'out')
    .reduce((sum, m) => sum + Math.abs(m.amount), 0);

  const variance = closed ? (shift.variance ?? 0) : null;

  return (
    <div className="cpos-zreport">
      <Row label={t('pos.shift.report.cashier')} value={shift.cashierName} />
      <Row label={t('pos.shift.report.terminal')} value={shift.terminalName} />
      <Row label={t('pos.shift.report.day')} value={shift.businessDay} />
      <Row
        label={t('pos.shift.report.opened')}
        value={formatWhen.format(shift.openedAtMillis)}
      />
      {closed && shift.closedAtMillis ? (
        <Row
          label={t('pos.shift.report.closed')}
          value={formatWhen.format(shift.closedAtMillis)}
        />
      ) : null}

      <Row label={t('pos.shift.report.float')} value={formatPrice(shift.openingFloat)} />
      <Row label={t('pos.shift.report.saleCount')} value={String(saleCount)} />
      <Row label={t('pos.shift.report.salesTotal')} value={formatPrice(salesTotal)} />

      {Object.entries(byTender).map(([kind, amount]) => (
        // Only ever cash, card or other -- `LocalSale.tenders[].kind` is that
        // union -- so the three keys beside it cover every case there is.
        <Row key={kind} label={t(`pos.shift.report.tender.${kind}`)} value={formatPrice(amount)} />
      ))}

      {movedIn ? <Row label={t('pos.shift.report.movedIn')} value={formatPrice(movedIn)} /> : null}
      {movedOut ? (
        <Row label={t('pos.shift.report.movedOut')} value={formatPrice(movedOut)} />
      ) : null}

      <Row label={t('pos.shift.report.expected')} value={formatPrice(expected)} emphasis />

      {closed ? (
        <>
          <Row
            label={t('pos.shift.report.counted')}
            value={formatPrice(shift.countedCash ?? 0)}
            emphasis
          />
          <Row
            label={
              variance === 0
                ? t('pos.shift.varianceExact')
                : (variance ?? 0) < 0
                  ? t('pos.shift.varianceShort')
                  : t('pos.shift.varianceOver')
            }
            value={formatPrice(Math.abs(variance ?? 0))}
            emphasis
            // Colour is never the only signal: the label beside the figure says
            // "over" or "short" in words.
            tone={variance === 0 ? undefined : (variance ?? 0) < 0 ? 'short' : 'over'}
          />
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'short' | 'over';
}) {
  const className = [
    'cpos-zreport__row',
    emphasis ? 'cpos-zreport__row--total' : '',
    tone === 'short' ? 'cpos-zreport__row--short' : '',
    tone === 'over' ? 'cpos-zreport__row--over' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
