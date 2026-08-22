import {
  fromBase64Url,
  parseLicenseKey,
  signedBytes,
  type PosLicensePayload,
} from './key-format';
import { POS_LICENSE_PUBLIC_KEY, isLicensingConfigured } from './public-key';

/**
 * What a licence check concluded.
 *
 * `unverifiable` is distinct from `invalid` on purpose. A browser too old for
 * Ed25519 in Web Crypto cannot check a signature, and treating that as a forged
 * licence would nag a paying customer because of their browser version. It is
 * reported honestly instead, and the server-side check in `activatePosLicense`
 * is what actually decides.
 */
export type PosLicenseStatus =
  | 'disabled'
  | 'missing'
  | 'valid'
  | 'expired'
  | 'invalid'
  | 'unverifiable';

export interface PosLicenseCheck {
  status: PosLicenseStatus;
  payload?: PosLicensePayload;
  /** Set when the signature could not be checked here. Never a reason to block. */
  reason?: string;
}

/**
 * A note on what this is worth, kept next to the code so nobody has to guess.
 *
 * This library is MIT-licensed with public source. A check that runs in the
 * browser is a speed bump, not a lock: anyone can fork the package and delete
 * this file. Verification here exists so an honest shop gets instant, offline
 * feedback about the key it pasted — not to stop a determined copy.
 *
 * The half with teeth is server-side: `activatePosLicense` re-verifies the same
 * signature with the Admin SDK and binds the licence to one `deviceId`, so a key
 * used on a second computer is recorded as such in a place the customer cannot
 * edit. Even that only produces a *record*: enforcement here is warning-only by
 * deliberate choice, so a clock skew or a failed activation can never take a
 * real shop off the counter mid-trade.
 */
async function importVerifyKey(): Promise<CryptoKey | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    return await subtle.importKey(
      'raw',
      fromBase64Url(POS_LICENSE_PUBLIC_KEY.trim()) as unknown as ArrayBuffer,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
  } catch {
    // Either the environment has no Ed25519 (older browsers) or the configured
    // key is not a valid raw Ed25519 public key. Both are "cannot check here".
    return null;
  }
}

/**
 * Check a licence key. Structure, then signature, then dates — in that order,
 * so a mistyped key reports as malformed rather than as expired.
 */
export async function verifyLicenseKey(key: string | null | undefined): Promise<PosLicenseCheck> {
  if (!isLicensingConfigured()) return { status: 'disabled' };
  if (!key || !key.trim()) return { status: 'missing' };

  const parsed = parseLicenseKey(key);
  if (!parsed) return { status: 'invalid', reason: 'malformed' };

  const verifyKey = await importVerifyKey();
  if (!verifyKey) {
    // Report the dates we can read, but be explicit that nothing was proven.
    return {
      status: 'unverifiable',
      payload: parsed.payload,
      reason: 'This browser cannot check the licence signature.',
    };
  }

  let signatureOk = false;
  try {
    signatureOk = await globalThis.crypto.subtle.verify(
      { name: 'Ed25519' },
      verifyKey,
      parsed.signature as unknown as ArrayBuffer,
      signedBytes(parsed.signedText) as unknown as ArrayBuffer,
    );
  } catch {
    return { status: 'unverifiable', payload: parsed.payload, reason: 'Signature check failed to run.' };
  }

  if (!signatureOk) return { status: 'invalid', reason: 'signature' };

  if (typeof parsed.payload.exp === 'number' && parsed.payload.exp * 1000 < Date.now()) {
    return { status: 'expired', payload: parsed.payload };
  }

  return { status: 'valid', payload: parsed.payload };
}
