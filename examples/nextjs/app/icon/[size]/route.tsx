import { ImageResponse } from 'next/og';
import { readPwaBrand } from '../../_pwa-brand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([180, 192, 512]);

/**
 * Logo-derived square app icon. Fetches the brand logo bytes and paints them
 * (object-fit: contain) onto a square theme-color canvas — turning a non-square
 * logo into a valid square PNG. `?maskable=1` adds a safe-zone inset. Falls back
 * to a solid theme-color square when no logo is set, so installability holds.
 */
export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await ctx.params;
  let size = Number.parseInt(sizeParam, 10);
  if (!ALLOWED.has(size)) size = 512;

  const maskable = new URL(req.url).searchParams.get('maskable') === '1';
  const brand = await readPwaBrand();

  let dataUrl: string | null = null;
  if (brand.iconUrl) {
    try {
      const res = await fetch(brand.iconUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get('content-type') || 'image/png';
        dataUrl = `data:${type};base64,${buf.toString('base64')}`;
      }
    } catch {
      dataUrl = null;
    }
  }

  const pad = Math.round(size * (maskable ? 0.18 : 0.12));
  const inner = size - pad * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: brand.themeColor,
        }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} width={inner} height={inner} style={{ objectFit: 'contain' }} alt="" />
        ) : null}
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400, must-revalidate' } },
  );
}
