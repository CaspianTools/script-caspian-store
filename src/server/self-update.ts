/**
 * Server-side helper for the consumer's `/api/caspian-store/update` route.
 *
 * Two modes, picked at request time by what's in the consumer's environment:
 *
 *   1. **GitHub-commit mode** (preferred on serverless hosts). Active when
 *      `CASPIAN_GITHUB_TOKEN` and `CASPIAN_CONSUMER_REPO` are set. The route
 *      uses the GitHub REST API to bump the consumer's package.json (and
 *      best-effort, package-lock.json) and push a single commit to the
 *      configured branch. The consumer's host (App Hosting / Vercel / etc.)
 *      detects the push and triggers a normal redeploy. This works on
 *      read-only-filesystem hosts where the npm-install mode below can't.
 *
 *   2. **npm-install mode** (fallback, the original v7 behaviour). Spawns
 *      `npm install github:<owner>/<repo>#v<version>` against the running
 *      process's CWD, then `process.exit(0)` so a supervisor (PM2, systemd,
 *      Docker, Next dev) restarts the Node process with the new dependency
 *      loaded. Requires both `git` and a writable `node_modules`. Right for
 *      VPS / Docker / local dev; wrong for App Hosting and Vercel.
 *
 * Threat model (applies to both modes): this endpoint is, by design, an
 * arbitrary-code-execution path — it either shells out to `npm install` or
 * tells GitHub to advance the branch HEAD to a new dependency tag. We
 * mitigate with five layers (any of which is a hard refusal):
 *   1. `CASPIAN_ALLOW_SELF_UPDATE=true` env var must be set. Opt-in in *all*
 *      environments, not just production. Stops accidental enablement.
 *   2. Caller must present a valid Firebase Auth ID token whose uid maps to
 *      a Firestore `users/{uid}` doc with `role == 'admin'` — the same
 *      definition `firestore.rules` `isAdmin()` uses, so the two stay in
 *      lockstep. The role lookup uses Firestore REST with the caller's own
 *      ID token (not the Admin SDK), so the route doesn't require Application
 *      Default Credentials and works on every host that can do HTTPS — Vercel,
 *      Netlify, Cloud Run, App Engine, etc. Tokens are short-lived (1h) and
 *      rotated.
 *   3. The `version` field is restricted to `X.Y.Z` (no slashes, no
 *      protocol injection, no `..`).
 *   4. The GitHub owner/repo allowlist is regex-validated; the default
 *      points at `CaspianTools/script-caspian-store`. Forks may override but
 *      cannot inject special characters. `CASPIAN_CONSUMER_REPO` is
 *      validated against the same `owner/repo` pattern before it ever
 *      reaches a URL.
 *   5. npm-install mode runs with `--ignore-scripts` so a compromised
 *      tarball cannot run a postinstall hook. We also rate-limit to 1
 *      install per 10 minutes per process.
 *
 * Stderr returned to the caller is redacted of patterns that look like
 * environment-variable references, since npm errors sometimes include
 * tokens like `$GITHUB_TOKEN` in the message. The CASPIAN_GITHUB_TOKEN
 * value itself is never logged, captured, or returned — it leaves the
 * process only as the `Authorization` header on outbound api.github.com
 * requests.
 *
 * This module is server-only (uses `node:child_process`, `firebase-admin`,
 * `process.exit`). Don't import from client/storefront code.
 */

import { spawn } from 'node:child_process';

const ALLOWED_OWNER = 'CaspianTools';
const ALLOWED_REPO = 'script-caspian-store';
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
// GitHub's documented owner/repo character class — alphanumerics, dot,
// hyphen, underscore. We use this to validate consumer-provided overrides
// so a fork can self-update against its own GitHub repo without opening a
// shell-injection or path-traversal hole.
const GITHUB_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const CONSUMER_REPO_RE = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
let lastInvocationAt = 0;

export interface CaspianHandleSelfUpdateOptions {
  /**
   * Override the GitHub owner/repo the route is allowed to install from.
   * Defaults to `CaspianTools/script-caspian-store`. Useful for forks
   * that ship their own derivative library — set this and consumers can
   * self-update against your fork rather than upstream. Both fields must
   * match `[A-Za-z0-9._-]{1,100}` or the request is rejected with a 400.
   */
  allowedOwner?: string;
  allowedRepo?: string;
}

