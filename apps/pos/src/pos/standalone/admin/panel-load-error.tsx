'use client';

import { usePosT as useT } from '../../../i18n/use-pos-t';

/**
 * "This screen could not read the database", instead of a spinner that never
 * stops.
 *
 * Every back-office panel loaded its rows in an unguarded `void refresh()`, so
 * an IndexedDB that would not open -- blocked by another tab, blocked site
 * data, or a database written by a newer build -- left the screen in its
 * loading state forever. To the person at the counter that is indistinguishable
 * from the shop's records having been erased.
 */
export function PanelLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div>
      <div className="cpos-note cpos-note--warning" role="alert">
        {t('pos.admin.loadFailed')}
      </div>
      <div className="cpos-actions" style={{ marginTop: 12 }}>
        <button type="button" className="cpos-btn cpos-btn--outline" onClick={onRetry}>
          {t('pos.admin.loadRetry')}
        </button>
      </div>
    </div>
  );
}
