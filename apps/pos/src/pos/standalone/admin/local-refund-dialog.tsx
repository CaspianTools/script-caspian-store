'use client';

import { useMemo, useState } from 'react';
import { useToast, cn } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../../i18n/use-pos-t';
import { PosDialog } from '../ui/pos-dialog';
import { PosField, PosSelect } from '../ui/pos-field';
import { commitLocalRefund } from '../local-refunds';
import { returnableQuantities, type ReturnedSoFar } from '../price-local-refund';
import { priceLocalRefund } from '../price-local-refund';
import { usePosShopSettings } from '../shop-settings-context';
import { usePosLocalSession } from '../local-session-context';
import { usePosMoney } from '../../use-pos-money';
import { getPosDeviceId } from '../../pos-device';
import { newLocalId } from '../local-db';
import type { LocalRefundReason, LocalSale } from '../types';

const REASONS: LocalRefundReason[] = [
  'faulty',
  'wrong-item',
  'changed-mind',
  'overcharged',
  'other',
];

export interface LocalRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: LocalSale;
  /** What earlier refunds already took back, so the steppers cap correctly. */
  returned: readonly ReturnedSoFar[];
  onDone: () => void;
}

/**
 * Pick what is coming back, say why, and hand the money over.
 *
 * The quantities are capped at what is actually left on each line, so the
 * cashier cannot over-return by trying; `priceLocalRefund` caps again inside
 * the transaction, because two tills can be looking at the same sale.
 *
 * One tender for now. The stored field is an array, so a split refund can be
 * added later without touching a record.
 */
