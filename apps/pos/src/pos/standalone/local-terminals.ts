/**
 * The shop's counters, and which one this machine answers to.
 *
 * A sibling of `local-db.ts` rather than a section inside it, for the reason
 * `local-recovery.ts` is one: claiming a counter needs the PBKDF2 helpers in
 * `local-auth.ts`, and `local-auth.ts` already imports `local-db.ts`. Putting
 * this here keeps the arrows pointing one way.
 *
 * **The roster does not sync, and cannot.** A standalone till has no server and
 * no wire to its siblings, so this is shop data each machine holds its own copy
 * of, travelling the only way anything travels between standalone tills: the
 * backup file. `claimedByDeviceId` therefore means "the device answering to
 * this counter as far as THIS machine knows" -- till B does not learn that till
 * A took Front counter, and a claim released here does not free it there. That
 * is a limit of a register with no server rather than a gap to be closed later,
 * and the manual says so in as many words.
 *
 * The pairing code is an anti-mistake device, not a security boundary. Anybody
 * standing at the keyboard can already factory-reset the machine through the
 * browser's own settings. What the code buys is that "this is counter three" is
 * a deliberate act somebody performed rather than a default two machines
 * silently agreed on -- and that an owner can hand a slip of paper to whoever
 * is setting the third till up without handing over anything else.
 */

import {
  STORE_LOCAL_SHIFTS,
  STORE_LOCAL_TERMINALS,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  posTx,
} from '../offline/pos-queue-db';
import { hashLocalPassword, verifyStoredCredentials } from './local-auth';
import { localStoreAvailable, newLocalId } from './local-db';
import { isTerminalCodeShaped, mintTerminalCode, normaliseTerminalCode } from './terminal-code';
import type { LocalShift, LocalTerminal } from './types';

/** Every counter the shop has named, oldest first so the list does not reshuffle. */
export async function listLocalTerminals(): Promise<LocalTerminal[]> {
  if (!localStoreAvailable()) return [];
  const rows = await posTx(STORE_LOCAL_TERMINALS, 'readonly', (tx) =>
    idbGetAll<LocalTerminal>(tx, STORE_LOCAL_TERMINALS),
  );
  return rows.sort((a, b) => a.createdAtMillis - b.createdAtMillis);
}

export async function getLocalTerminal(id: string): Promise<LocalTerminal | null> {
  if (!localStoreAvailable()) return null;
  const row = await posTx(STORE_LOCAL_TERMINALS, 'readonly', (tx) =>
    idbGet<LocalTerminal>(tx, STORE_LOCAL_TERMINALS, id),
  );
  return row ?? null;
}

/** The counter this device answers to, or null when it has claimed none. */
export async function claimedLocalTerminal(deviceId: string): Promise<LocalTerminal | null> {
  const rows = await listLocalTerminals();
  return rows.find((row) => row.claimedByDeviceId === deviceId) ?? null;
}

/**
 * Name a counter, and mint the code that pairs a machine to it.
 *
 * The plain code comes back exactly once and is never stored -- only its
 * scrambled form is, the same way a password is. An owner who loses the slip
 * asks for a new one with `regenerateLocalTerminalCode`; nobody, including
 * whoever installed the till, can read the old one back off the machine.
 */
export async function createLocalTerminal(
  name: string,
): Promise<{ terminal: LocalTerminal; code: string }> {
  const code = mintTerminalCode();
  const credentials = await hashLocalPassword(normaliseTerminalCode(code));
  const terminal: LocalTerminal = {
    id: newLocalId(),
    name: name.trim(),
    codeHash: credentials.hash,
    codeSalt: credentials.salt,
    codeIterations: credentials.iterations,
    claimedByDeviceId: '',
    createdAtMillis: Date.now(),
  };
  await posTx(STORE_LOCAL_TERMINALS, 'readwrite', (tx) =>
    idbPut(tx, STORE_LOCAL_TERMINALS, terminal),
  );
  return { terminal, code };
}

/**
 * Rename a counter.
 *
 * Sales already rung keep the name they were stamped with. That is the point of
 * freezing it: an owner correcting a typo must not rewrite what last month's
 * receipts say they were rung on.
 */
export async function renameLocalTerminal(id: string, name: string): Promise<void> {
  await posTx(STORE_LOCAL_TERMINALS, 'readwrite', async (tx) => {
    const row = await idbGet<LocalTerminal>(tx, STORE_LOCAL_TERMINALS, id);
    if (!row) return;
    await idbPut(tx, STORE_LOCAL_TERMINALS, { ...row, name: name.trim() });
  });
}

