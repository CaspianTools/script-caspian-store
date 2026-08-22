'use client';

import { useMemo, useState } from 'react';
import { useT } from '../i18n/locale-context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
 */
function parseAmount(text: string): number {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
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
    <div style={overlay} role="dialog" aria-modal="true" aria-label={t('pos.tender.title')}>
      <div style={panel}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('pos.tender.title')}</h2>

        <div style={dueRow}>
          <span style={{ color: '#666' }}>{t('pos.tender.due')}</span>
          <span style={{ fontSize: 30, fontWeight: 700 }}>{formatPrice(total)}</span>
        </div>

        {tenders.map((tender, index) => (
          <div key={index} style={tenderCard}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['cash', 'card', 'other'] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  size="sm"
                  variant={tender.kind === kind ? 'primary' : 'outline'}
                  onClick={() => update(index, { kind, tendered: '' })}
                >
                  {t(`pos.tender.${kind}`)}
                </Button>
              ))}
              {tenders.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeTender(index)}
                  style={{ marginInlineStart: 'auto' }}
                >
                  {t('pos.tender.removeTender')}
                </Button>
              ) : null}
            </div>

            <label style={fieldLabel}>
              {t('pos.tender.due')}
              <Input
                inputMode="decimal"
                value={tender.amount}
                onChange={(e) => update(index, { amount: e.target.value })}
                style={{ fontSize: 18, textAlign: 'end' }}
              />
            </label>

            {tender.kind === 'cash' ? (
              <label style={fieldLabel}>
                {t('pos.tender.tendered')}
                <Input
                  inputMode="decimal"
                  autoFocus={index === 0}
                  placeholder={tender.amount}
                  value={tender.tendered}
                  onChange={(e) => update(index, { tendered: e.target.value })}
                  style={{ fontSize: 18, textAlign: 'end' }}
                />
              </label>
            ) : (
              <label style={fieldLabel}>
                {t('pos.tender.reference')}
                <Input
                  value={tender.reference}
                  onChange={(e) => update(index, { reference: e.target.value })}
                  placeholder={t('pos.tender.referenceHint')}
                />
              </label>
            )}

            {tender.kind === 'card' ? (
              <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{t('pos.tender.cardPrompt')}</p>
            ) : null}
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addTender}>
          {t('pos.tender.addTender')}
        </Button>

        {!covered ? (
          <div style={{ ...summaryRow, color: '#b45309' }}>
            <span>{t('pos.tender.remaining')}</span>
            <span style={{ fontWeight: 700 }}>{formatPrice(remaining)}</span>
          </div>
        ) : null}

        {changeDue > 0 ? (
          <div style={{ ...summaryRow, background: '#ecfdf5', color: '#065f46' }}>
            <span>{t('pos.tender.change')}</span>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{formatPrice(changeDue)}</span>
          </div>
        ) : null}

        {error ? <p style={{ color: '#b91c1c', fontSize: 13, margin: 0 }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {t('pos.tender.cancel')}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={confirm}
            loading={submitting}
            disabled={!covered || submitting}
            title={!covered ? t('pos.tender.shortfall') : undefined}
          >
            {t('pos.tender.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 60,
};

const panel: React.CSSProperties = {
  background: 'var(--caspian-surface, #fff)',
  color: 'inherit',
  borderRadius: 'var(--caspian-radius, 12px)',
  padding: 20,
  width: 'min(460px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const dueRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
};

const tenderCard: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 'var(--caspian-radius, 8px)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#666',
};

const summaryRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderRadius: 'var(--caspian-radius, 8px)',
  background: '#fffbeb',
};
