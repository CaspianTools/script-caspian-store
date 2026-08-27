// The /pwa entry, not the barrel: these are pure functions with no React in
// them, and the sibling module this used to import stayed in the library when
// the till moved out to apps/pos.
import {
  buildWebManifest,
  type WebManifestIcon,
  type WebManifestInput,
} from '@caspian-explorer/script-caspian-store/pwa';

/**
 * Web app manifest for the register, served at `/pos.webmanifest`.
 *
 * The register installs as its **own** app, separate from the storefront PWA at
 * scope `/`. A shop that installs both gets two icons that open two different
 * things, which is the point: a cashier's till should launch straight into the
 * register, not into the shop with the register two taps away.
 *
 * Three fields here are load-bearing rather than decorative:
 *
 * - `id: '/pos'` — install identity. Without it Chromium falls back to
 *   `start_url`, and two manifests on one origin can collide into one app.
 * - `launch_handler.client_mode: 'focus-existing'` — tapping the icon while the
 *   register is already open must *focus* it. The open ticket lives in React
 *   state, so the default `navigate-existing` would re-navigate to `start_url`
 *   and destroy a half-rung sale.
 * - `scope: '/pos'` — keeps the installed window on the register. A link out to
 *   `/admin` opens in the browser instead of hijacking the till's app window.
 *
 * `short_name` is deliberately not the brand: the OS shows it under the icon,
 * and "Register" next to the shop's own name is what tells a cashier which of
 * the two apps to tap.
 */
export interface PosWebManifestInput {
  /** Brand name, used for the long-form `name` only. */
  name?: string;
  themeColor?: string;
  backgroundColor?: string;
  /** Defaults to the shared `/icon/{size}` routes. */
  icons?: WebManifestIcon[];
  /** Serve the register as the ONLY app on the origin (a register-only store). */
  registerOnly?: boolean;
}

export function buildPosWebManifest(input: PosWebManifestInput = {}): Record<string, unknown> {
  const brand = input.name?.trim();
  // A register-only store has no storefront to share the origin with, so the
  // register takes the root scope and there is only ever one installable app.
  const scope = input.registerOnly ? '/' : '/pos';

  const base: WebManifestInput = {
    name: brand ? `${brand} Register` : 'Register',
    shortName: 'Register',
    description: brand ? `Point of sale for ${brand}` : 'Point of sale register',
    startUrl: '/pos',
    scope,
    display: 'standalone',
    // A till is a counter monitor, a tablet on a stand, or a phone in a market.
    // Pinning portrait would letterbox the two-pane register on half of them.
    orientation: 'any',
    themeColor: input.themeColor,
    backgroundColor: input.backgroundColor,
    icons: input.icons,
  };

  return {
    ...buildWebManifest(base),
    id: scope,
    launch_handler: { client_mode: 'focus-existing' },
  };
}
