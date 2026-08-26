/**
 * The way back into a till whose password has been forgotten.
 *
 * A standalone register has no server to email and no vendor who can let anyone
 * in, and the machine's IndexedDB is the shop's only copy of its catalogue and
 * its trading history. Before this existed, a shop that lost its sole Support
 * password had exactly one option -- clear the site data and start over -- and
 * that option destroys the business's records. This module is the alternative.
 *
 * What the code does is deliberately narrow: it sets a new password on one named
 * account. It does not sign anybody in, it does not grant a session, and it
 * carries no capability of its own. After it is used the operator goes to the
 * ordinary sign-in screen and types the password they just chose. A string that
 * only ever *changes* a password is a string a shop can keep in a drawer.
 *
 * It is **not** single-use. Burning it would put the shop straight back in the
 * hole it just climbed out of, so a successful reset mints a replacement and
 * shows it once. The old one stops working at that moment.
 *
 * Nothing the vendor holds opens any till. The licence key was considered as a
 * recovery path and rejected: `key-format.ts` says it "carries no secret and
 * grants no access", and making it a master key to every register in the field
 * would put a single point of compromise behind all of them.
 */

import {
  hashLocalPassword,
  verifyStoredCredentials,
  MIN_LOCAL_PASSWORD_LENGTH,
  passwordIsWeak,
  setLocalPassword,
} from './local-auth';
import { getLocalUser, readLocalShopSettings, writeLocalShopSettings } from './local-db';
import { mintRecoveryCode, isRecoveryCodeShaped, normaliseRecoveryCode } from './recovery-code';
import {
  evaluateSignInThrottle,
  pruneSignInThrottle,
  recordSignInFailure,
  type SignInThrottleState,
  type SignInThrottleVerdict,
} from './sign-in-throttle';
import type { LocalShopSettings } from './types';

/**
 * A separate bucket from the sign-in ladder, not a reserved key inside it.
 *
 * Sharing the map would mean the recovery counter and a username counter could
 * collide, and a name is something an attacker chooses.
 */
const RECOVERY_THROTTLE_KEY = 'caspian:pos:localRecoveryThrottle';

/** The one bucket in that map. There is only ever one code on a till. */
const BUCKET = 'code';

/** Zero. See the note on `evaluateSignInThrottle`. */
const RECOVERY_FREE_ATTEMPTS = 0;

let throttleCache: SignInThrottleState | undefined;

function readRecoveryThrottle(): SignInThrottleState {
  if (throttleCache) return throttleCache;
  throttleCache = {};
  if (typeof window === 'undefined') return throttleCache;
  try {
    const raw = window.localStorage.getItem(RECOVERY_THROTTLE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const rec = value as Partial<{ failures: number; lastFailureAtMillis: number }>;
        if (typeof rec?.failures === 'number' && typeof rec?.lastFailureAtMillis === 'number') {
          throttleCache[key] = {
            failures: rec.failures,
            lastFailureAtMillis: rec.lastFailureAtMillis,
          };
        }
      }
    }
  } catch {
    // Blocked, or edited by hand. An empty ladder delays nobody who should not
    // be delayed, which is the safe reading here as it is at the front door.
  }
  return throttleCache;
}

function writeRecoveryThrottle(state: SignInThrottleState): void {
  throttleCache = state;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECOVERY_THROTTLE_KEY, JSON.stringify(state));
  } catch {
    // The mirror above still drives this tab.
  }
}

/** How long this device would currently make somebody wait before trying a code. */
export function peekRecoveryThrottle(): SignInThrottleVerdict {
  return evaluateSignInThrottle(readRecoveryThrottle()[BUCKET], Date.now(), RECOVERY_FREE_ATTEMPTS);
}

function bumpRecoveryThrottle(): void {
  const now = Date.now();
  const state = pruneSignInThrottle(readRecoveryThrottle(), now);
  state[BUCKET] = recordSignInFailure(state[BUCKET], now);
  writeRecoveryThrottle(state);
}

function clearRecoveryThrottle(): void {
  const state = pruneSignInThrottle(readRecoveryThrottle(), Date.now());
  delete state[BUCKET];
  writeRecoveryThrottle(state);
}

