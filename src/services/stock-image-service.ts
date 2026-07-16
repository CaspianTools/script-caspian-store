import type { StockImageResult } from '../types';

/**
 * Client for the `/api/stock-images` proxy (v9.4). Engine-safe (no `next/*`):
 * it talks to the server route over `fetch`. The route proxies Openverse
 * (CORS-disabled) and can stream image bytes for re-upload to Storage.
 */

export interface StockImageSearchResponse {
  results: StockImageResult[];
  page: number;
  pageCount: number;
  resultCount: number;
}

export interface StockImageSearchOptions {
  /** Exact license filter, e.g. `cc0`. Overrides `licenseType` when set. */
  license?: string;
  /** Usage filter, default `commercial,modification`. */
  licenseType?: string;
}

/** Auth header for the admin-only proxy (the caller passes a Firebase ID token). */
const authHeaders = (idToken?: string | null): HeadersInit =>
  idToken ? { Authorization: `Bearer ${idToken}` } : {};

export async function searchStockImages(
  query: string,
  page = 1,
  opts: StockImageSearchOptions = {},
  idToken?: string | null,
): Promise<StockImageSearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  if (opts.license) params.set('license', opts.license);
  if (opts.licenseType) params.set('licenseType', opts.licenseType);
  const res = await fetch(`/api/stock-images?${params.toString()}`, { headers: authHeaders(idToken) });
  if (!res.ok) throw new Error(`Stock search failed (${res.status})`);
  return (await res.json()) as StockImageSearchResponse;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Download a chosen stock image's bytes (via the proxy, to dodge image-host
 * CORS) as a `File` ready for `uploadAdminImage`.
 */
export async function fetchStockImageFile(
  fullUrl: string,
  baseName = 'stock',
  idToken?: string | null,
): Promise<File> {
  const res = await fetch(`/api/stock-images?download=${encodeURIComponent(fullUrl)}`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const blob = await res.blob();
  const ext = EXT_BY_TYPE[blob.type] ?? 'jpg';
  const safe = baseName.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'stock';
  return new File([blob], `${safe}.${ext}`, { type: blob.type || 'image/jpeg' });
}
