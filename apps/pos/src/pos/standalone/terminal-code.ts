/**
 * The code that says which counter a till is.
 *
 * Pure, in the same family as `price-local-sale.ts`, `opening-cash.ts` and
 * `recovery-code.ts`, so `scripts/check-standalone.mjs` can assert every rule
 * below in Node without a browser. Nothing here touches storage; hashing and
 * verifying live in `local-db.ts` beside the roster they belong to.
 *
 * Same alphabet and the same handwriting forgiveness as the recovery code, and
 * for the same reason: this string is written on paper, handed to whoever sets
 * up counter three, and typed on a tablet. Both are imported rather than
 * restated so a fix to either reaches both.
 *
 * Two differences from the recovery code, both deliberate.
 *
 * **Shorter.** Ten symbols, fifty bits, two groups of five. The recovery code
 * is twenty-five because it is the last way into a machine holding a shop's
 * only records, and it is typed roughly once in a till's life. A pairing code
 * is typed once per counter during a setup somebody is standing over, and it
 * guards nothing that is not already open to the person standing there --
 * anybody at that keyboard can factory-reset the till through the browser's own
 * settings, backup or no backup. It is an anti-mistake device, not a security
 * boundary, and it must never be hardened into one; the same posture the
 * opening-cash gate states about itself.
 *
 * **A different prefix.** `CSPT1` against `CSPR1`, so the two are told apart on
 * sight, on paper, and by the shape check below rather than by one silently
 * failing to verify in the other's box.
 */

import { RECOVERY_CODE_ALPHABET, foldCodeSymbols } from './recovery-code';

/**
 * Marks the string as a pairing code, and carries a version.
 *
 * `T` for terminal, `1` so a till that one day mints them differently can tell
 * the two apart on sight.
 */
export const TERMINAL_CODE_PREFIX = 'CSPT1';

/** Two groups of five. */
export const TERMINAL_CODE_SYMBOLS = 10;

const GROUP = 5;

/** Group the payload and put the prefix on the front, ready to be read aloud. */
export function formatTerminalCode(payload: string): string {
  const groups: string[] = [];
  for (let at = 0; at < payload.length; at += GROUP) {
    groups.push(payload.slice(at, at + GROUP));
  }
  return [TERMINAL_CODE_PREFIX, ...groups].join('-');
}

/**
 * Fold everything a person might reasonably type back to the payload.
 *
 * A recovery code typed into this box comes back thirty symbols long with the
 * wrong prefix still attached, so `isTerminalCodeShaped` refuses it before any
 * hashing happens rather than reporting it as a wrong pairing code.
 */
export function normaliseTerminalCode(typed: string): string {
  const folded = foldCodeSymbols(typed);
  return folded.startsWith(TERMINAL_CODE_PREFIX)
    ? folded.slice(TERMINAL_CODE_PREFIX.length)
    : folded;
}

/**
 * Whether this could be a pairing code at all.
 *
 * Only shape -- length and alphabet. It is what stops an empty box or a pasted
 * sentence costing a PBKDF2 derive; whether the code matches a counter is
 * `claimLocalTerminal`'s question.
 */
export function isTerminalCodeShaped(typed: string): boolean {
  const payload = normaliseTerminalCode(typed);
  if (payload.length !== TERMINAL_CODE_SYMBOLS) return false;
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
export function mintTerminalCode(): string {
  const bytes = new Uint8Array(TERMINAL_CODE_SYMBOLS);
  crypto.getRandomValues(bytes);
  let payload = '';
  for (const byte of bytes) payload += RECOVERY_CODE_ALPHABET[byte & 31];
  return formatTerminalCode(payload);
}
