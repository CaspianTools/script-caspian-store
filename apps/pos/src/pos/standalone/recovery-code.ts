/**
 * The code a shop writes down when it sets a till up.
 *
 * Pure, in the same family as `price-local-sale.ts` and `sign-in-throttle.ts`,
 * so `scripts/check-standalone.mjs` can assert every rule below in Node without
 * a browser. Nothing here touches storage; hashing and verifying live in
 * `local-recovery.ts`.
 *
 * The alphabet is Crockford base32 -- the digits and the capitals with `I`, `L`,
 * `O` and `U` taken out. Two reasons, both about the counter rather than about
 * cryptography. This string gets written on a scrap of paper, filed in a drawer
 * for a year, then read down a phone to somebody typing it on a tablet, and
 * every character it drops is a character somebody could confuse with another:
 * `I` and `L` with `1`, `O` with `0`. `U` goes because dropping it is what keeps
 * an accidental obscenity out of a code a shopkeeper has to read aloud.
 * `normaliseRecoveryCode` then accepts the confusions anyway and folds them
 * back, so a shop that writes `O` where the paper said `0` is not locked out by
 * its own handwriting.
 *
 * Twenty-five symbols is 125 bits. That is not the 128 a round number would
 * suggest and it is not worth stretching the grouping to reach: what matters is
 * that it is far past guessable and that it breaks into five blocks of five,
 * which is the shape people copy accurately.
 */

/** Crockford base32: no `I`, `L`, `O` or `U`. */
export const RECOVERY_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Marks the string as one of ours, and carries a version.
 *
 * A `1` at the end so a till that one day mints codes differently can tell the
 * two apart on sight rather than by failing to verify one.
 */
export const RECOVERY_CODE_PREFIX = 'CSPR1';

/** Five groups of five. */
export const RECOVERY_CODE_SYMBOLS = 25;

const GROUP = 5;

/** Group the payload and put the prefix on the front, ready to be read aloud. */
export function formatRecoveryCode(payload: string): string {
  const groups: string[] = [];
  for (let at = 0; at < payload.length; at += GROUP) {
    groups.push(payload.slice(at, at + GROUP));
  }
  return [RECOVERY_CODE_PREFIX, ...groups].join('-');
}

/**
 * Fold everything a person might reasonably type back to the payload.
 *
 * Uppercases, maps the three confusable letters onto the digits they look like,
 * drops anything that is not a symbol -- spaces, dashes, the newline a paste
 * brings with it -- and takes the prefix off if it is there. A code typed
 * without the prefix, in lower case, with no dashes, comes back identical to one
 * copied exactly.
 */
export function normaliseRecoveryCode(typed: string): string {
  const folded = foldCodeSymbols(typed);
  const withoutPrefix = folded.startsWith(RECOVERY_CODE_PREFIX)
    ? folded.slice(RECOVERY_CODE_PREFIX.length)
    : folded;
  return withoutPrefix;
}

/**
 * The folding half of the rule above, without the prefix.
 *
 * Shared with `terminal-code.ts`, which is the till's other written-down code
 * and wants the identical handwriting forgiveness against a different prefix.
 * Factored out rather than copied so the two can never drift: a fix to what a
 * shop might reasonably type has to reach both, and one alphabet with two
 * readers is what makes that automatic.
 */
export function foldCodeSymbols(typed: string): string {
  return typed
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '');
}

/**
 * Whether this could be a code at all.
 *
 * Only shape -- length and alphabet. It is what stops an empty box or a pasted
 * sentence costing a PBKDF2 derive and a rung on the delay ladder; whether the
 * code is *right* is `verifyRecoveryCode`'s question.
 */
export function isRecoveryCodeShaped(typed: string): boolean {
  const payload = normaliseRecoveryCode(typed);
  if (payload.length !== RECOVERY_CODE_SYMBOLS) return false;
  for (const symbol of payload) {
    if (!RECOVERY_CODE_ALPHABET.includes(symbol)) return false;
  }
  return true;
}

/**
 * A fresh code, formatted and ready to show once.
 *
 * `256` is a whole number of `32`s, so masking a random byte to its low five
 * bits is uniform over the alphabet with nothing to reject and no modulo bias.
 */
export function mintRecoveryCode(): string {
  const bytes = new Uint8Array(RECOVERY_CODE_SYMBOLS);
  crypto.getRandomValues(bytes);
  let payload = '';
  for (const byte of bytes) payload += RECOVERY_CODE_ALPHABET[byte & 31];
  return formatRecoveryCode(payload);
}