/** A fresh code for a counter whose slip of paper has gone. The old one stops working now. */
export async function regenerateLocalTerminalCode(id: string): Promise<string | null> {
  const code = mintTerminalCode();
  const credentials = await hashLocalPassword(normaliseTerminalCode(code));
  const wrote = await posTx(STORE_LOCAL_TERMINALS, 'readwrite', async (tx) => {
    const row = await idbGet<LocalTerminal>(tx, STORE_LOCAL_TERMINALS, id);
    if (!row) return false;
    await idbPut(tx, STORE_LOCAL_TERMINALS, {
      ...row,
      codeHash: credentials.hash,
      codeSalt: credentials.salt,
      codeIterations: credentials.iterations,
    });
    return true;
  });
  return wrote ? code : null;
}

export type ClaimTerminalResult =
  | { ok: true; terminal: LocalTerminal }
  | { ok: false; reason: 'malformed' | 'no-match' | 'taken' };

/**
 * Bind this device to the counter whose code was typed.
 *
 * The shape check runs first so an empty box or a pasted sentence costs no
 * PBKDF2 derive, and a recovery code typed in here is refused as malformed
 * rather than reported as a wrong pairing code.
 *
 * Every counter is tried, because the code IS the identifier -- there is
 * nothing else to look one up by. That is a derive per counter in the worst
 * case, paid once when a machine is set up, on a list the size of a shop.
 *
 * A code matching a counter already claimed by a DIFFERENT device on this
 * machine is refused rather than moved. Two tills answering to one counter is
 * exactly what the code exists to prevent, and silently reassigning would make
 * the roster agree with itself while the shop floor disagreed. Re-typing the
 * code on the machine that already holds it succeeds, so a cashier who reaches
 * this screen after a reload is not stuck.
 */
export async function claimLocalTerminal(
  typedCode: string,
  deviceId: string,
): Promise<ClaimTerminalResult> {
  if (!isTerminalCodeShaped(typedCode)) return { ok: false, reason: 'malformed' };
  const payload = normaliseTerminalCode(typedCode);

  for (const terminal of await listLocalTerminals()) {
    const matches = await verifyStoredCredentials(payload, {
      hash: terminal.codeHash,
      salt: terminal.codeSalt,
      iterations: terminal.codeIterations,
    });
    if (!matches) continue;
    if (terminal.claimedByDeviceId && terminal.claimedByDeviceId !== deviceId) {
      return { ok: false, reason: 'taken' };
    }
    const claimed: LocalTerminal = {
      ...terminal,
      claimedByDeviceId: deviceId,
      claimedAtMillis: Date.now(),
    };
    await posTx(STORE_LOCAL_TERMINALS, 'readwrite', (tx) =>
      idbPut(tx, STORE_LOCAL_TERMINALS, claimed),
    );
    return { ok: true, terminal: claimed };
  }

  return { ok: false, reason: 'no-match' };
}

/**
 * Let go of a counter, so another machine can take it.
 *
 * Only ever frees it in this machine's copy of the roster -- see the note at the
 * top of this file.
 */
export async function releaseLocalTerminal(id: string): Promise<void> {
  await posTx(STORE_LOCAL_TERMINALS, 'readwrite', async (tx) => {
    const row = await idbGet<LocalTerminal>(tx, STORE_LOCAL_TERMINALS, id);
    if (!row) return;
    const { claimedAtMillis: _dropped, ...rest } = row;
    await idbPut(tx, STORE_LOCAL_TERMINALS, { ...rest, claimedByDeviceId: '' });
  });
}

export type DeleteTerminalResult = { ok: true } | { ok: false; reason: 'shift-open' };

/**
 * Remove a counter from the roster.
 *
 * Refused while a shift is open on it: closing that shift is how the drawer
 * gets counted, and deleting the counter underneath it would leave a cashier
 * holding money against a record with nowhere to land.
 *
 * Sales already rung are left alone and keep the frozen `terminalName` they
 * were stamped with, so last month's takings still read "Front counter" after
 * the counter itself is gone. Deleting is therefore safe for history in a way
 * that renaming an id would not be.
 */
export async function deleteLocalTerminal(id: string): Promise<DeleteTerminalResult> {
  const shifts = await posTx(STORE_LOCAL_SHIFTS, 'readonly', (tx) =>
    idbGetAll<LocalShift>(tx, STORE_LOCAL_SHIFTS),
  );
  if (shifts.some((shift) => shift.terminalId === id && shift.status === 'open')) {
    return { ok: false, reason: 'shift-open' };
  }
  await posTx(STORE_LOCAL_TERMINALS, 'readwrite', (tx) =>
    idbDelete(tx, STORE_LOCAL_TERMINALS, id),
  );
  return { ok: true };
}
