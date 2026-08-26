/**
 * How long a till makes somebody wait after a wrong password.
 *
 * A pure reducer: no storage, no clock, no React. Split out for the same reason
 * `priceLocalSale` and the opening-cash helpers are — `scripts/check-standalone.mjs`
 * can assert every rung of the ladder in Node, and the browser layer around it
 * stays a thin read-modify-write.
 *
 * Three things are deliberate and none of them should be "tightened" later
 * without reading this paragraph first.
 *
 * **It delays, it never locks.** There is no "account locked, contact support"
 * state anywhere in this design, and the ladder tops out. That is what makes it
 * safe to key on the username: somebody who wanted to be a nuisance could
 * otherwise hammer a cashier's name and lock them out of their own shift. A
 * ceiling of a minute costs an attacker everything and costs a real cashier one
 * minute, once.
 *
 * **The first three attempts are free.** The three commonest reasons a correct
 * password is refused at a counter are caps lock, a trailing space, and the
 * wrong keyboard layout. Charging for those stops a queue and buys nothing: an
 * attacker who is willing to wait is not deterred by the fourth guess being the
 * first slow one.
 *
 * **Per username, not per device.** Per-device means one cashier's typo delays
 * the next person at a queue of six. A second device-wide axis was considered
 * and dropped: its only extra coverage is spraying one password across usernames
 * an attacker cannot see, and it is precisely the axis that stops a queue.
 *
 * The honest arithmetic, because a security control that oversells itself is
 * worse than none: PBKDF2 at 600 000 iterations already costs a few hundred
 * milliseconds, so an unthrottled attacker with the machine in front of them
 * manages roughly three guesses a second. Once the ladder bites they manage
 * about 1440 a day. Against a six-character minimum that is a speed bump, not a
 * lock — which is why it ships alongside rehash-on-login and a weak-password
 * refusal rather than instead of them. The thing it actually defeats is somebody
 * standing at an unattended till trying the twenty passwords they can think of.
 */

export interface SignInThrottleRecord {
  /** Consecutive failures since the last success, or since the record was forgotten. */
  failures: number;
  lastFailureAtMillis: number;
}

/** Keyed by `normaliseUsername(typed)` — the typed name, not a resolved account. */
export type SignInThrottleState = Record<string, SignInThrottleRecord>;

export interface SignInThrottleVerdict {
  allowed: boolean;
  /** Milliseconds still to wait. Zero whenever `allowed` is true. */
  waitMillis: number;
  failures: number;
}

/** Failures that cost nothing. Caps lock, a trailing space, the wrong layout. */
export const SIGN_IN_FREE_ATTEMPTS = 3;

/** What the 4th, 5th, 6th and every later failure cost. The last entry is the ceiling. */
export const SIGN_IN_DELAY_LADDER_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000];

/** Quiet for this long and the count is forgotten entirely. */
export const SIGN_IN_THROTTLE_FORGET_MS = 15 * 60_000;

function delayFor(failures: number, freeAttempts: number): number {
  const rung = failures - freeAttempts;
  if (rung <= 0) return 0;
  return SIGN_IN_DELAY_LADDER_MS[Math.min(rung, SIGN_IN_DELAY_LADDER_MS.length) - 1] ?? 0;
}

/** Whether a record is stale enough to be treated as absent. */
function forgotten(record: SignInThrottleRecord, nowMillis: number): boolean {
  return nowMillis - record.lastFailureAtMillis >= SIGN_IN_THROTTLE_FORGET_MS;
}

/**
 * May this attempt proceed, and if not, for how much longer?
 *
 * Takes a record and a clock and nothing else. That is load-bearing: the caller
 * evaluates this on the *typed* username before it looks the account up, so a
 * throttle that fires proves nothing about whether the account exists. Doing it
 * the other way round would hand back the username oracle that the dummy derive
 * in `signInLocal` exists to close.
 *
 * `freeAttempts` defaults to the three the front door allows. The recovery code
 * passes zero: nobody mistypes twenty-five symbols off a piece of paper three
 * times by accident the way they leave caps lock on, and a code that opens the
 * only account on the till should cost from the first wrong guess.
 */
export function evaluateSignInThrottle(
  record: SignInThrottleRecord | undefined,
  nowMillis: number,
  freeAttempts: number = SIGN_IN_FREE_ATTEMPTS,
): SignInThrottleVerdict {
  if (!record || forgotten(record, nowMillis)) {
    return { allowed: true, waitMillis: 0, failures: 0 };
  }
  const elapsed = nowMillis - record.lastFailureAtMillis;
  const remaining = delayFor(record.failures, freeAttempts) - elapsed;
  return remaining > 0
    ? { allowed: false, waitMillis: remaining, failures: record.failures }
    : { allowed: true, waitMillis: 0, failures: record.failures };
}

/** The record to store after a refused attempt. */
export function recordSignInFailure(
  record: SignInThrottleRecord | undefined,
  nowMillis: number,
): SignInThrottleRecord {
  const carried = !record || forgotten(record, nowMillis) ? 0 : record.failures;
  return { failures: carried + 1, lastFailureAtMillis: nowMillis };
}

/**
 * Drop records nothing is waiting on.
 *
 * Called before every write so the stored map cannot grow without bound on a
 * till where people mistype their names all day.
 */
export function pruneSignInThrottle(
  state: SignInThrottleState,
  nowMillis: number,
): SignInThrottleState {
  const out: SignInThrottleState = {};
  for (const [key, record] of Object.entries(state)) {
    if (!forgotten(record, nowMillis)) out[key] = record;
  }
  return out;
}

/** Whole seconds still to wait, rounded up, for a message a cashier reads. */
export function throttleWaitSeconds(waitMillis: number): number {
  return Math.max(1, Math.ceil(waitMillis / 1000));
}
