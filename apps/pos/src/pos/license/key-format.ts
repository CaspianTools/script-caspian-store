/**
 * The licence key format, and the codecs both halves share.
 *
 * A key looks like:
 *
 *   cslic1.<base64url payload>.<base64url signature>
 *
 * The payload is JSON; the signature is Ed25519 over the *encoded payload
 * string's bytes*, not over the JSON object. Signing the encoded text sidesteps
 * canonical-JSON entirely — the verifier never re-serialises anything, so key
 * order, whitespace and number formatting cannot change what was signed.
 *
 * The whole key is public. It carries no secret and grants no access; it is a
 * claim about who paid, which the register displays and the server records.
 * See the honesty note in `verify.ts` about what this can and cannot enforce.
 */

export const LICENSE_KEY_PREFIX = 'cslic1';

export interface PosLicensePayload {
  /** Licence id. Unique per sale; also the `posLicenses` document id. */
  lic: string;
  /** Who it was sold to. Shown in the register and the admin panel. */
  name: string;
  /** Computers this key may run on. Always 1 for per-computer licensing. */
  seats: number;
  /** Issued at, epoch seconds. */
  iat: number;
  /** Expires at, epoch seconds. Absent means perpetual. */
  exp?: number;
  /** Free-form product tier, if the vendor sells more than one. */
  tier?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Base64url, no padding — safe in a URL, an email and a double-click-to-select. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = typeof btoa === 'function' ? btoa(binary) : nodeBtoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  // atob rejects a missing pad, so restore it rather than requiring callers to.
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(padded) : nodeAtob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// The Cloud Functions runtime has no atob/btoa on older Node majors, and the
// minting CLI runs in Node too. Fall back rather than branch at every call site.
function nodeBtoa(binary: string): string {
  return (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } })
    .Buffer!.from(binary, 'binary')
    .toString('base64');
}
function nodeAtob(base64: string): string {
  return (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } })
    .Buffer!.from(base64, 'base64')
    .toString('binary');
}

export interface ParsedLicenseKey {
  payload: PosLicensePayload;
  /** The encoded payload segment — this is what the signature covers. */
  signedText: string;
  signature: Uint8Array;
}

/**
 * Split and decode a key. Structure only — this proves nothing about
 * authenticity; `verifyLicenseKey` does that.
 *
 * Returns `null` rather than throwing: a mistyped key is an ordinary event at a
 * counter, not an exception.
 */
export function parseLicenseKey(key: string): ParsedLicenseKey | null {
  const trimmed = (key || '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  const [prefix, payloadPart, signaturePart] = parts;
  if (prefix !== LICENSE_KEY_PREFIX || !payloadPart || !signaturePart) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadPart))) as PosLicensePayload;
    if (typeof payload?.lic !== 'string' || !payload.lic) return null;
    if (typeof payload.name !== 'string') return null;
    if (typeof payload.iat !== 'number') return null;
    return { payload, signedText: payloadPart, signature: fromBase64Url(signaturePart) };
  } catch {
    return null;
  }
}

/** Assemble a key from an already-computed signature. Used by the minting CLI. */
export function formatLicenseKey(payload: PosLicensePayload, sign: (data: Uint8Array) => Uint8Array): string {
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = sign(encoder.encode(payloadPart));
  return `${LICENSE_KEY_PREFIX}.${payloadPart}.${toBase64Url(signature)}`;
}

/** The exact bytes a signer must sign, and a verifier must check. */
export function signedBytes(signedText: string): Uint8Array {
  return encoder.encode(signedText);
}
