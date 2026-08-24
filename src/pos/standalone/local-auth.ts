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

const SESSION_KEY = 'caspian:pos:localSession';

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

export async function verifyLocalPassword(password: string, user: LocalUser): Promise<boolean> {
  const candidate = await derive(password, fromBase64(user.passwordSalt), user.passwordIterations);
  return constantTimeEqual(candidate, user.passwordHash);
}

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

export type CreateLocalUserResult =
  | { ok: true; user: LocalUser }
  | { ok: false; reason: 'username-taken' | 'username-empty' | 'password-too-short' | 'invalid-role' };

/** Short, but a till is a physical device behind a counter, not an internet-facing login. */
export const MIN_LOCAL_PASSWORD_LENGTH = 6;

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

export async function signInLocal(username: string, password: string): Promise<LocalUser | null> {
  const user = await getLocalUserByUsername(normaliseUsername(username));
  if (!user || user.disabled) {
    // Still derive, so a wrong username and a wrong password take the same
    // time and cannot be told apart by how fast the till says no.
    await derive(password, crypto.getRandomValues(new Uint8Array(16)), PBKDF2_ITERATIONS);
    return null;
  }
  return (await verifyLocalPassword(password, user)) ? user : null;
}

// --- Session ---

/**
 * The signed-in user id, kept in localStorage.
 *
 * Surviving a restart is the point: a till that has to be signed into again
 * after every power cut is a till whose password ends up on a sticky note
 * beside the screen. Sign-out is explicit, and the record here is only an id —
 * it grants nothing on its own, because the account it names is on the same
 * disk anyway.
 */
export function readLocalSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeLocalSessionId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_KEY, userId);
  } catch {
    // Storage blocked. The cashier stays signed in for this session only.
  }
}

export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Resolve the stored session to a live account, or null if it no longer exists. */
export async function restoreLocalSession(): Promise<LocalUser | null> {
  const id = readLocalSessionId();
  if (!id) return null;
  const user = await getLocalUser(id);
  if (!user || user.disabled) {
    clearLocalSession();
    return null;
  }
  return user;
}
