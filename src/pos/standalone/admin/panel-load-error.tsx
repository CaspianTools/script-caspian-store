'use client';

import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { actions, warning } from './panel-styles';

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
      <div style={warning}>{t('pos.admin.loadFailed')}</div>
      <div style={actions}>
        <Button variant="outline" onClick={onRetry}>
          {t('pos.admin.loadRetry')}
        </Button>
      </div>
    </div>
  );
}
