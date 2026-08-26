'use client';

import { useEffect } from 'react';
import { useT, useFormatDate } from '@caspian-explorer/script-caspian-store';
import type { PosReceiptModel } from './build-receipt-model';

export interface PosReceiptProps {
  model: PosReceiptModel;
  formatPrice: (amount: number) => string;
  /** Fire `window.print()` as soon as this mounts. */
  autoPrint?: boolean;
  onAfterPrint?: () => void;
}

/**
 * An 80 mm thermal receipt, rendered as HTML and printed through the browser.
 *
 * This path works with any printer the computer already has a driver for,
 * including every thermal printer sold with one — which is why it is the
 * default, and would remain the fallback if the direct ESC/POS transports ship. It
 * also renders every glyph correctly, which the byte path cannot promise:
 * ESC/POS is codepage-based and Azerbaijani's `ə` is in no standard codepage.
 *
 * `@page { size: 80mm auto }` asks for a continuous roll rather than a sheet,
 * so the paper cuts just past the last line instead of feeding a full A4.
 */
export function PosReceipt({ model, formatPrice, autoPrint, onAfterPrint }: PosReceiptProps) {
  const t = useT();
  const formatDate = useFormatDate({ dateStyle: 'short', timeStyle: 'short' });

  useEffect(() => {
    if (!autoPrint || typeof window === 'undefined') return;
    const done = () => onAfterPrint?.();
    window.addEventListener('afterprint', done);
    // A frame's delay lets the layout settle; printing during the same tick
    // occasionally captures the pre-paint state on Chromium.
    const id = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener('afterprint', done);
    };
  }, [autoPrint, onAfterPrint]);

  return (
    <div className="caspian-pos-receipt" data-pos-receipt>
      <style>{RECEIPT_CSS}</style>

      {model.storeHeader.map((line, i) => (
        <div key={`h-${i}`} className="rc-center rc-strong">
          {line}
        </div>
      ))}

      <div className="rc-rule" />

      <div className="rc-row">
        <span>{t('pos.receipt.number')}</span>
        <span className="rc-strong">{model.receiptNumber}</span>
      </div>
      {model.provisionalReceipt ? (
        <div className="rc-small rc-muted">{t('pos.receipt.provisional')}</div>
      ) : null}
      <div className="rc-row">
        <span>{t('pos.receipt.date')}</span>
        <span>{formatDate.format(new Date(model.at))}</span>
      </div>
      {model.cashierName ? (
        <div className="rc-row">
          <span>{t('pos.receipt.cashier')}</span>
          <span>{model.cashierName}</span>
        </div>
      ) : null}
      {model.deviceLabel ? (
        <div className="rc-row">
          <span>{t('pos.receipt.register')}</span>
          <span>{model.deviceLabel}</span>
        </div>
      ) : null}

      <div className="rc-rule" />

      {model.lines.map((line, i) => (
        <div key={`l-${i}`} className="rc-line">
          <div className="rc-line-name">
            {line.name}
            {line.size ? ` · ${line.size}` : ''}
          </div>
          <div className="rc-row">
            <span>
              {line.qty} × {formatPrice(line.unitPrice)}
            </span>
            <span>{formatPrice(line.lineTotal)}</span>
          </div>
          {line.lineDiscount > 0 ? (
            <div className="rc-row rc-muted">
              <span>{t('pos.ticket.discount')}</span>
              <span>-{formatPrice(line.lineDiscount)}</span>
            </div>
          ) : null}
        </div>
      ))}

      <div className="rc-rule" />

      <div className="rc-row">
        <span>{t('pos.ticket.subtotal')}</span>
        <span>{formatPrice(model.subtotal)}</span>
      </div>
      {model.discount > 0 ? (
        <div className="rc-row">
          <span>{t('pos.ticket.discountTotal')}</span>
          <span>-{formatPrice(model.discount)}</span>
        </div>
      ) : null}
      <div className="rc-row rc-total">
        <span>{t('pos.ticket.total')}</span>
        <span>{formatPrice(model.total)}</span>
      </div>

      <div className="rc-rule" />

      <div className="rc-muted rc-small">{t('pos.receipt.paidWith')}</div>
      {model.tenders.map((tender, i) => (
        <div key={`t-${i}`}>
          <div className="rc-row">
            <span>{t(`pos.tender.${tender.kind}`)}</span>
            <span>{formatPrice(tender.amount)}</span>
          </div>
          {tender.tendered != null ? (
            <div className="rc-row rc-muted">
              <span>{t('pos.tender.tendered')}</span>
              <span>{formatPrice(tender.tendered)}</span>
            </div>
          ) : null}
          {tender.reference ? (
            <div className="rc-row rc-muted rc-small">
              <span>{t('pos.tender.reference')}</span>
              <span>{tender.reference}</span>
            </div>
          ) : null}
        </div>
      ))}
      {model.changeDue > 0 ? (
        <div className="rc-row rc-strong">
          <span>{t('pos.tender.change')}</span>
          <span>{formatPrice(model.changeDue)}</span>
        </div>
      ) : null}

      <div className="rc-rule" />

      {model.storeFooter.map((line, i) => (
        <div key={`f-${i}`} className="rc-center">
          {line}
        </div>
      ))}
      <div className="rc-center rc-strong rc-thanks">{t('pos.receipt.thanks')}</div>
      {/* The order id in plain text is what a return is looked up by when the
          QR will not scan off a faded thermal print. */}
      <div className="rc-center rc-small rc-muted">{model.orderId}</div>
    </div>
  );
}

