#!/usr/bin/env node
/**
 * Mint one POS licence key to sell.
 *
 *   node scripts/mint-pos-license.mjs --name "Acme Shop" [options]
 *
 *   --name <text>       Customer or shop name. Shown in the register. Required.
 *   --key <path>        Private key PEM. Default ./pos-signing-key.pem
 *   --expires <date>    YYYY-MM-DD. Omit for a perpetual licence.
 *   --tier <text>       Free-form product tier, if you sell more than one.
 *   --lic <id>          Licence id. Default: a random one.
 *   --seats <n>         Computers allowed. Default 1, and 1 is the model this
 *                       product is built around.
 *
 * Prints the key. Send it to the customer; they paste it into the register at
 * /pos/settings. The key is public — it carries no secret and unlocks nothing
 * on its own. What it does is let their register say who it belongs to, and let
 * your Cloud Function record which computer claimed it.
 */
import { createPrivateKey, sign as nodeSign, randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const name = arg('name');
if (!name) {
  console.error('Usage: node scripts/mint-pos-license.mjs --name "Acme Shop" [--expires 2027-01-01]');
  console.error('Run node scripts/generate-pos-signing-key.mjs first if you have no signing key yet.');
  process.exit(1);
}

const keyPath = arg('key', './pos-signing-key.pem');
if (!existsSync(keyPath)) {
  console.error(`No signing key at ${keyPath}.`);
  console.error('Create one with: node scripts/generate-pos-signing-key.mjs');
  process.exit(1);
}

const expiresRaw = arg('expires');
let exp;
if (expiresRaw) {
  // Parse as UTC midnight so a licence does not expire a day early or late
  // depending on where the machine minting it happens to be.
  const parsed = Date.parse(`${expiresRaw}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    console.error(`--expires must be YYYY-MM-DD, got "${expiresRaw}".`);
    process.exit(1);
  }
  exp = Math.floor(parsed / 1000);
}

const seats = Number.parseInt(arg('seats', '1'), 10);
if (!Number.isInteger(seats) || seats < 1) {
  console.error('--seats must be a positive whole number.');
  process.exit(1);
}

const payload = {
  lic: arg('lic', randomUUID()),
  name,
  seats,
  iat: Math.floor(Date.now() / 1000),
  ...(exp ? { exp } : {}),
  ...(arg('tier') ? { tier: arg('tier') } : {}),
};

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// The signature covers the ENCODED payload text, not a re-serialised object, so
// the verifier never has to agree with us about canonical JSON.
const payloadPart = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));
const signature = nodeSign(null, Buffer.from(payloadPart, 'utf8'), privateKey);

console.log('');
console.log(`cslic1.${payloadPart}.${b64url(signature)}`);
console.log('');
console.log(`  licence id : ${payload.lic}`);
console.log(`  sold to    : ${payload.name}`);
console.log(`  computers  : ${payload.seats}`);
console.log(`  expires    : ${exp ? new Date(exp * 1000).toISOString().slice(0, 10) : 'never'}`);
