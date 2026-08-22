#!/usr/bin/env node
/**
 * Create the Ed25519 keypair used to sign POS licence keys.
 *
 *   node scripts/generate-pos-signing-key.mjs [--out ./pos-signing-key.pem]
 *
 * Writes the PRIVATE key to a file and prints the PUBLIC half for you to paste
 * into two places:
 *
 *   1. src/pos/license/public-key.ts  -> POS_LICENSE_PUBLIC_KEY
 *   2. the caspian-pos Cloud Functions environment, as
 *      CASPIAN_POS_LICENSE_PUBLIC_KEY
 *
 * Run this ONCE. Every licence you sell is signed by this key, so replacing it
 * invalidates every licence already in the field. Back the private key up
 * somewhere that is not this repository, and never commit it.
 */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, existsSync, chmodSync } from 'node:fs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : './pos-signing-key.pem';

if (existsSync(out)) {
  console.error(`Refusing to overwrite ${out}.`);
  console.error('Every licence already sold was signed with that key. Move it aside first if you');
  console.error('genuinely mean to start over, and expect to reissue every licence.');
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

writeFileSync(out, privateKey.export({ type: 'pkcs8', format: 'pem' }));
try {
  chmodSync(out, 0o600);
} catch {
  // Windows will not honour POSIX modes; the warning below covers it.
}

// Strip the 12-byte SPKI header to get the bare 32-byte key, then base64url it,
// so the value pastes cleanly into TypeScript and into an env var.
const spki = publicKey.export({ type: 'spki', format: 'der' });
const raw = spki.subarray(spki.length - 32);
const base64url = raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

console.log(`Private key written to ${out}`);
console.log('  Keep it out of git. Back it up. Losing it means you can never mint another licence.');
console.log('');
console.log('Public key (safe to publish):');
console.log('');
console.log(`  ${base64url}`);
console.log('');
console.log('Paste it into BOTH:');
console.log('  1. src/pos/license/public-key.ts   ->  export const POS_LICENSE_PUBLIC_KEY = \'…\';');
console.log('  2. the caspian-pos functions env   ->  CASPIAN_POS_LICENSE_PUBLIC_KEY=…');
