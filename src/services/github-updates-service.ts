export interface GithubRelease {
  tagName: string;
  version: string;
  name: string | null;
  body: string;
  htmlUrl: string;
  publishedAt: string;
}

export const DEFAULT_REPO_OWNER = 'CaspianTools';
export const DEFAULT_REPO_NAME = 'script-caspian-store';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: GithubRelease[] }>();

interface RawRelease {
  tag_name?: string;
  name?: string | null;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}

function toRelease(raw: RawRelease): GithubRelease {
  const tagName = raw.tag_name ?? '';
  return {
    tagName,
    version: tagName.replace(/^v/, ''),
    name: raw.name ?? null,
    body: raw.body ?? '',
    htmlUrl: raw.html_url ?? '',
    publishedAt: raw.published_at ?? '',
  };
}

function describeHttpError(status: number, statusText: string): string {
  if (statusText) return `GitHub API ${status}: ${statusText}`;
  const hint =
    status === 404 ? 'Not found or private' :
    status === 403 ? 'Rate-limited or forbidden' :
    '';
  return hint ? `GitHub API ${status}: ${hint}` : `GitHub API ${status}`;
}

export async function fetchRecentReleases(
  owner: string = DEFAULT_REPO_OWNER,
  repo: string = DEFAULT_REPO_NAME,
  limit = 5,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<GithubRelease[]> {
  const key = `${owner}/${repo}?per_page=${limit}`;
  const hit = cache.get(key);
  if (!options.force && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }
  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: options.signal,
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    if (err instanceof TypeError) throw new Error('Network error');
    throw err;
  }
  if (!res.ok) {
    throw new Error(describeHttpError(res.status, res.statusText));
  }
  const json = (await res.json()) as RawRelease[];
  const data = json
    .filter((r) => !r.draft && !r.prerelease)
    .map(toRelease)
    .slice(0, limit);
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => {
        const parsed = parseInt(n, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

export function isUpdateAvailable(installed: string, latest: string): boolean {
  return compareVersions(installed, latest) < 0;
}
