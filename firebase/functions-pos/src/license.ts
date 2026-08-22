import { createPublicKey, verify as nodeVerify } from 'node:crypto';

/**
 * Server-side half of the licence check.
 *
 * Mirrors src/pos/license/key-format.ts exactly: the signature covers the
 * *encoded payload string's bytes*, never a re-serialised object, so the two
 * sides cannot disagree about canonical JSON.
 *
 * Node's `crypto.verify` is used rather than Web Crypto because Ed25519 support
 * here is ancient and unconditional, whereas Web Crypto's is recent — and this
 * is the check that has to be right.
 */

export const LICENSE_KEY_PREFIX = 'cslic1';

export interface PosLicensePayload {
  lic: string;
  name: string;
  seats: number;
  iat: number;
  exp?: number;
  tier?: string;
}

export type LicenseVerdict =
  | { ok: true; payload: PosLicensePayload }
  | { ok: false; reason: 'not-configured' | 'malformed' | 'signature' | 'expired' };

function fromBase64Url(text: string): Buffer {
  return Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * The vendor public key, read from the environment rather than hardcoded so a
 * distributor can rotate it without a redeploy of this library's source.
 * Absent means the deployment does not sell licences, and activation is a no-op.
 */
function publicKeyBase64(): string {
  return (process.env.CASPIAN_POS_LICENSE_PUBLIC_KEY || '').trim();
}

export function isLicensingConfigured(): boolean {
  return publicKeyBase64().length > 0;
}

export function verifyLicenseKey(key: string): LicenseVerdict {
  const configured = publicKeyBase64();
  if (!configured) return { ok: false, reason: 'not-configured' };

  const parts = (key || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_KEY_PREFIX) {
    return { ok: false, reason: 'malformed' };
  }
  const [, payloadPart, signaturePart] = parts;

  let payload: PosLicensePayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8')) as PosLicensePayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload?.lic !== 'string' || !payload.lic || typeof payload.iat !== 'number') {
    return { ok: false, reason: 'malformed' };
  }

  let ok = false;
  try {
    // Raw 32-byte Ed25519 public keys are not a format createPublicKey accepts,
    // so wrap it in the 12-byte SPKI prefix for Ed25519 (RFC 8410) rather than
    // asking the distributor to paste DER.
    const raw = fromBase64Url(configured);
    const spki = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      raw,
    ]);
    const keyObject = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    ok = nodeVerify(null, Buffer.from(payloadPart, 'utf8'), keyObject, fromBase64Url(signaturePart));
  } catch {
    return { ok: false, reason: 'signature' };
  }

  if (!ok) return { ok: false, reason: 'signature' };
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}
