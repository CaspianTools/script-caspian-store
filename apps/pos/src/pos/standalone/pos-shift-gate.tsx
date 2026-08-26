'use client';

import { useCallback, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  useT,
  useCaspianNavigation,
  useCaspianStandalone,
  useToast,
  cn,
} from '@caspian-explorer/script-caspian-store';
import { CashDrawerIcon } from '../../icons';
import { parseAmount } from '../pos-tender-dialog';
import { usePosLocalSession } from './local-session-context';
import { usePosShift } from './shift-context';
import { usePosTerminal } from './terminal-context';

/**
 * A float nobody could plausibly have counted. Above this the cashier has hit a
 * stuck key, not opened a very good shop. Matches `PosOpeningCashGate`.
 */
const MAX_OPENING_FLOAT = 1_000_000_000;

/**
 * The figure above which an amount with no decimal separator is more likely to
 * be minor units than major ones -- `1500` for `15.00`. Warned about, never
 * corrected: a shop really may open with fifteen thousand units.
 */
const MINOR_UNIT_SUSPICION = 1000;

/**
 * Replaces the sale screen with the float box until a shift is open, and gets
 * out of the way the moment one is.
 *
 * Sits inside `PosTerminalClaimGate`, because a shift belongs to a counter, and
 * outside `PosOpeningCashGate`, which it supersedes: when shifts are on, the
 * float IS the drawer declaration and asking both would put the same question
 * to a cashier twice with two different answers on file. `PosRegister` sees
 * whichever of the two a shop has switched on, and never both.
 *
 * Wraps only the register, so the sidebar and every other route stay operable
 * behind it -- see the four deliberate omissions on `PosOpeningCashPanel`, all
 * of which apply here for the same reasons.
 */
