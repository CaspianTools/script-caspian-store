'use client';

import { useCallback, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useCaspianStandalone, useToast, cn } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../../i18n/use-pos-t';
import { CashDrawerIcon } from '../../icons';
import { parseAmount } from '../parse-amount';
import { usePosLocalSession } from './local-session-context';
import type { OpeningCashGate } from './opening-cash';
import { usePosOpeningCash } from './opening-cash-context';
import { usePosMoney } from '../use-pos-money';

/** Why the register is shut, narrowed off the gate's own union so the two cannot drift. */
export type PosOpeningCashReason = Extract<OpeningCashGate, { satisfied: false }>['reason'];

/**
 * A drawer nobody could plausibly have counted. Above this the cashier has hit
 * a stuck key, not opened a very good shop.
 */
const MAX_OPENING_CASH = 1_000_000_000;

/**
 * The figure above which an amount with no decimal separator is more likely to
 * be minor units than major ones — `1500` for `15.00`. Warned about, never
 * corrected: a shop really may open with fifteen thousand units.
 */
const MINOR_UNIT_SUSPICION = 1000;

export interface PosOpeningCashGateProps {
  children: ReactNode;
  /** Override price rendering. Defaults to the shop currency via `Intl`. */
  formatPrice?: (amount: number) => string;
}

/**
 * Replaces the sale screen with a single-field form until the drawer has been
 * declared, and gets out of the way the moment it has.
 *
 * Wraps only the register. The sidebar, the top bar and every other screen stay
 * fully operable behind it — a cashier who cannot count the drawer yet can
 * still reach Sales, Settings and Sign out, which is why this is not a dialog
 * (see `PosOpeningCashPanel`).
 *
 * **This is a shrinkage control, not a security boundary, and it must never be
 * hardened into one.** If IndexedDB is blocked, `readLocalShopSettings` falls
 * back to `DEFAULT_LOCAL_SHOP_SETTINGS`, `requireOpeningCash` reads false and
 * the till sells. That is the right failure direction: the worst case here is a
 * morning with no drawer count on record, and the worst case of the other
 * direction is a shop that cannot trade because of a browser setting. Nothing
 * downstream consults this either — `commitLocalSale` does not know it exists.
 */
