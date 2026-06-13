import { buildWebManifest } from '@caspian-explorer/script-caspian-store';
import { readPwaBrand } from '../_pwa-brand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dynamic web app manifest. Reads the store's brand from `settings/site` and
 * hands it to the library's `buildWebManifest()` pure helper. Icons point at
 * the `/icon/{size}` route, which derives square icons from the brand logo.
 */
export async function GET() {
  const brand = await readPwaBrand();
  const manifest = buildWebManifest({
    name: brand.name,
    description: brand.description,
    themeColor: brand.themeColor,
  });
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}
