'use client';

/**
 * Sign-in for a standalone till.
 *
 * There is no Firebase Auth here and no server to ask, so the password check
 * happens on the machine holding the accounts. That makes the stored form the
 * whole of the defence: passwords are PBKDF2-SHA-256 with a per-user random
 * salt, never the password and never a bare digest of it. A shop laptop that
 * walks out of the building should not hand over a staff password that the
 * owner also uses somewhere else.
 *
 * `iterations` is stored per user rather than fixed in code, so the cost can be
 * raised for new accounts later without locking out existing ones.
 */

import {
  getLocalUserByUsername,
  getLocalUser,
  listLocalUsers,
  newLocalId,
  readLocalRoles,
  saveLocalUser,
} from './local-db';
import type { LocalUser, PosLocalRole } from './types';
import {
  evaluateSignInThrottle,
  pruneSignInThrottle,
  recordSignInFailure,
  type SignInThrottleRecord,
  type SignInThrottleState,
  type SignInThrottleVerdict,
} from './sign-in-throttle';

const SESSION_KEY = 'caspian:pos:localSession';
const SIGN_IN_KEY = 'caspian:pos:localSignIn';
const THROTTLE_KEY = 'caspian:pos:localSignInThrottle';

/**
 * OWASP's current floor for PBKDF2-HMAC-SHA256. Costs a few hundred
 * milliseconds on the kind of machine a shop actually buys, which is paid once
 * at sign-in and never on the hot path of a sale.
 */
const PBKDF2_ITERATIONS = 600_000;
const KEY_BITS = 256;

function subtle(): SubtleCrypto {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (!c?.subtle) {
    // Reached only on an insecure origin. Any https site is a secure context,
    // and so is an installed PWA, so this is a misconfiguration rather than a
    // runtime condition a shop can hit at the counter.
    throw new Error('Secure crypto is unavailable. The register must be served over https.');
  }
  return c.subtle;
}

/**
 * Whether this origin can hash a password at all.
 *
 * Separate from `subtle()` throwing, because the two failures need different
 * words. A till served over plain http has a configuration problem that nobody
 * standing at the counter can fix, and telling that operator to check their
 * site-data settings -- which is what the storage-blocked message says -- sends
 * them looking in the wrong place entirely.
 */
export function localCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    KEY_BITS,
  );
  return toBase64(new Uint8Array(bits));
}

/** Length-independent, value-independent comparison. A timing side channel here would leak the hash. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface LocalCredentials {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashLocalPassword(password: string): Promise<LocalCredentials> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return { hash, salt: toBase64(salt), iterations: PBKDF2_ITERATIONS };
}

/**
 * Check a secret against a stored hash, salt and iteration count.
 *
 * The general form. `verifyLocalPassword` is this with a `LocalUser`'s three
 * fields pulled out; the recovery code stores the same three on the shop record
 * and verifies through here, so there is one derive-and-compare in the till
 * rather than two that could drift on the day the cost is raised.
 */
export async function verifyStoredCredentials(
  secret: string,
  stored: LocalCredentials,
): Promise<boolean> {
  const candidate = await derive(secret, fromBase64(stored.salt), stored.iterations);
  return constantTimeEqual(candidate, stored.hash);
}

export async function verifyLocalPassword(password: string, user: LocalUser): Promise<boolean> {
  return verifyStoredCredentials(password, {
    hash: user.passwordHash,
    salt: user.passwordSalt,
    iterations: user.passwordIterations,
  });
}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

export type CreateLocalUserResult =
  | { ok: true; user: LocalUser }
  | { ok: false; reason: 'username-taken' | 'username-empty' | 'password-too-short' | 'invalid-role' };

/** Short, but a till is a physical device behind a counter, not an internet-facing login. */
export const MIN_LOCAL_PASSWORD_LENGTH = 6;