export function PosShiftGate({ children }: { children: ReactNode }): ReactNode {
  const t = useT();
  const { toast } = useToast();
  const standalone = useCaspianStandalone();
  const { user } = usePosLocalSession();
  const { terminal } = usePosTerminal();
  const { loading, gate, currency, start } = usePosShift();

  const fieldId = useId();
  const headingId = `${fieldId}-h`;
  const hintId = `${fieldId}-hint`;
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const openShift = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      const result = await start(parseAmount(typed.trim()));
      setSubmitting(false);
      if (!result.ok) {
        // The record IS the feature. A write that failed leaves the register
        // shut and the field as the cashier typed it, so the next attempt is
        // one tap rather than a recount.
        setError(t('pos.shift.openFailed'));
        return;
      }
      setTyped('');
      // Announced through the toast stack rather than a live region here,
      // because this panel unmounts in the same commit that accepts the float.
      toast({ title: t('pos.shift.opened', { amount: formatPrice(result.shift.openingFloat) }) });
    },
    [submitting, start, typed, t, toast, formatPrice],
  );

  if (!standalone) return children;

  if (loading) {
    return (
      <div className="cpos-page">
        <div className="cpos-skeleton" style={{ height: 34, width: 260, marginBottom: 12 }} />
        <div className="cpos-skeleton" style={{ height: 18, width: 380, marginBottom: 22 }} />
        <div className="cpos-skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  if (!gate.required || gate.satisfied) return children;

  // Somebody else is still on this drawer. The answer is a handover, not a
  // second shift on one pile of cash, so this offers their Close and nothing
  // else -- the counting screen is reached through it.
  if (gate.reason === 'other-cashier') {
    return (
      <HandoverPanel
        headingId={headingId}
        cashierName={gate.shift.cashierName}
        terminalName={gate.shift.terminalName}
      />
    );
  }

  // No counter to open a shift at. Reachable by one route only: shifts were
  // switched on, and then every counter was removed from the roster -- nothing
  // refuses that, because refusing it would mean a shop could not tidy up its
  // own list. Says so plainly rather than showing a float box whose Open button
  // could only ever fail, which is what a cashier would otherwise meet.
  if (gate.reason === 'no-terminal') {
    return (
      <div className="cpos-gate" aria-labelledby={headingId}>
        <div className="cpos-gate__head">
          <span className="cpos-gate__mark">
            <CashDrawerIcon size={24} />
          </span>
          <h1 className="cpos-gate__h" id={headingId}>
            {t('pos.shift.noTerminalTitle')}
          </h1>
          <p className="cpos-gate__sub">{t('pos.shift.noTerminalBody')}</p>
        </div>
      </div>
    );
  }

  // 'no-cashier' is the sign-in screen's business and it runs ahead of this one,
  // so reaching it here means the tree is mounted without that guard. Show the
  // float box rather than a dead end.
  const raw = typed.trim();
  // Never `parseFloat`. `parseAmount` reads `12,50`, `1,234.50` and `1.234,50`
  // the way the cashier's own numpad means them.
  const value = parseAmount(raw);
  const typedSeparator = /[.,]/.test(raw);

  // The ladder, first match wins, one note slot. A rule that blocks must be
  // reached before a rule that merely warns.
  let tone: 'danger' | 'warning' | null = null;
  let note: string | null = null;
  let blocked = false;

  if (!raw) {
    blocked = true;
  } else if (/[^0-9.,\s]/.test(raw)) {
    tone = 'danger';
    note = t('pos.shift.notANumber');
    blocked = true;
  } else if (value > MAX_OPENING_FLOAT) {
    tone = 'danger';
    note = t('pos.shift.tooLarge');
    blocked = true;
  } else if (value >= MINOR_UNIT_SUSPICION && !typedSeparator) {
    // Warned, not corrected, and with no "fix it for me" button: silently
    // dividing a real drawer count by 100 is worse than the slip it prevents.
    tone = 'warning';
    note = t('pos.shift.noDecimal', { suggestion: formatPrice(value / 100) });
  } else if (value === 0) {
    // Zero is valid -- a card-only counter opens empty -- but an empty field
    // and a typed zero have to be different gestures, or every cashier taps
    // through without counting.
    tone = 'warning';
    note = t('pos.shift.emptyDrawer');
  }

  return (
    <form className="cpos-gate" aria-labelledby={headingId} onSubmit={openShift}>
      <div className="cpos-gate__head">
        <span className="cpos-gate__mark">
          <CashDrawerIcon size={24} />
        </span>
        <h1 className="cpos-gate__h" id={headingId}>
          {t('pos.shift.openTitle')}
        </h1>
        <p className="cpos-gate__sub">{t('pos.shift.openBody')}</p>
        {terminal ? <p className="cpos-gate__sub">{terminal.name}</p> : null}
        {user ? <p className="cpos-gate__sub">{user.displayName || user.username}</p> : null}
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor={fieldId}>
          {t('pos.shift.float')}
        </label>
        <input
          className="cpos-input cpos-gate__amount"
          id={fieldId}
          value={typed}
          autoFocus
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={tone === 'danger' || undefined}
          aria-describedby={hintId}
          onChange={(e) => setTyped(e.target.value)}
        />
        {raw ? (
          // Visual only, and `aria-hidden` on purpose: re-reading a currency
          // string on every keystroke makes the field unusable with a screen
          // reader. Its job is to catch a decimal slip with the eye.
          <span
            className={cn('cpos-gate__echo', value === 0 && 'cpos-gate__echo--zero')}
            aria-hidden="true"
          >
            {formatPrice(value)}
          </span>
        ) : null}
        <p className="cpos-gate__sub" id={hintId}>
          {t('pos.shift.floatHint')}
        </p>
      </div>

      {/*
        In the DOM from first paint with only its child changing: a role="status"
        node that mounts at the same instant its text appears is unreliable in
        NVDA and JAWS. Colour is never the only signal -- every note is a
        full sentence.
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

      {error ? (
        <div className="cpos-note cpos-note--danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="cpos-gate__foot">
        <button
          type="submit"
          className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
          disabled={blocked || submitting}
          title={!raw ? t('pos.shift.needFloat') : undefined}
        >
          {submitting ? <span className="cpos-spinner" aria-hidden="true" /> : null}
          {submitting ? t('pos.shift.opening') : t('pos.shift.open')}
        </button>
        <p className="cpos-gate__sub">{t('pos.shift.elsewhere')}</p>
      </div>
    </form>
  );
}

/**
 * The handover: somebody else's shift is still open on this drawer.
 *
 * Deliberately offers no way to open a second one. Two open shifts on one
 * drawer means two expected figures for one pile of cash and neither of them is
 * answerable -- so the only way forward is through the outgoing cashier's
 * count, which is the whole point of having shifts at all.
 */
function HandoverPanel({
  headingId,
  cashierName,
  terminalName,
}: {
  headingId: string;
  cashierName: string;
  terminalName: string;
}) {
  const t = useT();
  const { push } = useCaspianNavigation();
  return (
    <div className="cpos-gate" aria-labelledby={headingId}>
      <div className="cpos-gate__head">
        <span className="cpos-gate__mark">
          <CashDrawerIcon size={24} />
        </span>
        <h1 className="cpos-gate__h" id={headingId}>
          {t('pos.shift.handoverTitle')}
        </h1>
        <p className="cpos-gate__sub">
          {t('pos.shift.handoverBody', { name: cashierName, terminal: terminalName })}
        </p>
      </div>
      <div className="cpos-gate__foot">
        <button
          type="button"
          className="cpos-btn cpos-btn--primary cpos-btn--lg cpos-btn--block"
          onClick={() => push('/pos/shift')}
        >
          {t('pos.shift.handoverGo')}
        </button>
        <p className="cpos-gate__sub">{t('pos.shift.handoverHint')}</p>
      </div>
    </div>
  );
}
