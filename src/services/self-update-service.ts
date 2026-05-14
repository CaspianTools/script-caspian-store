import type { User } from 'firebase/auth';

export interface SelfUpdateResult {
  ok: boolean;
  /**
   * Which path the server took:
   * - `npm-install` — spawned `npm install <spec>` against the running
   *   process's CWD and queued a `process.exit(0)` restart. The original
   *   v7 behaviour; only works on hosts with `git`, writable `node_modules`,
   *   and a process supervisor (VPS, Docker, local dev).
   * - `github-commit` — pushed a `package.json` bump to the consumer's
   *   GitHub branch via the REST API. The host (App Hosting, Vercel, …)
   *   detects the push and redeploys. Only works when
   *   `CASPIAN_GITHUB_TOKEN` + `CASPIAN_CONSUMER_REPO` are set on the
   *   server.
   *
   * May be missing on older server versions (< 8.22.0) that didn't tag
   * their response — treat as `npm-install` in that case.
   */
  mode?: 'npm-install' | 'github-commit';
  /** Set on `npm-install` mode. Captured stdout from the spawn. */
  stdout?: string;
  /** Set on `npm-install` mode. Captured stderr from the spawn. */
  stderr?: string;
  error?: string;
  /** Set on `npm-install` mode when the host's supervisor will restart Node. */
  restarting?: boolean;
  /** Set on `github-commit` mode. SHA of the pushed commit. */
  commitSha?: string;
  /** Set on `github-commit` mode. github.com URL for the commit. */
  commitUrl?: string;
  /** Set on `github-commit` mode. True if package-lock.json was rewritten too. */
  lockfileUpdated?: boolean;
  /**
   * Human-readable summary the server suggests displaying. Currently used
   * by `github-commit` mode to explain the "wait 3-5 min for redeploy"
   * step; npm-install mode doesn't populate it (the toast hardcodes the
   * restart prompt).
   */
  message?: string;
  /** HTTP status from the endpoint; 0 when the request never reached the server. */
  status: number;
}

/**
 * POST to a companion Next.js API route (default `/api/caspian-store/update`)
 * that runs `npm install github:<owner>/<repo>#v<version>` on the host.
 *
 * The library ships the **client** side; the scaffolder emits the server route.
 * Consumers on non-scaffolded setups (Vite, CRA, custom Next layouts) are
 * expected to mount a compatible POST endpoint at the same path or override
 * via the `endpoint` option.
 *
 * Auth: sends the current Firebase ID token as `Authorization: Bearer …`. The
 * server must verify the token resolves to a user with the `admin` custom
 * claim before shelling out.
 */
export async function triggerSelfUpdate(
  user: User,
  version: string,
  options: { endpoint?: string; signal?: AbortSignal } = {},
): Promise<SelfUpdateResult> {
  const endpoint = options.endpoint ?? '/api/caspian-store/update';
  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to get auth token',
      status: 0,
    };
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ version }),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Network error — is the /api/caspian-store/update route mounted?',
      status: 0,
    };
  }

  let payload: Partial<SelfUpdateResult> = {};
  try {
    payload = (await res.json()) as Partial<SelfUpdateResult>;
  } catch {
    return {
      ok: false,
      error: `Unexpected non-JSON response (HTTP ${res.status})`,
      status: res.status,
    };
  }

  return {
    ok: Boolean(payload.ok) && res.ok,
    mode: payload.mode,
    stdout: payload.stdout,
    stderr: payload.stderr,
    error: payload.error,
    restarting: payload.restarting,
    commitSha: payload.commitSha,
    commitUrl: payload.commitUrl,
    lockfileUpdated: payload.lockfileUpdated,
    message: payload.message,
    status: res.status,
  };
}