/** Whether this till has a recovery code at all. */
export function hasRecoveryCode(settings: LocalShopSettings): boolean {
  return !!settings.recoveryHash && !!settings.recoverySalt && settings.recoveryIterations > 0;
}

/**
 * The settings patch that stores a freshly minted code.
 *
 * Split from the write so `commission` can fold it into the settings write it
 * makes anyway, and so the App admin pane can reuse it verbatim.
 */
export async function recoveryPatchFor(
  code: string,
  userId: string,
): Promise<Partial<LocalShopSettings>> {
  const credentials = await hashLocalPassword(normaliseRecoveryCode(code));
  return {
    recoveryHash: credentials.hash,
    recoverySalt: credentials.salt,
    recoveryIterations: credentials.iterations,
    recoveryMintedAtMillis: Date.now(),
    recoveryForUserId: userId,
  };
}

/**
 * Mint a code for an account, store its hash, and hand back the plaintext once.
 *
 * The caller shows it and never stores it. It exists in memory for as long as
 * that screen is open and nowhere else on the machine.
 */
export async function mintAndStoreRecoveryCode(userId: string): Promise<string> {
  const code = mintRecoveryCode();
  await writeLocalShopSettings(await recoveryPatchFor(code, userId));
  return code;
}

export type RecoveryFailure =
  | 'no-code'
  | 'bad-code'
  | 'account-gone'
  | 'password-too-short'
  | 'password-too-weak';

export type RecoveryResult =
  | { ok: true; username: string; nextCode: string }
  | { ok: false; reason: RecoveryFailure }
  | { ok: false; reason: 'throttled'; waitMillis: number };

/**
 * Check a typed code and, if it is right, set a new password on its account.
 *
 * The order matters and mirrors `attemptLocalSignIn`. The throttle is consulted
 * before anything is looked up or derived, so a refusal proves nothing about
 * the state of the till. The shape check comes next, so an empty box or a
 * pasted paragraph costs neither a PBKDF2 derive nor a rung on the ladder. Only
 * then is the code verified, and only after that is the new password judged --
 * everything that could describe the account waits until the caller has proved
 * it holds the code.
 */
export async function redeemRecoveryCode(
  typed: string,
  newPassword: string,
): Promise<RecoveryResult> {
  const verdict = peekRecoveryThrottle();
  if (!verdict.allowed) return { ok: false, reason: 'throttled', waitMillis: verdict.waitMillis };

  const settings = await readLocalShopSettings();
  if (!hasRecoveryCode(settings)) return { ok: false, reason: 'no-code' };

  if (!isRecoveryCodeShaped(typed)) {
    bumpRecoveryThrottle();
    return { ok: false, reason: 'bad-code' };
  }

  const right = await verifyStoredCredentials(normaliseRecoveryCode(typed), {
    hash: settings.recoveryHash,
    salt: settings.recoverySalt,
    iterations: settings.recoveryIterations,
  });
  if (!right) {
    bumpRecoveryThrottle();
    return { ok: false, reason: 'bad-code' };
  }

  const user = await getLocalUser(settings.recoveryForUserId);
  if (!user) return { ok: false, reason: 'account-gone' };

  // Only now, with the code already proved right. Checking the password first
  // would answer questions for somebody who has no code at all: `passwordIsWeak`
  // compares against the account's username, so a stranger at the sign-in screen
  // could have read the Support name back out of it one guess at a time, and
  // without spending a rung on the ladder. Nothing is lost by waiting -- the code
  // stays typed in the box, so a refusal here costs the operator a better
  // password and not another trip to the drawer.
  if (newPassword.length < MIN_LOCAL_PASSWORD_LENGTH) {
    return { ok: false, reason: 'password-too-short' };
  }
  if (passwordIsWeak(newPassword, user.username)) {
    return { ok: false, reason: 'password-too-weak' };
  }

  await setLocalPassword(user.id, newPassword);
  clearRecoveryThrottle();

  // Re-mint rather than burn. A shop that has just used its way back in is
  // exactly the shop that must not be left without one.
  const nextCode = await mintAndStoreRecoveryCode(user.id);
  return { ok: true, username: user.username, nextCode };
}