export function LocalRefundDialog({
  open,
  onOpenChange,
  sale,
  returned,
  onDone,
}: LocalRefundDialogProps) {
  const t = useT();
  const { toast } = useToast();
  const { settings } = usePosShopSettings();
  const { user } = usePosLocalSession();
  const money = usePosMoney(settings.currency);

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState<LocalRefundReason>('faulty');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<'cash' | 'card' | 'other'>('cash');
  const [busy, setBusy] = useState(false);

  const caps = useMemo(() => returnableQuantities(sale, returned), [sale, returned]);

  const requests = useMemo(
    () =>
      Object.entries(quantities)
        .map(([index, quantity]) => ({ originalLineIndex: Number(index), quantity }))
        .filter((r) => r.quantity > 0),
    [quantities],
  );

  // Priced here purely to show the figure. The transaction prices it again
  // from its own read of the prior refunds, and that one is the truth.
  const preview = useMemo(
    () => (requests.length ? priceLocalRefund(sale, requests, returned) : null),
    [sale, requests, returned],
  );

  const setQuantity = (index: number, next: number) =>
    setQuantities((current) => ({ ...current, [index]: Math.max(0, Math.min(caps[index], next)) }));

  const submit = async () => {
    if (busy || !preview) return;
    setBusy(true);
    const result = await commitLocalRefund({
      // Minted per attempt, held for the life of this dialog, so a retry after
      // a failed write lands on the same row rather than refunding twice.
      refundId: refundIdFor(sale.saleId, requests),
      originalSaleId: sale.saleId,
      lines: requests,
      tenders: [{ kind, amount: Math.abs(preview.total) }],
      reason,
      note,
      deviceId: getPosDeviceId(),
      cashierId: user?.id ?? '',
      cashierName: user?.displayName ?? '',
      committedAtMillis: Date.now(),
      ...(sale.terminalId ? { terminalId: sale.terminalId } : {}),
      ...(sale.terminalName ? { terminalName: sale.terminalName } : {}),
    });
    setBusy(false);

    if (!result.ok) {
      toast({ title: t(`pos.refund.error.${result.reason}`), variant: 'destructive' });
      return;
    }
    toast({ title: t('pos.refund.done', { receipt: result.refund.receiptNumber }) });
    setQuantities({});
    setNote('');
    onDone();
  };

  return (
    <PosDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('pos.refund.title')}
      description={t('pos.refund.subtitle', { receipt: sale.receiptNumber })}
      closeLabel={t('common.close')}
      foot={
        <>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="cpos-btn cpos-btn--primary cpos-btn--lg"
            onClick={() => void submit()}
            disabled={!preview || busy}
            title={!preview ? t('pos.refund.nothingPicked') : undefined}
          >
            {busy ? <span className="cpos-spinner" aria-hidden="true" /> : null}
            {preview
              ? t('pos.refund.confirm', { amount: money(Math.abs(preview.total)) })
              : t('pos.refund.confirmEmpty')}
          </button>
        </>
      }
    >
      <div className="cpos-tablewrap">
        <table className="cpos-table">
          <thead>
            <tr>
              <th>{t('pos.admin.products.name')}</th>
              <th className="cpos-table__num">{t('pos.refund.returnable')}</th>
              <th className="cpos-table__num">{t('pos.refund.returning')}</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line, index) => {
              const cap = caps[index];
              const picked = quantities[index] ?? 0;
              return (
                <tr key={`${line.productId}-${index}`}>
                  <td>
                    {line.name}
                    {line.selectedSize ? (
                      <span className="cpos-muted"> · {line.selectedSize}</span>
                    ) : null}
                    <div className="cpos-muted">{money(line.lineTotal)}</div>
                  </td>
                  <td className="cpos-table__num">
                    {cap === 0 ? (
                      <span className="cpos-badge">{t('pos.refund.allReturned')}</span>
                    ) : (
                      cap
                    )}
                  </td>
                  <td className="cpos-table__num">
                    {cap === 0 ? null : (
                      <div className="cpos-stepper" style={{ marginInlineStart: 'auto' }}>
                        <button
                          type="button"
                          className="cpos-stepper__btn"
                          aria-label={t('pos.ticket.decrease')}
                          onClick={() => setQuantity(index, picked - 1)}
                        >
                          −
                        </button>
                        <span className="cpos-stepper__value">{picked}</span>
                        <button
                          type="button"
                          className="cpos-stepper__btn"
                          aria-label={t('pos.ticket.increase')}
                          onClick={() => setQuantity(index, picked + 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cpos-row">
        <PosField label={t('pos.refund.reason')} style={{ flex: '1 1 200px' }}>
          <PosSelect
            value={reason}
            options={REASONS.map((value) => ({ value, label: t(`pos.refund.reason.${value}`) }))}
            onChange={(event) => setReason(event.target.value as LocalRefundReason)}
          />
        </PosField>
        <PosField label={t('pos.refund.payBack')} style={{ flex: '1 1 160px' }}>
          <PosSelect
            value={kind}
            options={(['cash', 'card', 'other'] as const).map((value) => ({
              value,
              label: t(`pos.tender.${value}`),
            }))}
            onChange={(event) => setKind(event.target.value as 'cash' | 'card' | 'other')}
          />
        </PosField>
      </div>

      <PosField label={t('pos.refund.note')} help={t('pos.refund.noteHelp')}>
        <input
          className="cpos-input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </PosField>

      {preview ? (
        <div className={cn('cpos-note', 'cpos-note--warning')}>
          <span style={{ flex: 1 }}>{t('pos.refund.summary')}</span>
          <strong>{money(preview.total)}</strong>
        </div>
      ) : null}
    </PosDialog>
  );
}

/**
 * Stable for a given set of picks, so pressing the button twice on a slow write
 * lands on one refund rather than two. Changing the picks mints a new id, which
 * is correct: that is a different refund.
 */
const idCache = new Map<string, string>();
function refundIdFor(saleId: string, requests: readonly { originalLineIndex: number; quantity: number }[]) {
  const key = `${saleId}|${requests.map((r) => `${r.originalLineIndex}:${r.quantity}`).join(',')}`;
  let id = idCache.get(key);
  if (!id) {
    id = newLocalId();
    idCache.set(key, id);
  }
  return id;
}
