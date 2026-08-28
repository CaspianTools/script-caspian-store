'use client';

import { useState } from 'react';
import { useT } from '@caspian-explorer/script-caspian-store';
import { PosStyleScope } from '../../theme/pos-styles';
import type { PosErrorBoundaryState } from './pos-error-boundary';

/**
 * What a cashier sees instead of a white screen.
 *
 * Two of them, for the two boundaries. Both offer the same two ways out and
 * both show the message, because a shop phoning for help needs something to
 * read down the line.
 *
 * Neither writes anything. The open sale is already on disk -- the open-sale
 * provider write-throughs to IndexedDB on a debounce and reconciles against a
 * committed sale on remount -- so a second recovery path here would be a second
 * thing to get wrong about the most delicate state in the product.
 */

function CrashDetail({ error }: { error: Error }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const text = `${error.name}: ${error.message}`;
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="cpos-btn cpos-btn--ghost cpos-btn--sm"
        aria-expanded={shown}
        onClick={() => setShown((on) => !on)}
      >
        {t('pos.crash.details')}
      </button>
      {shown ? (
        <p
          className="cpos-muted"
          style={{
            marginTop: 8,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            wordBreak: 'break-word',
          }}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The outermost boundary's screen.
 *
 * Renders its own `PosStyleScope`: the sheet is injected by `PosShell` and
 * `PosGuard`, both of which are BELOW this boundary, so a crash up here would
 * otherwise paint unstyled. `PosGuard` already uses the same trick for the same
 * reason.
 */
export function PosCrashScreen({ error, reset }: PosErrorBoundaryState) {
  const t = useT();
  return (
    <PosStyleScope>
      <div className="cpos-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="cpos-card cpos-card--pad" style={{ maxWidth: 520 }}>
          <h1 className="cpos-cardhead__title">{t('pos.crash.title')}</h1>
          <p className="cpos-muted" style={{ margin: 0 }}>
            {t('pos.crash.body')}
          </p>
          <div className="cpos-actions" style={{ marginTop: 16 }}>
            <button type="button" className="cpos-btn cpos-btn--outline" onClick={reset}>
              {t('pos.crash.retry')}
            </button>
            <button
              type="button"
              className="cpos-btn cpos-btn--primary"
              onClick={() => location.reload()}
            >
              {t('pos.crash.reload')}
            </button>
          </div>
          <CrashDetail error={error} />
        </div>
      </div>
    </PosStyleScope>
  );
}

/**
 * The per-screen boundary's page.
 *
 * The shell around it is still alive -- sidebar, top bar, banners, Quick add --
 * so this is a page, not a takeover, and the cashier can simply walk back to
 * the register and keep selling.
 */
export function PosScreenCrash({
  error,
  reset,
  onHome,
}: PosErrorBoundaryState & { onHome: () => void }) {
  const t = useT();
  return (
    <div className="cpos-page">
      <div className="cpos-note cpos-note--danger" role="alert">
        {t('pos.crash.screenTitle')}
      </div>
      <p className="cpos-muted">{t('pos.crash.body')}</p>
      <div className="cpos-actions" style={{ marginTop: 12 }}>
        <button type="button" className="cpos-btn cpos-btn--outline" onClick={reset}>
          {t('pos.crash.retry')}
        </button>
        <button type="button" className="cpos-btn cpos-btn--primary" onClick={onHome}>
          {t('pos.crash.backToRegister')}
        </button>
      </div>
      <CrashDetail error={error} />
    </div>
  );
}