/**
 * Passwords a till refuses, and the one rule worth more than all of them.
 *
 * The list is short on purpose. A long blocklist is a way of looking thorough
 * while stopping nothing: an attacker with the machine in front of them is
 * working through what they know about *this shop*, not down a leaked-password
 * chart, and the entries below are the ones a real counter actually produces.
 * `parol` and `sifre` are here because this till ships in Azerbaijani, Russian
 * and Turkish and "password" is not the only word for it.
 *
 * The rule that earns its place is the last line: a password equal to the
 * username. It costs nothing, it cannot be argued with, and it closes the case
 * where an owner sets up three cashiers in a hurry and gives them all their own
 * name.
 *
 * Deliberately advisory to the data layer rather than enforced inside it.
 * `createLocalUser` and `setLocalPassword` are public exports whose results are
 * part of the library's contract; widening `CreateLocalUserResult` with a new
 * reason would drop a consumer's exhaustive switch through, and an upgrade must
 * never require a consumer to edit their code. The three screens that set a
 * password call this first, and any consumer building their own can too.
 */
const WEAK_PASSWORDS: readonly string[] = [
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'passw0rd',
  'qwerty',
  'qwerty123',
  'abc123',
  'letmein',
  'welcome',
  'admin',
  'admin123',
  'cashier',
  'kassa',
  'parol',
  'parol123',
  'sifre',
  'iloveyou',
  'monkey',
  '000000',
  '111111',
];

export function passwordIsWeak(password: string, username: string): boolean {
  const folded = password.trim().toLowerCase();
  if (!folded) return true;
  if (folded === normaliseUsername(username)) return true;
  return WEAK_PASSWORDS.includes(folded);
}

export async function createLocalUser(input: {
  username: string;
  displayName: string;
  role: PosLocalRole;
  password: string;
}): Promise<CreateLocalUserResult> {
  const username = normaliseUsername(input.username);
  if (!username) return { ok: false, reason: 'username-empty' };
  if (input.password.length < MIN_LOCAL_PASSWORD_LENGTH) {
    return { ok: false, reason: 'password-too-short' };
  }
  const roles = await readLocalRoles();
  const roleDef = roles.find((r) => r.id === input.role);
  if (!roleDef || !roleDef.enabled) return { ok: false, reason: 'invalid-role' };
  if (await getLocalUserByUsername(username)) return { ok: false, reason: 'username-taken' };

  const credentials = await hashLocalPassword(input.password);
  const user: LocalUser = {
    id: newLocalId(),
    username,
    displayName: input.displayName.trim() || username,
    role: input.role,
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    passwordIterations: credentials.iterations,
    createdAtMillis: Date.now(),
  };
  await saveLocalUser(user);
  return { ok: true, user };
}

export async function setLocalPassword(userId: string, password: string): Promise<boolean> {
  if (password.length < MIN_LOCAL_PASSWORD_LENGTH) return false;
  const user = await getLocalUser(userId);
  if (!user) return false;
  const credentials = await hashLocalPassword(password);
  await saveLocalUser({
    ...user,
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    passwordIterations: credentials.iterations,
  });
  return true;
}

/**
 * Has this machine been commissioned yet?
 *
 * "No accounts" is the only signal, and it is deliberately the absence of data
 * rather than a flag: a flag can be set on a till that has no way to sign
 * anyone in, and that till is bricked.
 */
export async function isCommissioned(): Promise<boolean> {
  return (await listLocalUsers()).length > 0;
}

/**
 * Whether a stored account should be re-hashed at the current cost.
 *
 * `passwordIterations` is stored per user precisely so the cost can be raised
 * later without locking out anybody who signed up under the old one. Nothing
 * acted on it until now, which made the field decoration: an account created at
 * the old cost stayed there for life. `attemptLocalSignIn` calls this on the one
 * occasion the plaintext is in hand.
 */
export function needsRehash(user: LocalUser): boolean {
  return user.passwordIterations < PBKDF2_ITERATIONS;
}

export type LocalSignInResult =
  | { ok: true; user: LocalUser }
  | { ok: false; reason: 'bad-credentials' }
  | { ok: false; reason: 'throttled'; waitMillis: number };