const RECEIPT_CSS = `
.caspian-pos-receipt {
  width: 72mm;
  margin: 0 auto;
  padding: 4mm 0;
  font-family: ui-monospace, "Cascadia Mono", "Courier New", monospace;
  font-size: 11px;
  line-height: 1.45;
  color: #000;
  background: #fff;
}
.caspian-pos-receipt .rc-row { display: flex; justify-content: space-between; gap: 8px; }
.caspian-pos-receipt .rc-row > span:last-child { white-space: nowrap; }
.caspian-pos-receipt .rc-center { text-align: center; }
.caspian-pos-receipt .rc-strong { font-weight: 700; }
.caspian-pos-receipt .rc-muted { color: #444; }
.caspian-pos-receipt .rc-small { font-size: 10px; }
.caspian-pos-receipt .rc-total { font-size: 13px; font-weight: 700; margin-top: 2px; }
.caspian-pos-receipt .rc-line { margin-bottom: 3px; }
.caspian-pos-receipt .rc-line-name { word-break: break-word; }
.caspian-pos-receipt .rc-rule { border-top: 1px dashed #000; margin: 5px 0; }
.caspian-pos-receipt .rc-thanks { margin-top: 6px; }

@media print {
  /* Continuous roll, not a sheet — otherwise every receipt ejects an A4 page. */
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  /* Hide the register behind the receipt without unmounting it, so the sale
     state survives the print and the cashier lands back on a live screen.

     This uses visibility rather than display, and that matters. The obvious
     rule — hiding every direct child of <body> except the print root — printed
     a BLANK page, because the print root is not a child of <body>: it sits
     several levels down inside the register's own layout, so the rule hid one
     of its own ancestors and took the receipt with it.

     The visibility property inherits and, unlike display, leaves the box tree
     intact, so hiding an ancestor and re-showing the receipt inside it works
     where the display-based rule could not. The receipt
     is then lifted to the top-left so it does not print where the (now
     invisible, but still laid out) register had pushed it down the page. */
  body * { visibility: hidden !important; }
  .caspian-pos-print-root,
  .caspian-pos-print-root * { visibility: visible !important; }
  .caspian-pos-print-root {
    display: block !important;
    position: absolute !important;
    left: 0; top: 0; width: 100%;
  }
  .caspian-pos-receipt { width: auto; padding: 0; margin: 0 auto; }
}
`;
