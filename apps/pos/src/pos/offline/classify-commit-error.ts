/**
 * What to do about a failed `commitPosSale`.
 *
 * The register has never read `FunctionsError.code` — `pos-register.tsx`
 * surfaces `error.message`, which for any infrastructure failure is the literal
 * string `INTERNAL`. That is survivable when a cashier is watching and can just
 * press the button again. It is not survivable for a queue draining unattended:
 * without a taxonomy it would either give up on a recoverable sale or retry a
 * permanently rejected one until the end of time.
 */

export type CommitDisposition =
  /** Retry later with backoff. The sale is fine; the world is temporarily not. */
  | 'transient'
  /** Refresh the token and retry immediately. Does not consume an attempt. */
  | 'reauth'
  /** Stop draining entirely and tell somebody. The account lost the right to sell. */
  | 'denied'
  /** This sale will never be accepted as-is. A person has to look at it. */
  | 'permanent';

export interface CommitClassification {
  disposition: CommitDisposition;
  code: string;
  /** i18n key describing the cause to a cashier. */
  messageKey: string;
}

/** 2s, doubling, capped at 5 minutes. */
export function backoffMillis(attempts: number): number {
  return Math.min(2000 * 2 ** Math.max(0, attempts - 1), 5 * 60 * 1000);
}

/**
 * `internal` is bounded rather than retried forever because firebase-functions
 * collapses two very different things into it: a transient Firestore contention
 * abort, and a permanent crash in our own code. Retrying is right for the first
 * and pointless for the second, and the code cannot tell them apart — so try a
 * few times, then hand it to a human instead of looping until the shop closes.
 */
export const MAX_INTERNAL_ATTEMPTS = 8;

function codeOf(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const raw = String((error as { code: unknown }).code);
    // Callable errors arrive as `functions/unavailable`.
    return raw.includes('/') ? raw.slice(raw.indexOf('/') + 1) : raw;
  }
  return '';
}

export function classifyCommitError(error: unknown, attempts: number): CommitClassification {
  const code = codeOf(error);

  switch (code) {
    case 'unavailable':
    case 'deadline-exceeded':
    case 'aborted':
    case 'resource-exhausted':
    case 'cancelled':
      return { disposition: 'transient', code, messageKey: 'pos.queue.reason.network' };

    case 'unauthenticated':
      return { disposition: 'reauth', code, messageKey: 'pos.queue.reason.signedOut' };

    case 'permission-denied':
      // `assertStaff` re-reads users/{uid} on every call, so a role revoked
      // mid-outage rejects the whole backlog, not just one sale. Pausing is the
      // only sane response — hammering it would not help and would look like a
      // network problem to the cashier.
      return { disposition: 'denied', code, messageKey: 'pos.queue.reason.notAllowed' };

    case 'not-found':
      // A product was deleted from the catalogue while the sale was held.
      return { disposition: 'permanent', code, messageKey: 'pos.queue.reason.productGone' };

    case 'invalid-argument':
    case 'failed-precondition':
      return { disposition: 'permanent', code, messageKey: 'pos.queue.reason.rejected' };

    case 'internal':
    case 'unknown':
      return attempts >= MAX_INTERNAL_ATTEMPTS
        ? { disposition: 'permanent', code, messageKey: 'pos.queue.reason.repeatedFailure' }
        : { disposition: 'transient', code, messageKey: 'pos.queue.reason.network' };

    default:
      break;
  }

  // A fetch that never reached a server rejects as a plain TypeError with no
  // code at all — the single most common failure in the case this whole feature
  // exists for, and the one a `default: permanent` would get catastrophically
  // wrong by discarding a real sale during an ordinary wifi drop.
  if (error instanceof TypeError || code === '') {
    return { disposition: 'transient', code: code || 'network', messageKey: 'pos.queue.reason.network' };
  }

  return attempts >= MAX_INTERNAL_ATTEMPTS
    ? { disposition: 'permanent', code, messageKey: 'pos.queue.reason.repeatedFailure' }
    : { disposition: 'transient', code, messageKey: 'pos.queue.reason.network' };
}