/**
 * Sign in, with the delay ladder applied.
 *
 * The throttle is evaluated on the **typed** name before the account is looked
 * up. That ordering is the whole point: a throttle that only fired for accounts
 * that exist would be exactly the username oracle the dummy derive below exists
 * to close, and it would give it away in milliseconds rather than microseconds.
 *
 * For the same reason a disabled account gets `bad-credentials` and not a reason
 * of its own — "that account is blocked" tells a stranger they have found a real
 * name.
 */
export async function attemptLocalSignIn(
  username: string,
  password: string,
): Promise<LocalSignInResult> {
  const key = normaliseUsername(username);
  const now = Date.now();
  const state = readSignInThrottle();
  const verdict = evaluateSignInThrottle(state[key], now);
  if (!verdict.allowed) {
    return { ok: false, reason: 'throttled', waitMillis: verdict.waitMillis };
  }

  const user = await getLocalUserByUsername(key);
  if (!user || user.disabled) {
    // Still derive, so a wrong username and a wrong password take the same
    // time and cannot be told apart by how fast the till says no.
    await derive(password, crypto.getRandomValues(new Uint8Array(16)), PBKDF2_ITERATIONS);
    bumpSignInThrottle(key);
    return { ok: false, reason: 'bad-credentials' };
  }

  if (!(await verifyLocalPassword(password, user))) {
    bumpSignInThrottle(key);
    return { ok: false, reason: 'bad-credentials' };
  }

  clearSignInThrottle(key);

  // The one moment the plaintext exists. One extra derive on the sign-in path,
  // never on the hot path of a sale.
  if (needsRehash(user)) {
    const credentials = await hashLocalPassword(password);
    const upgraded: LocalUser = {
      ...user,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      passwordIterations: credentials.iterations,
    };
    await saveLocalUser(upgraded);
    return { ok: true, user: upgraded };
  }

  return { ok: true, user };
}

/**
 * @deprecated Prefer `attemptLocalSignIn`, which can say *why* it refused.
 *
 * Kept, and kept with this exact signature, because it is a public export: a
 * consumer calling it must go on compiling. A throttled attempt reads as a wrong
 * password here, which is the best a boolean can do.
 */
export async function signInLocal(username: string, password: string): Promise<LocalUser | null> {
  const result = await attemptLocalSignIn(username, password);
  return result.ok ? result.user : null;
}

// --- Who may be taken away ---

/**
 * Whether an account can be deleted without stranding the till.
 *
 * `pos-app-admin-page.tsx` already refuses to let the Support *role* be switched
 * off, on exactly this reasoning — it is the only role that opens that page, so
 * unticking it locks the door from the inside. The People screen had no matching
 * rule for the last Support *account*, and only stopped you deleting yourself,
 * so two support accounts could delete each other. What is left then is a till
 * with a catalogue, a year of sales and nobody who can add a cashier.
 *
 * Pure, and takes the capability test as an argument rather than importing one,
 * so a custom role that was granted App admin counts and so CI can assert it
 * without a browser.
 */
export function canRemoveLocalUser(
  users: readonly LocalUser[],
  userId: string,
  holdsAppAdmin: (role: PosLocalRole) => boolean,
): boolean {
  const target = users.find((u) => u.id === userId);
  if (!target) return false;
  if (!holdsAppAdmin(target.role) || target.disabled) return true;
  return users.some((u) => u.id !== userId && !u.disabled && holdsAppAdmin(u.role));
}

/**
 * Whether an account can be blocked without stranding the till.
 *
 * Separate from deletion because blocking is the softer of the two and gets
 * reached for more casually, but it strands the machine just as completely:
 * `isCommissioned` counts accounts, not enabled ones, so a till whose every
 * account is blocked shows a sign-in form that can never succeed and never
 * offers setup again.
 */
export function canDisableLocalUser(
  users: readonly LocalUser[],
  userId: string,
  holdsAppAdmin: (role: PosLocalRole) => boolean,
): boolean {
  return canRemoveLocalUser(users, userId, holdsAppAdmin);
}

// --- The delay ladder, as this device remembers it ---

