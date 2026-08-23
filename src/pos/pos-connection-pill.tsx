'use client';

import { useT } from '../i18n/locale-context';
import { LEASE_LOW_AT, type PosSaleQueue } from './offline/pos-sale-queue';
import { usePosQueue } from './offline/use-pos-queue';

/**
 * The one thing in the register's chrome that tells a cashier where they stand.
 *
 * Silent when everything is normal — an always-on "Online" badge is noise that
 * gets ignored, which is exactly the wrong outcome for the badge that also has
 * to say "3 sales held". It appears only when there is something to say.
 *
 * The low-numbers warning fires while the till is still ONLINE and can top up.
 * Discovering you have run out of leased receipt numbers is a thing to learn
 * with everything working, not mid-outage in front of a customer.
 */
export function PosConnectionPill({ queue }: { queue: PosSaleQueue | null }) {
  const t = useT();
  const { counts, leasedRemaining, online, paused, pauseReasonKey } = usePosQueue(queue);

  const held = counts.held + counts.sending;
  const blocked = counts.blocked;
  const lowNumbers = online && !paused && queue !== null && leasedRemaining <= LEASE_LOW_AT;

  if (online && !held && !blocked && !paused && !lowNumbers) return null;

  const tone = paused || blocked ? danger : !online || held ? warning : neutral;
  const label = (() => {
    if (paused) return t(pauseReasonKey ?? 'pos.queue.paused');
    if (blocked) return t('pos.queue.blockedCount', { count: blocked });
    if (!online && held) return t('pos.queue.offlineHolding', { count: held });
    if (!online) return t('pos.queue.offline');
    if (held) return t('pos.queue.sending', { count: held });
    return t('pos.queue.lowNumbers', { count: leasedRemaining });
  })();

  return (
    <span role="status" style={{ ...pill, ...tone }}>
      {label}
    </span>
  );
}

const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const warning: React.CSSProperties = { background: '#fffbeb', color: '#8a5a00', border: '1px solid #f2dda4' };
const danger: React.CSSProperties = { background: '#fef3f2', color: '#b42318', border: '1px solid #fda29b' };
const neutral: React.CSSProperties = { background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' };
