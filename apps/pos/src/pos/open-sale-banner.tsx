'use client';

import { useT, useFormatDate, useCaspianNavigation } from '@caspian-explorer/script-caspian-store';
import { usePosOpenSale } from './open-sale-context';

/**
 * "There is a sale here from before."
 *
 * Rendered in the shell rather than in the register so it reaches a cashier
 * wherever the till came back up -- a machine that lost power on the sales
 * screen reopens on the sales screen, and a ticket that only announced itself
 * on /pos would sit there unmentioned until somebody happened to navigate.
 *
 * Resuming is a decision, never an automatic restore. A basket that reappears
 * on its own looks like a scanning fault to the person holding the scanner, and
 * a cashier who does not know something was restored rings the next customer's
 * goods on top of it.
 */
export function PosOpenSaleBanner() {
  const t = useT();
  const { recovered, resume, discard, settledReceipt, acknowledgeSettled, outcomeUnknown } =
    usePosOpenSale();
  const { push } = useCaspianNavigation();
  const formatTime = useFormatDate({ dateStyle: 'short', timeStyle: 'short' });

  // Ranked deliberately. An unknown outcome is the one state where scanning
  // another item silently loses it, so it outranks both an offer and a notice.
  if (outcomeUnknown) {
    return (
      <div role="alert" className="cpos-strip">
        <span className="cpos-strip__spacer">{t('pos.done.outcomeUnknown')}</span>
      </div>
    );
  }

  if (settledReceipt) {
    return (
      <div role="status" className="cpos-strip cpos-strip--brand">
        <span className="cpos-strip__spacer">
          {t('pos.openSale.settled', { receipt: settledReceipt })}
        </span>
        <button
          type="button"
          className="cpos-btn cpos-btn--ghost cpos-btn--sm"
          onClick={acknowledgeSettled}
        >
          {t('pos.openSale.dismiss')}
        </button>
      </div>
    );
  }

  if (!recovered) return null;

  const { record, sameCashier } = recovered;
  const when = formatTime.format(new Date(record.updatedAtMillis));
  const items = record.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div role="status" className="cpos-strip cpos-strip--brand">
      <span className="cpos-strip__spacer">
        {sameCashier
          ? t('pos.openSale.found', { count: items, when })
          : t('pos.openSale.foundOther', { count: items, when, name: record.cashierName })}
      </span>
      <button
        type="button"
        className="cpos-btn cpos-btn--primary cpos-btn--sm"
        onClick={() => {
          resume();
          push('/pos');
        }}
      >
        {t('pos.openSale.resume')}
      </button>
      <button type="button" className="cpos-btn cpos-btn--ghost cpos-btn--sm" onClick={discard}>
        {t('pos.openSale.discard')}
      </button>
    </div>
  );
}