/**
 * Resolve the Firebase project ID from environment variables, in priority
 * order. firebase-admin's `applicationDefault()` only auto-detects from
 * `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT`, not from the consumer's
 * `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — so we read both and pass the result
 * explicitly to `initializeApp({ projectId })`.
 */
function resolveProjectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.CASPIAN_FIREBASE_PROJECT_ID ||
    undefined
  );
}

async function ensureAdminApp(projectId: string): Promise<void> {
  // Lazy import so this module can be statically analyzed without
  // firebase-admin in the dep tree. Consumers MUST have firebase-admin
  // installed (the scaffold pins it).
  const { getApps, initializeApp, applicationDefault } = await import(
    'firebase-admin/app'
  );
  if (getApps().length > 0) return;
  // Setting GOOGLE_CLOUD_PROJECT here is belt-and-suspenders: some internals
  // of firebase-admin re-read process.env even after init. Idempotent.
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  try {
    initializeApp({ credential: applicationDefault(), projectId });
  } catch {
    initializeApp({ projectId });
  }
}

interface AuthOk {
  ok: true;
}
interface AuthFail {
  ok: false;
  status: number;
  error: string;
}

async function requireAdmin(req: Request): Promise<AuthOk | AuthFail> {
  const projectId = resolveProjectId();
  if (!projectId) {
    return {
      ok: false,
      status: 500,
      error:
        'Unable to detect a Project Id in the current environment. To learn more about authentication and Google APIs, visit: https://cloud.google.com/docs/authentication/getting-started',
    };
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) {
    return { ok: false, status: 401, error: 'Missing Authorization header' };
  }
  try {
    await ensureAdminApp(projectId);
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(idToken);
    const userDocUrl =
      `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default)/documents/users/${decoded.uid}`;
    const userRes = await fetch(userDocUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!userRes.ok) {
      return { ok: false, status: 403, error: 'Caller is not an admin' };
    }
    const userBody = (await userRes.json()) as {
      fields?: { role?: { stringValue?: string } };
    };
    if (userBody.fields?.role?.stringValue !== 'admin') {
      return { ok: false, status: 403, error: 'Caller is not an admin' };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: 401,
      error: err instanceof Error ? err.message : 'Token verification failed',
    };
  }
}

/**
 * Redact patterns that look like env-var references from a captured stream
 * before returning it in an HTTP response. Examples redacted: `$FOO`,
 * `${BAR}`, `$BAZ_QUX`. npm errors occasionally echo unset tokens; this
 * stops the route from acting as an env-var oracle.
 */
function redactEnvRefs(s: string): string {
  return s.replace(/\$\{?[A-Z_][A-Z0-9_]*\}?/g, '[REDACTED_ENV_REF]');
}

// ---------------------------------------------------------------------------
// GitHub-commit mode helpers
// ---------------------------------------------------------------------------

interface GhFile {
  contentUtf8: string;
  sha: string;
}

async function ghApi(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'caspian-self-update',
  };
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init?.headers as Record<string, string> | undefined) },
  });
}

async function ghReadFile(
  repo: string,
  branch: string,
  path: string,
  token: string,
): Promise<GhFile | null> {
  const res = await ghApi(
    `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    token,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} fetching ${path}`);
  }
  const data = (await res.json()) as { content: string; sha: string; encoding: string };
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding "${data.encoding}" for ${path}`);
  }
  return {
    contentUtf8: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}

async function ghResolveTagCommit(
  repo: string,
  tag: string,
  token: string,
): Promise<string> {
  const res = await ghApi(
    `/repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,
    token,
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} resolving tag ${tag} on ${repo}`);
  }
  const data = (await res.json()) as { object: { sha: string; type: string } };
  if (data.object.type === 'commit') return data.object.sha;
  // Annotated tag — the ref points at a tag object that itself points at
  // a commit. Dereference one more level.
  const tagRes = await ghApi(`/repos/${repo}/git/tags/${data.object.sha}`, token);
  if (!tagRes.ok) {
    throw new Error(`GitHub API ${tagRes.status} dereferencing annotated tag`);
  }
  const tagObj = (await tagRes.json()) as { object: { sha: string } };
  return tagObj.object.sha;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Find which package.json dep key currently points at
 * `github:<owner>/<repo>#…` (in either `dependencies` or `devDependencies`).
 * Returns the key + which dep section it lives in. Returns null if no match.
 */
