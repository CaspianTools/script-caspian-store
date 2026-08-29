'use client';

import { cn } from '@caspian-explorer/script-caspian-store';
import { usePosT as useT } from '../i18n/use-pos-t';
import { WifiOffIcon } from '../icons';
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
 *
 * It is deliberately NOT driven by `leasedRemaining === 0` alone. That is also
 * what a perfectly healthy till looks like in the seconds before its first
 * lease resolves, and what a store with no `functions-pos` deployment looks
 * like forever — a warning it can never clear, about a cause it does not name.
 * `leaseUnavailable` separates the two, so "running low" means a real block
 * that is running out and "cannot reserve" means somebody has to deploy.
 */
export function PosConnectionPill({ queue }: { queue: PosSaleQueue | null }) {
  const t = useT();
  const { counts, leasedRemaining, leaseUnavailable, online, paused, pauseReasonKey } =
    usePosQueue(queue);

  const held = counts.held + counts.sending;
  const blocked = counts.blocked;
  const attached = online && !paused && queue !== null;
  const noNumbers = attached && leaseUnavailable;
  const lowNumbers =
    attached && !leaseUnavailable && leasedRemaining > 0 && leasedRemaining <= LEASE_LOW_AT;

  if (online && !held && !blocked && !paused && !lowNumbers && !noNumbers) return null;

  const tone = paused || blocked ? 'cpos-badge--danger' : !online || held || noNumbers ? 'cpos-badge--warning' : '';
  const label = (() => {
    if (paused) return t(pauseReasonKey ?? 'pos.queue.paused');
    if (blocked) return t('pos.queue.blockedCount', { count: blocked });
    if (!online && held) return t('pos.queue.offlineHolding', { count: held });
    if (!online) return t('pos.queue.offline');
    if (held) return t('pos.queue.sending', { count: held });
    if (noNumbers) return t('pos.queue.noNumbers');
    return t('pos.queue.lowNumbers', { count: leasedRemaining });
  })();

  return (
    <span role="status" className={cn('cpos-badge', tone)}>
      {online ? <span className="cpos-dot cpos-dot--live" aria-hidden="true" /> : <WifiOffIcon size={13} />}
      {label}
    </span>
  );
}