/**
 * Failed-attempt counts, in localStorage beside the session.
 *
 * Deliberately **not** a `local*` IndexedDB store. A new one of those has to
 * join `factoryResetLocalStore` and the backup in the same change, and a backup
 * that restores "aysel is delayed until 14:32" onto a replacement till is a bug,
 * not a feature. This is device state with a fifteen-minute memory, not shop
 * data.
 *
 * Mirrored in memory for the same reason `locale-preference.ts` mirrors its
 * value: where site data is blocked the ladder still applies for this tab
 * instead of not applying at all.
 */
let throttleCache: SignInThrottleState | undefined;

function readSignInThrottle(): SignInThrottleState {
  if (throttleCache) return throttleCache;
  throttleCache = {};
  if (typeof window === 'undefined') return throttleCache;
  try {
    const raw = window.localStorage.getItem(THROTTLE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const rec = value as Partial<SignInThrottleRecord>;
        if (typeof rec?.failures === 'number' && typeof rec?.lastFailureAtMillis === 'number') {
          throttleCache[key] = {
            failures: rec.failures,
            lastFailureAtMillis: rec.lastFailureAtMillis,
          };
        }
      }
    }
  } catch {
    // Blocked, or somebody edited it by hand. An empty ladder is the safe
    // reading: it delays nobody who should not be delayed.
  }
  return throttleCache;
}

function writeSignInThrottle(state: SignInThrottleState): void {
  throttleCache = state;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked. The mirror above still drives this tab.
  }
}

function bumpSignInThrottle(key: string): void {
  const now = Date.now();
  const state = pruneSignInThrottle(readSignInThrottle(), now);
  state[key] = recordSignInFailure(state[key], now);
  writeSignInThrottle(state);
}

function clearSignInThrottle(key: string): void {
  const state = pruneSignInThrottle(readSignInThrottle(), Date.now());
  delete state[key];
  writeSignInThrottle(state);
}

/** How long this device would currently make the given name wait. For the form. */
export function peekSignInThrottle(username: string): SignInThrottleVerdict {
  return evaluateSignInThrottle(readSignInThrottle()[normaliseUsername(username)], Date.now());
}

// --- Session ---

/**
 * What the till remembers about who is signed in.
 *
 * Grown from the bare user id it used to be. The id alone could not answer two
 * questions the register kept getting wrong: whether the password has been
 * changed since this session was minted, and how long ago anybody last touched
 * the machine. Both now travel with it.
 *
 * `credentialStamp` is a prefix of the stored password hash. It is already a
 * hash, so a prefix of it reveals nothing a reader of this record did not
 * already have — and it changes whenever the password does, which is the whole
 * job. Resetting a cashier's password from the People screen now ends their
 * session on the next check instead of leaving it live until somebody reloads.
 */
export interface LocalSessionRecord {
  userId: string;
  issuedAtMillis: number;
  lastSeenAtMillis: number;
  credentialStamp: string;
}

/** Sixteen base64 characters of the stored hash. Enough to notice a change. */
export function credentialStampOf(user: LocalUser): string {
  return user.passwordHash.slice(0, 16);
}

/**
 * Read the stored record, tolerating the bare user id every till in the field
 * has on disk right now.
 *
 * Pure and exported so CI can hold the upgrade path still. Without the
 * bare-string branch, every existing till would sign its cashier out the first
 * morning after this release — which is precisely the kind of "a change of
 * software stopped the queue" this codebase keeps refusing to ship.
 */
export function parseLocalSession(raw: string | null): LocalSessionRecord | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== '{') {
    return { userId: trimmed, issuedAtMillis: 0, lastSeenAtMillis: 0, credentialStamp: '' };
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<LocalSessionRecord>;
    if (!parsed || typeof parsed.userId !== 'string' || !parsed.userId) return null;
    return {
      userId: parsed.userId,
      issuedAtMillis: typeof parsed.issuedAtMillis === 'number' ? parsed.issuedAtMillis : 0,
      lastSeenAtMillis: typeof parsed.lastSeenAtMillis === 'number' ? parsed.lastSeenAtMillis : 0,
      credentialStamp: typeof parsed.credentialStamp === 'string' ? parsed.credentialStamp : '',
    };
  } catch {
    return null;
  }
}

