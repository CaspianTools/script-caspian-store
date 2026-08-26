'use client';

import { useMemo, useState } from 'react';
import { useT, cn } from '@caspian-explorer/script-caspian-store';
import { CheckIcon, PlusIcon, XIcon } from '../icons';
import type { PosTenderInput } from './storage/types';

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}
function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/**
 * Round to the smallest coin still in circulation (`0.05` where 1¢/2¢ are
 * withdrawn). Mirrors `roundCash` in functions-pos so the change shown at the
 * till matches the change recorded on the order.
 */
function roundCash(amount: number, step: number): number {
  if (!step || step <= 0) return fromMinor(toMinor(amount));
  const stepMinor = toMinor(step);
  return fromMinor(Math.round(toMinor(amount) / stepMinor) * stepMinor);
}

interface DraftTender {
  kind: 'cash' | 'card' | 'other';
  /** Raw text, not a number — see the note on `parseAmount`. */
  amount: string;
  tendered: string;
  reference: string;
}

/**
 * Parse a keyed amount without fighting the cashier's keyboard.
 *
 * Accepts both `,` and `.` as the decimal separator: a register in Baku or
 * Istanbul has a comma on the numpad, and rejecting it (or worse, silently
 * reading "12,50" as 1250) is how a till ends up 100× out.
 *
 * It must also survive a GROUPING separator, which the previous version did
 * not: `String.replace` with a string argument replaces only the first match,
 * so `1,234.50` became `1.234.50` and `parseFloat` stopped at the second dot
 * and returned **1.234**. On the tendered field that is wrong change handed to
 * a customer, which is the exact failure the note above claims to prevent.
 *
 * The rule: the last separator is the decimal point if one or two digits
 * follow it, and grouping otherwise. `12,50`, `1,234.50` and `1.234,50` all
 * read correctly; `1,234` reads as one thousand two hundred and thirty-four.
 * That last case is genuinely ambiguous between the two conventions, and three
 * trailing digits is grouping far more often than it is a third decimal place
 * in a currency amount.
 */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/\s/g, '');
  if (!cleaned) return 0;

  const decimalAt = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const fractionDigits = decimalAt < 0 ? 0 : cleaned.length - decimalAt - 1;
  const normalized =
    decimalAt >= 0 && fractionDigits >= 1 && fractionDigits <= 2
      ? `${cleaned.slice(0, decimalAt).replace(/[.,]/g, '')}.${cleaned.slice(decimalAt + 1)}`
      : cleaned.replace(/[.,]/g, '');

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
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
  const [tenders, setTenders] = useState<DraftTender[]>([
    { kind: 'cash', amount: total.toFixed(2), tendered: '', reference: '' },
  ]);

  const appliedMinor = tenders.reduce((sum, tender) => sum + toMinor(parseAmount(tender.amount)), 0);
  const totalMinor = toMinor(total);
  const remaining = fromMinor(Math.max(0, totalMinor - appliedMinor));
  const covered = appliedMinor >= totalMinor;

  const changeDue = useMemo(() => {
    let change = 0;
    for (const tender of tenders) {
      if (tender.kind !== 'cash' || !tender.tendered.trim()) continue;
      const given = toMinor(parseAmount(tender.tendered));
      const applied = toMinor(parseAmount(tender.amount));
      if (given > applied) change += given - applied;
    }
    return roundCash(fromMinor(change), cashRounding);
  }, [tenders, cashRounding]);

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
      tenders.map((tender) => {
        const amount = parseAmount(tender.amount);
        const base: PosTenderInput = { kind: tender.kind, amount };
        if (tender.reference.trim()) base.reference = tender.reference.trim();
        if (tender.kind === 'cash' && tender.tendered.trim()) {
          base.tendered = parseAmount(tender.tendered);
        }
        return base;
      }),
    );
  };

  return (
    <div className="cpos-modal" role="dialog" aria-modal="true" aria-label={t('pos.tender.title')}>
      <div className="cpos-modal__panel">
        <h2 className="cpos-modal__title">{t('pos.tender.title')}</h2>

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

        {!covered ? (
          <div className="cpos-note cpos-note--warning">
            <span style={{ flex: 1 }}>{t('pos.tender.remaining')}</span>
            <strong>{formatPrice(remaining)}</strong>
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
            type="button"
            className="cpos-btn cpos-btn--success cpos-btn--lg"
            onClick={confirm}
            disabled={!covered || submitting}
            title={!covered ? t('pos.tender.shortfall') : undefined}
          >
            {submitting ? <span className="cpos-spinner" aria-hidden="true" /> : <CheckIcon size={18} />}
            {t('pos.tender.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