function findScriptDepKey(
  pkg: PackageJson,
  owner: string,
  repo: string,
): { key: string; section: 'dependencies' | 'devDependencies' } | null {
  const prefix = `github:${owner}/${repo}#`;
  const prefixLower = prefix.toLowerCase();
  for (const section of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[section];
    if (!deps) continue;
    for (const [key, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string') continue;
      if (spec.toLowerCase().startsWith(prefixLower)) {
        return { key, section };
      }
    }
  }
  return null;
}

/**
 * Best-effort update of a v3 npm lockfile: bump the version + resolved sha
 * for any entry whose `resolved` URL points at the consumer's chosen
 * `<owner>/<repo>`, and bump the top-level `packages[""]` dep spec to the
 * new tag. Does not attempt to reconcile transitive deps that may have
 * changed between versions — if the new release ships a different dep
 * tree, the host's `npm ci` step may fail with "lock file out of sync",
 * and the consumer falls back to a manual `npm install` locally.
 */
function updateLockfile(
  lock: Record<string, unknown>,
  depKey: string,
  scriptOwner: string,
  scriptRepo: string,
  newVersion: string,
  newCommitSha: string,
  newSpec: string,
): boolean {
  let touched = false;
  const ownerLower = scriptOwner.toLowerCase();
  const repoLower = scriptRepo.toLowerCase();

  const packages = lock.packages as Record<string, Record<string, unknown>> | undefined;
  if (packages && typeof packages === 'object') {
    // Root entry — update the dep spec used by `npm install`.
    const root = packages[''];
    if (root && typeof root === 'object') {
      for (const section of ['dependencies', 'devDependencies'] as const) {
        const deps = root[section] as Record<string, string> | undefined;
        if (deps && typeof deps[depKey] === 'string') {
          deps[depKey] = newSpec;
          touched = true;
        }
      }
    }
    // Per-package entries — update version + resolved sha for anything
    // that resolves into the script repo. There's usually exactly one
    // entry under `node_modules/<depKey>`, but match by URL substring
    // too in case the consumer pinned via an alias.
    for (const [, entry] of Object.entries(packages)) {
      if (!entry || typeof entry !== 'object') continue;
      const resolved = entry.resolved;
      if (typeof resolved !== 'string') continue;
      const r = resolved.toLowerCase();
      if (r.includes(`${ownerLower}/${repoLower}`)) {
        entry.version = newVersion;
        entry.resolved = `git+ssh://git@github.com/${scriptOwner}/${scriptRepo}.git#${newCommitSha}`;
        touched = true;
      }
    }
  }

  // npm v6 lockfile shape ("dependencies" at root). Best-effort.
  const legacy = lock.dependencies as Record<string, Record<string, unknown>> | undefined;
  if (legacy && typeof legacy === 'object') {
    const entry = legacy[depKey];
    if (entry && typeof entry === 'object') {
      entry.version = newVersion;
      if (typeof entry.resolved === 'string') {
        entry.resolved = `git+ssh://git@github.com/${scriptOwner}/${scriptRepo}.git#${newCommitSha}`;
      }
      touched = true;
    }
  }

  return touched;
}

interface GhCommitOutcome {
  ok: true;
  commitSha: string;
  commitUrl: string;
  lockfileUpdated: boolean;
}

async function ghCreateCommit(
  consumerRepo: string,
  branch: string,
  baseCommitSha: string,
  baseTreeSha: string,
  treeEntries: Array<{ path: string; content: string }>,
  message: string,
  token: string,
): Promise<GhCommitOutcome> {
  // 1. Create one blob per file.
  const blobShas: Array<{ path: string; sha: string }> = [];
  for (const entry of treeEntries) {
    const res = await ghApi(`/repos/${consumerRepo}/git/blobs`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: entry.content, encoding: 'utf-8' }),
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} creating blob for ${entry.path}`);
    }
    const data = (await res.json()) as { sha: string };
    blobShas.push({ path: entry.path, sha: data.sha });
  }

  // 2. Create a tree based on the current branch tree, overlaying our blobs.
  const treeRes = await ghApi(`/repos/${consumerRepo}/git/trees`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobShas.map((b) => ({
        path: b.path,
        mode: '100644',
        type: 'blob',
        sha: b.sha,
      })),
    }),
  });
  if (!treeRes.ok) throw new Error(`GitHub API ${treeRes.status} creating tree`);
  const tree = (await treeRes.json()) as { sha: string };

  // 3. Create the commit object.
  const commitRes = await ghApi(`/repos/${consumerRepo}/git/commits`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  });
  if (!commitRes.ok) throw new Error(`GitHub API ${commitRes.status} creating commit`);
  const commit = (await commitRes.json()) as { sha: string; html_url: string };

  // 4. Fast-forward the branch ref.
  const refRes = await ghApi(
    `/repos/${consumerRepo}/git/refs/heads/${encodeURIComponent(branch)}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha }),
    },
  );
  if (!refRes.ok) {
    throw new Error(
      `GitHub API ${refRes.status} fast-forwarding branch ${branch}`,
    );
  }

  return {
    ok: true,
    commitSha: commit.sha,
    commitUrl: commit.html_url,
    lockfileUpdated: blobShas.some((b) => b.path === 'package-lock.json'),
  };
}

