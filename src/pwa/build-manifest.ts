/**
 * PWA web app manifest builder (framework-agnostic, isomorphic).
 *
 * A consumer's route handler reads its `settings/site` doc, maps it into
 * `WebManifestInput`, and returns `JSON.stringify(buildWebManifest(input))`
 * with `Content-Type: application/manifest+json`. Keeping this a pure function
 * lets the library stay framework-agnostic — the Firestore read + route wiring
 * live in the consumer app (see `examples/nextjs/app/manifest.webmanifest`).
 */
export interface WebManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: 'any' | 'maskable' | 'monochrome' | string;
}

export interface WebManifestInput {
  /** Install name (brand). */
  name?: string;
  /** Short name for the home screen (<= ~12 chars recommended). */
  shortName?: string;
  description?: string;
  /** Brand color for `theme_color`. */
  themeColor?: string;
  /** Splash/background color. */
  backgroundColor?: string;
  /** Launch URL. Default `/`. */
  startUrl?: string;
  /** Navigation scope. Default `/`. */
  scope?: string;
  /** `standalone` (default), `fullscreen`, `minimal-ui`, or `browser`. */
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation?: 'any' | 'portrait' | 'landscape';
  /** Icons. Defaults to square 192/512 + maskable at `/icon/{size}`. */
  icons?: WebManifestIcon[];
}

const DEFAULT_ICONS: WebManifestIcon[] = [
  { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export function buildWebManifest(input: WebManifestInput = {}): Record<string, unknown> {
  const name = input.name?.trim() || 'Store';
  const shortName = input.shortName?.trim() || (name.length > 12 ? name.slice(0, 12) : name);
  return {
    name,
    short_name: shortName,
    description: input.description?.trim() || name,
    start_url: input.startUrl || '/',
    scope: input.scope || '/',
    display: input.display || 'standalone',
    orientation: input.orientation || 'portrait',
    background_color: input.backgroundColor || '#ffffff',
    theme_color: input.themeColor || '#111111',
    icons: input.icons && input.icons.length > 0 ? input.icons : DEFAULT_ICONS,
  };
}
