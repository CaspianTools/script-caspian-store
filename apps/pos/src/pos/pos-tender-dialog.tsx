'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';
import { CheckIcon, PlusIcon, XIcon } from '../icons';
import type { PosTenderInput } from './storage/types';
import { fromMinor, toMinor } from './money';
import { parseAmount } from './parse-amount';
import { splitTenders, type TenderDraftAmounts } from './tender-allocation';
import { usePosOverlay } from './standalone/ui/pos-dialog';

interface DraftTender {
  kind: 'cash' | 'card' | 'other';
  /** Raw text, not a number — see the note on `parseAmount`. */
  amount: string;
  tendered: string;
  reference: string;
}

export interface PosTenderDialogProps {
  total: number;
  formatPrice: (amount: number) => string;
  /** From `PosSettings.roundCashTo`. 0 disables cash rounding. */
  cashRounding?: number;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (tenders: PosTenderInput[]) => void;
}

/**
 * Takes payment for the open sale.
 *
 * Starts on the common case — one cash tender, exact amount — and only grows
 * into a split when the cashier asks for it. The confirm button stays disabled
 * until the tendered amounts actually cover the total, because the server
 * refuses a short sale anyway and finding that out after the customer has
 * walked off is worse than finding out here.
 */
export function PosTenderDialog({
  total,
  formatPrice,
  cashRounding = 0,
  submitting,
  error,
  onCancel,
  onConfirm,
}: PosTenderDialogProps) {
  const t = useT();
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const containers = useRef([modalRef]).current;

  /**
   * The overlay contract, with two refusals stated rather than accidental.
   *
   * `dismissOn: {}` means no Escape and no backdrop click. A cashier holding a
   * customer's cash with a card machine mid-transaction must not lose a split
   * tender to a stray key or a misplaced tap. That was already the behaviour,
   * but only because two `useEffect`s had never been written; now it is a
   * decision at the call site.
   *
   * What it gains is the rest of the contract, all of which it lacked: Tab used
   * to walk straight out of the payment sheet onto the quantity buttons behind
   * it, so a keyboard or screen-reader user could change the basket while
   * taking money for it. The ticket, Clear and Pay are now `inert`.
   *
   * The keyboard's way out is Tab to Cancel. Say so here so nobody "fixes" the
   * missing Escape later.
   */
  usePosOverlay({ open: true, containers, onDismiss: onCancel, dismissOn: {} });

  const [tenders, setTenders] = useState<DraftTender[]>([
    { kind: 'cash', amount: total.toFixed(2), tendered: '', reference: '' },
  ]);

  const totalMinor = toMinor(total);
  const split = useMemo(() => {
    const drafts: TenderDraftAmounts[] = tenders.map((tender) => ({
      kind: tender.kind,
      amountMinor: toMinor(parseAmount(tender.amount)),
      cashGivenMinor:
        tender.kind === 'cash' && tender.tendered.trim()
          ? toMinor(parseAmount(tender.tendered))
          : null,
    }));
    return splitTenders(totalMinor, drafts, toMinor(cashRounding));
  }, [tenders, totalMinor, cashRounding]);

  const remaining = fromMinor(split.shortfallMinor);
  const changeDue = fromMinor(split.changeMinor);
  const overNonCash = fromMinor(split.overNonCashMinor);
  const covered = split.covered;

  const update = (index: number, patch: Partial<DraftTender>) => {
    setTenders((current) => current.map((tender, i) => (i === index ? { ...tender, ...patch } : tender)));
  };

  const addTender = () => {
    setTenders((current) => [
      ...current,
      { kind: 'card', amount: remaining.toFixed(2), tendered: '', reference: '' },
    ]);
  };

  const removeTender = (index: number) => {
    setTenders((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  };

  const confirm = () => {
    if (!covered || submitting) return;
    onConfirm(
      tenders.map((tender, index) => {
        // `amount` is what this tender COVERED, not what the box said. The two
        // differ whenever the cashier over-typed a box, and `shift-totals.ts`
        // reads this figure as the cash that netted into the drawer -- so
        // writing the box through is a drawer that closes over.
        const base: PosTenderInput = {
          kind: tender.kind,
          amount: fromMinor(split.appliedMinor[index] ?? 0),
        };
        if (tender.reference.trim()) base.reference = tender.reference.trim();
        if (tender.kind === 'cash' && tender.tendered.trim()) {
          // Verbatim: this is what physically went into the drawer and what
          // prints on the slip, so it is not the allocated figure.
          base.tendered = parseAmount(tender.tendered);
        }
        return base;
      }),
    );
  };

  return (
    <div ref={modalRef} className="cpos-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/*
        A <form>, not a <div>. `.cpos-modal__panel` is a class rather than an
        element selector, so the flex column and its gap are untouched -- and
        Enter now completes the sale from the cash field it starts in, which is
        where a cashier's hand already is. Every other button in this file is
        `type="button"`, so implicit submission cannot fire the wrong one;
        anyone adding a button here must keep that true.
      */}
      <form className="cpos-modal__panel" onSubmit={(event) => { event.preventDefault(); confirm(); }}>
        <h2 className="cpos-modal__title" id={titleId}>{t('pos.tender.title')}</h2>

        <div className="cpos-modal__due">
          <span className="cpos-modal__duelabel">{t('pos.tender.due')}</span>
          <span className="cpos-modal__duevalue">{formatPrice(total)}</span>
        </div>

        {tenders.map((tender, index) => (
          <div key={index} className="cpos-tender">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {(['cash', 'card', 'other'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={cn(
                    'cpos-btn',
                    'cpos-btn--sm',
                    tender.kind === kind ? 'cpos-btn--primary' : 'cpos-btn--outline',
                  )}
                  aria-pressed={tender.kind === kind}
                  onClick={() => update(index, { kind, tendered: '' })}
                >
                  {t(`pos.tender.${kind}`)}
                </button>
              ))}
              {tenders.length > 1 ? (
                <button
                  type="button"
                  className="cpos-iconbtn"
                  style={{ marginInlineStart: 'auto' }}
                  aria-label={t('pos.tender.removeTender')}
                  onClick={() => removeTender(index)}
                >
                  <XIcon size={17} />
                </button>
              ) : null}
            </div>

            <label className="cpos-field">
              <span className="cpos-field__label">{t('pos.tender.due')}</span>
              <input
                className="cpos-input"
                inputMode="decimal"
                value={tender.amount}
                onChange={(e) => update(index, { amount: e.target.value })}
                style={{ fontSize: 19, fontWeight: 650, textAlign: 'end' }}
              />
            </label>

            {tender.kind === 'cash' ? (
              <label className="cpos-field">
                <span className="cpos-field__label">{t('pos.tender.tendered')}</span>
                <input
                  className="cpos-input"
                  inputMode="decimal"
                  autoFocus={index === 0}
                  placeholder={tender.amount}
                  value={tender.tendered}
                  onChange={(e) => update(index, { tendered: e.target.value })}
                  style={{ fontSize: 19, fontWeight: 650, textAlign: 'end' }}
                />
              </label>
            ) : (
              <label className="cpos-field">
                <span className="cpos-field__label">{t('pos.tender.reference')}</span>
                <input
                  className="cpos-input"
                  value={tender.reference}
                  onChange={(e) => update(index, { reference: e.target.value })}
                  placeholder={t('pos.tender.referenceHint')}
                />
              </label>
            )}

            {tender.kind === 'card' ? (
              <p className="cpos-muted" style={{ margin: 0 }}>
                {t('pos.tender.cardPrompt')}
              </p>
            ) : null}
          </div>
        ))}

        <button type="button" className="cpos-btn cpos-btn--ghost cpos-btn--sm" onClick={addTender}>
          <PlusIcon size={15} />
          {t('pos.tender.addTender')}
        </button>

        {remaining > 0 ? (
          <div className="cpos-note cpos-note--warning" role="status">
            <span style={{ flex: 1 }}>{t('pos.tender.remaining')}</span>
            <strong>{formatPrice(remaining)}</strong>
          </div>
        ) : null}

        {overNonCash > 0 ? (
          <div className="cpos-note cpos-note--warning" role="status">
            <span style={{ flex: 1 }}>{t('pos.tender.overAllocated')}</span>
            <strong>{formatPrice(overNonCash)}</strong>
          </div>
        ) : null}

        {changeDue > 0 ? (
          <div className="cpos-note cpos-note--success" style={{ alignItems: 'baseline' }}>
            <span style={{ flex: 1 }}>{t('pos.tender.change')}</span>
            <strong style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {formatPrice(changeDue)}
            </strong>
          </div>
        ) : null}

        {error ? (
          <div className="cpos-note cpos-note--danger" role="alert">
            {error}
          </div>
        ) : null}

        <div className="cpos-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            onClick={onCancel}
            disabled={submitting}
          >
            {t('pos.tender.cancel')}
          </button>
          <button
            type="submit"
            className="cpos-btn cpos-btn--success cpos-btn--lg"
            disabled={!covered || submitting}
            title={!covered ? t('pos.tender.shortfall') : undefined}
          >
            {submitting ? <span className="cpos-spinner" aria-hidden="true" /> : <CheckIcon size={18} />}
            {t('pos.tender.confirm')}
          </button>
        </div>
      </form>
    </div>
  );
}
