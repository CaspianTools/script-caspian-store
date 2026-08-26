'use client';

import { useCallback, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useT, useCaspianStandalone, useToast } from '@caspian-explorer/script-caspian-store';
import { StoreIcon } from '../../icons';
import { isTerminalCodeShaped } from './terminal-code';
import { usePosTerminal } from './terminal-context';

/**
 * Asks which counter this machine is, once, before it will sell.
 *
 * Only ever appears on a till whose shop has named at least one counter. A shop
 * that has named none never sees this and never learns the feature exists,
 * which is why there is no switch to leave off as well: an empty roster is the
 * off position.
 *
 * Wraps only the register, like `PosOpeningCashGate`. Every other screen stays
 * reachable behind it -- somebody who has come to the till to fix the catalogue,
 * or to look at yesterday's takings, should not be made to pair a counter
 * first, and whoever holds the slip of paper may not be the person standing
 * here.
 *
 * **The code is an anti-mistake device, not a security boundary.** Anybody at
 * this keyboard can already factory-reset the machine through the browser's own
 * settings. What it buys is that "this is counter three" is a deliberate act
 * rather than a default two machines silently agreed on. If IndexedDB is
 * unreachable the roster reads empty and the till sells -- the same failure
 * direction every other gate here takes, because a shop that cannot trade
 * because of a browser setting is the worse outcome.
 */
export function PosTerminalClaimGate({ children }: { children: ReactNode }): ReactNode {
  const t = useT();
  const { toast } = useToast();
  const standalone = useCaspianStandalone();
  const { loading, mustClaim, claim } = usePosTerminal();

  const fieldId = useId();
  const headingId = `${fieldId}-h`;
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      // Shape first, so an empty box or a pasted sentence costs no PBKDF2
      // derive per counter -- and so a recovery code typed in here is named as
      // the wrong kind of code rather than reported as a wrong pairing code.
      if (!isTerminalCodeShaped(typed)) {
        setError(t('pos.terminal.claim.malformed'));
        return;
      }
      setSubmitting(true);
      setError(null);
      const result = await claim(typed);
      setSubmitting(false);
      if (result.ok) {
        setTyped('');
        toast({ title: t('pos.terminal.claim.done', { name: result.terminal.name }) });
        return;
      }
      setError(
        result.reason === 'taken'
          ? t('pos.terminal.claim.taken')
          : result.reason === 'malformed'
            ? t('pos.terminal.claim.malformed')
            : t('pos.terminal.claim.noMatch'),
      );
    },
    [submitting, typed, claim, t, toast],
  );

  if (!standalone) return children;

  // Never render the register first and swap it out: `PosRegister` installs the
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

  if (!mustClaim) return children;

  return (
    // A form rather than a dialog, and with no focus trap, no scroll lock and
    // no Escape handler -- for the four reasons spelled out on
    // `PosOpeningCashPanel`. The sidebar behind this really is operable, and
    // announcing a trap that is not there is worse than announcing nothing.
    <form className="cpos-gate" aria-labelledby={headingId} onSubmit={submit}>
      <div className="cpos-gate__head">
        <span className="cpos-gate__mark">
          <StoreIcon size={24} />
        </span>
        <h1 className="cpos-gate__h" id={headingId}>
          {t('pos.terminal.claim.title')}
        </h1>
        <p className="cpos-gate__sub">{t('pos.terminal.claim.body')}</p>
      </div>

      <div className="cpos-field">
        <label className="cpos-field__label" htmlFor={fieldId}>
          {t('pos.terminal.claim.code')}
        </label>
        <input
          className="cpos-input"
          id={fieldId}
          value={typed}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('pos.terminal.claim.placeholder')}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setTyped(e.target.value);
            if (error) setError(null);
          }}
        />
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
          disabled={submitting || !typed.trim()}
        >
          {submitting ? <span className="cpos-spinner" aria-hidden="true" /> : null}
          {submitting ? t('pos.terminal.claim.pairing') : t('pos.terminal.claim.pair')}
        </button>
        <p className="cpos-gate__sub">{t('pos.terminal.claim.whereFrom')}</p>
      </div>
    </form>
  );
}
