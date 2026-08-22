/**
 * The vendor's Ed25519 public key, used to check that a licence key was issued
 * by whoever distributes this build.
 *
 * **Empty by default, and that is deliberate.** This library is used by shops
 * that never bought a POS licence from anyone, and a build with no key must
 * behave as though licensing does not exist: no banner, no nag, no status. Only
 * a distributor who actually sells licences fills this in.
 *
 * To set it up:
 *
 *   node scripts/generate-pos-signing-key.mjs
 *
 * That writes a private key you keep off this repo (add it to `.gitignore`, or
 * better, keep it out of the working tree entirely) and prints the public half
 * to paste below. Then mint a key per sale:
 *
 *   node scripts/mint-pos-license.mjs --key ./pos-signing-key.pem \
 *     --name "Acme Shop" --expires 2027-01-01
 *
 * Losing the private key means every licence you have already sold still
 * verifies, but you can never mint another that does. Back it up before you
 * sell anything.
 */
export const POS_LICENSE_PUBLIC_KEY = '';

/**
 * Whether this build was set up to check licences at all. When false the whole
 * licence surface stays out of the way — see `usePosLicense`.
 */
export function isLicensingConfigured(): boolean {
  return POS_LICENSE_PUBLIC_KEY.trim().length > 0;
}