function readLocalSession(): LocalSessionRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseLocalSession(window.localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function writeLocalSession(record: LocalSessionRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(record));
  } catch {
    // Storage blocked. The cashier stays signed in for this session only.
  }
}

/**
 * The signed-in user id, kept in localStorage.
 *
 * Surviving a restart is the point: a till that has to be signed into again
 * after every power cut is a till whose password ends up on a sticky note
 * beside the screen. Sign-out is explicit, and the record here still grants
 * nothing on its own, because the account it names is on the same disk anyway.
 */
export function readLocalSessionId(): string | null {
  return readLocalSession()?.userId ?? null;
}

export function writeLocalSessionId(userId: string): void {
  const now = Date.now();
  writeLocalSession({
    userId,
    issuedAtMillis: now,
    lastSeenAtMillis: now,
    // Stamped by `startLocalSession` where the account is in hand. Callers that
    // only have an id get an empty stamp, which `restoreLocalSession` reads as
    // "nothing to compare" rather than as a mismatch.
    credentialStamp: '',
  });
}

/** Start a session for an account, stamping the credential it was minted against. */
export function startLocalSession(user: LocalUser): void {
  const now = Date.now();
  writeLocalSession({
    userId: user.id,
    issuedAtMillis: now,
    lastSeenAtMillis: now,
    credentialStamp: credentialStampOf(user),
  });
}

/** Note that somebody is still at the till. Drives the idle lock, nothing else. */
export function touchLocalSession(): void {
  const record = readLocalSession();
  if (!record) return;
  writeLocalSession({ ...record, lastSeenAtMillis: Date.now() });
}

/** When the till was last touched, or 0 when that is not known. */
export function readLocalSessionLastSeen(): number {
  return readLocalSession()?.lastSeenAtMillis ?? 0;
}

/**
 * A fresh id minted each time somebody signs in.
 *
 * A nonce rather than a timestamp because the opening-cash gate asks "is this
 * the same sign-in the drawer was declared for?", and equality cannot be fooled
 * by a clock that moves — an NTP correction, a hand-set date or a laptop
 * carried across a timezone all change what "since you signed in" means, none
 * of them change whether two ids match. It also makes the record
 * self-describing: two declarations on one day carrying different ids are
 * visibly two sign-ins rather than a double-click.
 *
 * Named `signInId`, never `sessionId` — `Order.sessionId` already means a cloud
 * shift, and one word doing two jobs is how the two get wired together by
 * mistake. Kept in a key of its own rather than folded into the session record
 * above, because the idle lock must be able to end a session without minting a
 * new one: a lock that changed this id would send the cashier back to the
 * drawer-count screen every time they came back from serving a customer.
 */
export function readLocalSignInId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SIGN_IN_KEY);
  } catch {
    return null;
  }
}

export function writeLocalSignInId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIGN_IN_KEY, id);
  } catch {
    // Storage blocked. The id lives in React state for this tab only, so the
    // drawer is declared once per tab rather than never.
  }
}

export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SIGN_IN_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Resolve the stored session to a live account, or null if it no longer applies.
 *
 * Three ways it stops applying: the account is gone, the account has been
 * blocked, or its password has been changed since this session was minted. The
 * third is new — before it, resetting a cashier's password left them working at
 * the till until somebody happened to reload the page.
 *
 * A record carrying no stamp is one written before this release, or by
 * `writeLocalSessionId`. It is honoured and then re-stamped, so an existing till
 * upgrades on its next check instead of signing everybody out.
 */
export async function restoreLocalSession(): Promise<LocalUser | null> {
  const record = readLocalSession();
  if (!record) return null;
  const user = await getLocalUser(record.userId);
  if (!user || user.disabled) {
    clearLocalSession();
    return null;
  }
  const stamp = credentialStampOf(user);
  if (record.credentialStamp && record.credentialStamp !== stamp) {
    clearLocalSession();
    return null;
  }
  if (record.credentialStamp !== stamp) {
    writeLocalSession({ ...record, credentialStamp: stamp });
  }
  return user;
}