export function PosOpeningCashGate({
  children,
  formatPrice: formatPriceProp,
}: PosOpeningCashGateProps): ReactNode {
  const t = useT();
  const { toast } = useToast();
  const standalone = useCaspianStandalone();
  const { user } = usePosLocalSession();
  const { required, loading, gate, confirmation, currency, confirm } = usePosOpeningCash();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackPrice = usePosMoney(currency);
  const formatPrice = formatPriceProp ?? fallbackPrice;

  const onConfirm = useCallback(
    async (amount: number) => {
      setSubmitting(true);
      setError(null);
      const row = await confirm(amount);
      setSubmitting(false);
      if (!row) {
        // The record IS the feature. A write that failed leaves the register
        // shut and the field as the cashier typed it, so the next attempt is
        // one tap rather than a recount.
        setError(t('pos.openingCash.failed'));
        return;
      }
      // Announced through the toast stack rather than a live region in the
      // panel, because the panel unmounts in the same commit that accepts the
      // declaration — the register appearing is the only other feedback there
      // is, and that is a visual change a screen reader does not report.
      toast({ title: t('pos.openingCash.recorded', { amount: formatPrice(row.amount) }) });
    },
    [confirm, t, toast, formatPrice],
  );

  if (!standalone) return children;

  // Never render the register first and swap it out. `PosRegister` installs the
  // barcode wedge and focuses the scan box on mount, so a flash of it would arm
  // a scanner behind a form that is about to replace it.
  if (loading) {
    return (
      <div className="cpos-page">
        <div className="cpos-skeleton" style={{ height: 34, width: 260, marginBottom: 12 }} />
        <div className="cpos-skeleton" style={{ height: 18, width: 380, marginBottom: 22 }} />
        <div className="cpos-skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  if (!required || !gate.required || gate.satisfied) return children;

  return (
    <PosOpeningCashPanel
      cashierName={user?.displayName || user?.username || ''}
      formatPrice={formatPrice}
      reason={gate.reason}
      previousAmount={confirmation?.amount}
      submitting={submitting}
      error={error}
      onConfirm={onConfirm}
    />
  );
}

export interface PosOpeningCashPanelProps {
  /** Whose drawer is being declared. Two cashiers share one till often enough to say. */
  cashierName: string;
  formatPrice: (amount: number) => string;
  reason: PosOpeningCashReason;
  /** The amount being superseded, quoted back on a fresh sign-in. */
  previousAmount?: number;
  submitting: boolean;
  error: string | null;
  onConfirm: (amount: number) => void;
}

/**
 * The form itself, with no storage and no session in it.
 *
 * Split out so the part that decides what a cashier may type can be read and
 * argued about without an IndexedDB transaction in the frame.
 *
 * Four deliberate omissions, each of which looks like a bug until you know why:
 *
 * 1. **It is a `<form>`, not `role="dialog"`, and carries no `aria-modal`.** The
 *    sidebar behind it really is operable, and `aria-modal="true"` would hide
 *    from a screen reader the exact escape routes this design promises — Sales,
 *    Settings, Sign out. Announcing a trap that is not there is worse than
 *    announcing nothing. (It also happens to matter that
 *    `use-barcode-scanner.ts` suppresses the wedge inside `[role="dialog"]`,
 *    but that is moot here: `PosRegister` is not mounted at all while this
 *    renders, so no scan listener exists to suppress.)
 * 2. **No focus trap.** Tab must reach the sidebar and Sign out. WCAG 2.1.2 (No
 *    Keyboard Trap) is satisfied here by design rather than by accident — do
 *    not "fix" this by adding one.
 * 3. **Body scroll is not locked.** The shell around this stays usable, and a
 *    locked body would make the other screens unreachable on a short till.
 * 4. **Escape does nothing.** There is nowhere to escape to; a key that
 *    sometimes dismisses and sometimes does not is worse than one that never
 *    does.
 */
export function PosOpeningCashPanel({
  cashierName,
  formatPrice,
  reason,
  previousAmount,
  submitting,
  error,
  onConfirm,
}: PosOpeningCashPanelProps) {
  const t = useT();
  const fieldId = useId();
  const headingId = `${fieldId}-h`;
  const hintId = `${fieldId}-hint`;
  const [typed, setTyped] = useState('');

  const raw = typed.trim();
  // Never `parseFloat`. `parseAmount` reads `12,50`, `1,234.50` and `1.234,50`
  // the way the cashier's own numpad means them; the naive version once turned
  // `1,234.50` into 1.234 and handed out the wrong change.
  const value = parseAmount(raw);
  const typedSeparator = /[.,]/.test(raw);

  // The ladder, first match wins, one note slot. Order matters: a rule that
  // blocks must be reached before a rule that merely warns, or a typo gets a
  // gentle nudge and an enabled button.
  let tone: 'danger' | 'warning' | null = null;
  let note: string | null = null;
  let blocked = false;

  if (!raw) {
    // No note at all — an untouched field is not a mistake yet. The disabled
    // button explains itself on hover instead.
    blocked = true;
  } else if (/[^0-9.,\s]/.test(raw)) {
    // Also how a typed `-50` is refused in words: `parseAmount` clamps a
    // negative to 0, and echoing `0.00` back at someone who typed `-50` reads
    // as the field having eaten the minus rather than rejected it.
    tone = 'danger';
    note = t('pos.openingCash.notANumber');
    blocked = true;
  } else if (value > MAX_OPENING_CASH) {
    tone = 'danger';
    note = t('pos.openingCash.tooLarge');
    blocked = true;
  } else if (value >= MINOR_UNIT_SUSPICION && !typedSeparator) {
    // Warned, not corrected, and with no "fix it for me" button: a mis-tap that
    // silently divides a real drawer count by 100 is worse than the slip it
    // was meant to prevent.
    tone = 'warning';
    note = t('pos.openingCash.noDecimal', { suggestion: formatPrice(value / 100) });
  } else if (value === 0) {
    // Zero is valid — a card-only counter opens with an empty drawer — but an
    // empty field and a typed zero have to be different gestures, or every
    // cashier taps straight through without counting.
    tone = 'warning';
    note = t('pos.openingCash.emptyDrawer');
  }

  const body =
    reason === 'new-day'
      ? t('pos.openingCash.newDayBody')
      : reason === 'new-sign-in' && previousAmount !== undefined
        ? t('pos.openingCash.againBody', { amount: formatPrice(previousAmount) })
        : reason === 'other-device'
          ? t('pos.openingCash.otherDeviceBody')
          : // 'never', 'no-cashier', and a 'new-sign-in' with nothing to quote.
            t('pos.openingCash.body');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blocked || submitting) return;
    onConfirm(value);
  };

  return (
    // Labelled by its own <h1>: on this route the gate is the whole of <main>,
    // so the heading that names the page and the heading that names the form
    // are the same heading.
    <form className="cpos-opencash" aria-labelledby={headingId} onSubmit={submit}>
      <div className="cpos-opencash__head">
        <span className="cpos-opencash__mark">
          <CashDrawerIcon size={24} />
        </span>
        <h1 className="cpos-opencash__h" id={headingId}>
          {t('pos.openingCash.title')}
        </h1>
        <p className="cpos-opencash__sub">{body}</p>
        {cashierName ? <p className="cpos-opencash__sub">{cashierName}</p> : null}
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor={fieldId}>
          {t('pos.openingCash.amount')}
        </label>
        <input
          className="cpos-input cpos-opencash__amount"
          id={fieldId}
          value={typed}
          // The first thing at the counter, and `inputMode="decimal"` raises the
          // numeric keypad on a tablet till. Enter submits, because this is a
          // real form and not a dialog pretending to be one.
          autoFocus
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={tone === 'danger' || undefined}
          aria-describedby={hintId}
          onChange={(e) => setTyped(e.target.value)}
        />
        {raw ? (
          // Visual only, and `aria-hidden` on purpose: it duplicates what the
          // input itself announces, and re-reading a currency string on every
          // keystroke makes the field unusable with a screen reader. Its job is
          // to catch a decimal slip with the eye.
          <span
            className={cn('cpos-opencash__echo', value === 0 && 'cpos-opencash__echo--zero')}
            aria-hidden="true"
          >
            {formatPrice(value)}
          </span>
        ) : null}
        <p className="cpos-opencash__sub" id={hintId}>
          {t('pos.openingCash.amountHint')}
        </p>
      </div>

      {/*
        In the DOM from first paint with only its child changing. A role="status"
        node that mounts at the same instant its text appears is unreliable in
        NVDA and JAWS — the announcement is lost about as often as it lands.
        Colour is never the only signal: every note here is a full sentence.
      */}
      <div aria-live="polite" role="status">
        {note ? (
          <div
            className={cn(
              'cpos-note',
              tone === 'danger' ? 'cpos-note--danger' : 'cpos-note--warning',
            )}
          >
            {note}
          </div>
        ) : null}
      </div>

      {/* The save failure is blocking, so it interrupts rather than waits. */}
      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="cpos-opencash__foot">
        <button
          type="submit"
          className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
          disabled={blocked || submitting}
          title={!raw ? t('pos.openingCash.needAmount') : undefined}
        >
          {submitting ? <span className="cpos-spinner" aria-hidden="true" /> : null}
          {submitting ? t('pos.openingCash.confirming') : t('pos.openingCash.confirm')}
        </button>
        <p className="cpos-opencash__sub">{t('pos.openingCash.elsewhere')}</p>
      </div>
    </form>
  );
}