/**
 * Attempt the GitHub-commit update path. Returns `null` if the env isn't
 * configured for this mode (caller should fall through to npm-install). On
 * any failure during the commit pipeline, returns a JSON error Response —
 * the caller surfaces that to the admin and does NOT fall back to npm,
 * because partial state is worse than a clear "didn't try" outcome.
 */
async function tryGithubCommitMode(
  version: string,
  scriptOwner: string,
  scriptRepo: string,
): Promise<Response | null> {
  const token = process.env.CASPIAN_GITHUB_TOKEN;
  if (!token) return null;

  const consumerRepo = process.env.CASPIAN_CONSUMER_REPO ?? '';
  const branch = process.env.CASPIAN_CONSUMER_BRANCH || 'main';

  if (!CONSUMER_REPO_RE.test(consumerRepo)) {
    return jsonResponse(
      {
        ok: false,
        error:
          'CASPIAN_GITHUB_TOKEN is set but CASPIAN_CONSUMER_REPO is missing or invalid. Set CASPIAN_CONSUMER_REPO=<owner>/<repo> (your storefront repo) to enable GitHub-commit mode.',
      },
      500,
    );
  }
  if (!GITHUB_NAME_RE.test(branch)) {
    return jsonResponse(
      {
        ok: false,
        error: 'CASPIAN_CONSUMER_BRANCH contains invalid characters.',
      },
      500,
    );
  }

  try {
    // 1. Fetch consumer's package.json.
    const pkgFile = await ghReadFile(consumerRepo, branch, 'package.json', token);
    if (!pkgFile) {
      return jsonResponse(
        {
          ok: false,
          error: `Could not find package.json on ${consumerRepo}@${branch}.`,
        },
        500,
      );
    }

    let pkg: PackageJson;
    try {
      pkg = JSON.parse(pkgFile.contentUtf8) as PackageJson;
    } catch (err) {
      return jsonResponse(
        {
          ok: false,
          error: `package.json on ${consumerRepo}@${branch} is not valid JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
        500,
      );
    }

    const found = findScriptDepKey(pkg, scriptOwner, scriptRepo);
    if (!found) {
      return jsonResponse(
        {
          ok: false,
          error: `No dependency referencing github:${scriptOwner}/${scriptRepo}# in package.json on ${consumerRepo}@${branch}. Check that the storefront repo's package.json pins the script via a github: spec.`,
        },
        500,
      );
    }

    const newSpec = `github:${scriptOwner}/${scriptRepo}#v${version}`;
    const currentSpec = pkg[found.section]?.[found.key];
    if (currentSpec === newSpec) {
      return jsonResponse(
        {
          ok: false,
          error: `${consumerRepo}@${branch} already pins ${found.key} to v${version}. No commit needed — your host should already be on this version, or a deploy is in progress.`,
        },
        409,
      );
    }
    // Mutate in place. Object.assign keeps key order stable for the
    // serializer below.
    pkg[found.section]![found.key] = newSpec;
    const newPkgContent = JSON.stringify(pkg, null, 2) + '\n';

    // 2. Best-effort lockfile update.
    const lockFile = await ghReadFile(
      consumerRepo,
      branch,
      'package-lock.json',
      token,
    );
    let newLockContent: string | null = null;
    let lockfileSha: string | null = null;
    if (lockFile) {
      let lock: Record<string, unknown>;
      try {
        lock = JSON.parse(lockFile.contentUtf8) as Record<string, unknown>;
      } catch {
        // Malformed lockfile — skip it, let the build regenerate.
        lock = {};
      }
      const commitSha = await ghResolveTagCommit(
        `${scriptOwner}/${scriptRepo}`,
        `v${version}`,
        token,
      );
      const touched = updateLockfile(
        lock,
        found.key,
        scriptOwner,
        scriptRepo,
        version,
        commitSha,
        newSpec,
      );
      if (touched) {
        newLockContent = JSON.stringify(lock, null, 2) + '\n';
        lockfileSha = lockFile.sha;
      }
    }

    // 3. Get the current branch HEAD + base tree.
    const refRes = await ghApi(
      `/repos/${consumerRepo}/git/ref/heads/${encodeURIComponent(branch)}`,
      token,
    );
    if (!refRes.ok) {
      return jsonResponse(
        {
          ok: false,
          error: `GitHub API ${refRes.status} reading branch ${branch} on ${consumerRepo}. Check CASPIAN_GITHUB_TOKEN scope (needs Contents: read & write on this repo).`,
        },
        502,
      );
    }
    const ref = (await refRes.json()) as { object: { sha: string } };
    const baseCommitSha = ref.object.sha;

    const baseCommitRes = await ghApi(
      `/repos/${consumerRepo}/git/commits/${baseCommitSha}`,
      token,
    );
    if (!baseCommitRes.ok) {
      throw new Error(
        `GitHub API ${baseCommitRes.status} fetching base commit ${baseCommitSha}`,
      );
    }
    const baseCommit = (await baseCommitRes.json()) as { tree: { sha: string } };
    const baseTreeSha = baseCommit.tree.sha;

    // 4. Build the file list + commit.
    const treeEntries: Array<{ path: string; content: string }> = [
      { path: 'package.json', content: newPkgContent },
    ];
    if (newLockContent) {
      treeEntries.push({ path: 'package-lock.json', content: newLockContent });
    }

    const commitMessage =
      `Bump ${found.key} to v${version}\n\n` +
      `Pushed by /admin/about self-update.\n` +
      (newLockContent
        ? `package.json + package-lock.json updated.`
        : `package.json only (no package-lock.json on this branch; npm install will regenerate it on build).`);

    const outcome = await ghCreateCommit(
      consumerRepo,
      branch,
      baseCommitSha,
      baseTreeSha,
      treeEntries,
      commitMessage,
      token,
    );

    // Suppress the unused-var warning — lockfileSha is captured above as a
    // signal that we found the lockfile, but ghCreateCommit creates new
    // blobs (the API doesn't need the previous file SHA for tree-based
    // commits, only for the contents-API single-file PUT we deliberately
    // avoid).
    void lockfileSha;

    return jsonResponse(
      {
        ok: true,
        mode: 'github-commit',
        commitSha: outcome.commitSha,
        commitUrl: outcome.commitUrl,
        lockfileUpdated: outcome.lockfileUpdated,
        message:
          `Pushed commit ${outcome.commitSha.slice(0, 7)} to ${consumerRepo}@${branch}. ` +
          `Your host (Firebase App Hosting / Vercel / etc.) will detect the push and ` +
          `redeploy automatically in 3-5 minutes. Refresh this page after that to see ` +
          `the new version.`,
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `GitHub-commit mode failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      502,
    );
  }
}

/**
 * The whole route. Mount from a Next.js App Router route handler:
 *
 * ```ts
 * // src/app/api/caspian-store/update/route.ts
 * import { caspianHandleSelfUpdate } from '@caspian-explorer/script-caspian-store/server';
 * export const runtime = 'nodejs';
 * export const dynamic = 'force-dynamic';
 * export const maxDuration = 300;
 * export async function POST(req: Request) {
 *   return caspianHandleSelfUpdate(req);
 * }
 * ```
 *
 * Requires `CASPIAN_ALLOW_SELF_UPDATE=true` on the server — opt-in in all
 * environments, not just production. Without it, every POST is a 403.
 *
 * If `CASPIAN_GITHUB_TOKEN` + `CASPIAN_CONSUMER_REPO` are also set, the
 * route uses GitHub-commit mode (push a package.json bump and let the
 * host rebuild). Otherwise it falls back to the original npm-install
 * mode (spawn `npm install <spec>` + `process.exit(0)`). Pick the mode
 * via your host's env config — there's no per-request flag.
 */
export async function caspianHandleSelfUpdate(
  req: Request,
  opts: CaspianHandleSelfUpdateOptions = {},
): Promise<Response> {
  if (process.env.CASPIAN_ALLOW_SELF_UPDATE !== 'true') {
    return jsonResponse(
      {
        ok: false,
        error:
          'Self-update is disabled. Set CASPIAN_ALLOW_SELF_UPDATE=true on the server to enable.',
      },
      403,
    );
  }

  // Per-process rate limit: at most one install per 10 minutes. Serverless
  // platforms (Vercel, Firebase App Hosting) may run multiple warm instances
  // concurrently — each gets its own counter. That's acceptable for an
  // admin operation; the alternative (Firestore-backed counter) adds
  // round-trip latency to every request and a new failure mode if Firestore
  // is unavailable.
  const now = Date.now();
  if (now - lastInvocationAt < RATE_LIMIT_WINDOW_MS) {
    const retryInSec = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - lastInvocationAt)) / 1000,
    );
    return jsonResponse(
      {
        ok: false,
        error: `Self-update rate limited. Try again in ${retryInSec}s.`,
      },
      429,
    );
  }

  const allowedOwner = opts.allowedOwner ?? ALLOWED_OWNER;
  const allowedRepo = opts.allowedRepo ?? ALLOWED_REPO;
  if (!GITHUB_NAME_RE.test(allowedOwner) || !GITHUB_NAME_RE.test(allowedRepo)) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Invalid allowedOwner/allowedRepo override — must match GitHub naming rules.',
      },
      400,
    );
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status);
  }

  const body = (await req.json().catch(() => null)) as {
    version?: unknown;
  } | null;
  const version = typeof body?.version === 'string' ? body.version : '';
  if (!VERSION_RE.test(version)) {
    return jsonResponse(
      { ok: false, error: 'Invalid version. Expected X.Y.Z.' },
      400,
    );
  }

  // Claim the rate-limit slot before doing any real work. If something
  // crashes mid-flight we still want to block another caller from
  // immediately retrying — they'd likely hit the same failure.
  lastInvocationAt = now;

  // Prefer GitHub-commit mode when the env says it's configured. The
  // helper returns null if it should pass through to npm-install mode,
  // or a Response (success OR failure) if it actually attempted the
  // commit path. We don't fall back to npm on commit-mode errors — a
  // partial commit is worse than a clear "couldn't do it" outcome, and
  // npm-install on serverless hosts is almost certainly going to fail
  // for a different reason (missing git, EROFS) anyway.
  const ghOutcome = await tryGithubCommitMode(version, allowedOwner, allowedRepo);
  if (ghOutcome) return ghOutcome;

  const spec = `github:${allowedOwner}/${allowedRepo}#v${version}`;
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  let stdout = '';
  let stderr = '';
  const exitCode: number | null = await new Promise((resolve) => {
    // `--ignore-scripts` blocks any pre/post/install scripts in the fetched
    // tarball or its transitive deps from running. Without it, a
    // compromised dep could execute arbitrary code under the server's
    // process identity. Our own package has no install scripts that need
    // to run on consumer sites, so this is safe.
    // `shell: true` on Windows is required since CVE-2024-27980 (Node 18.20.2 /
    // 20.12.2 / 21.7.3 / 22): spawning `.cmd` / `.bat` files with `shell: false`
    // throws `EINVAL` synchronously, escaping this Promise and producing an
    // HTML 500 instead of a JSON error. Safe here because every component of
    // `spec` is regex-validated above (VERSION_RE, GITHUB_NAME_RE) — no shell
    // metacharacters can reach the shell. POSIX still uses `shell: false` so
    // production Linux hosts behave bit-for-bit as before.
    const child = spawn(
      npmCmd,
      ['install', spec, '--ignore-scripts', '--no-audit', '--no-fund'],
      {
        cwd: process.cwd(),
        env: process.env,
        shell: process.platform === 'win32',
      },
    );
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (err) => {
      stderr += '\n' + (err instanceof Error ? err.message : String(err));
      resolve(-1);
    });
    child.on('close', (code) => resolve(code));
  });

  if (exitCode !== 0) {
    return jsonResponse(
      {
        ok: false,
        mode: 'npm-install',
        error: `npm install exited with code ${exitCode}`,
        stdout: redactEnvRefs(stdout),
        stderr: redactEnvRefs(stderr),
      },
      500,
    );
  }

  // Schedule a restart so the new code is picked up. In dev, Next respawns
  // on file change; in production, rely on the host's process supervisor
  // (PM2 / systemd / Docker / Firebase App Hosting / Vercel) to restart
  // when the Node process exits.
  setTimeout(() => {
    try {
      process.exit(0);
    } catch {
      /* no-op */
    }
  }, 500);

  return jsonResponse(
    {
      ok: true,
      mode: 'npm-install',
      stdout: redactEnvRefs(stdout),
      stderr: redactEnvRefs(stderr),
      restarting: true,
    },
    200,
  );
}

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
