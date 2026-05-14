'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { CASPIAN_STORE_VERSION } from '../version';
import {
  DEFAULT_REPO_NAME,
  DEFAULT_REPO_OWNER,
  fetchRecentReleases,
  isUpdateAvailable,
  type GithubRelease,
} from '../services/github-updates-service';
import {
  triggerSelfUpdate,
  type SelfUpdateResult,
} from '../services/self-update-service';
import {
  listRecentErrors,
  dismissError,
  buildUpstreamIssueUrl,
} from '../services/error-log-service';
import type { ErrorLog } from '../types';
import { useToast } from '../ui/toast';
import { Button } from '../ui/button';
import { ExternalLinkIcon, RefreshIcon, TrashIcon } from '../ui/icons';
import { Badge, Separator, Skeleton } from '../ui/misc';

export interface AdminAboutPageProps {
  owner?: string;
  repo?: string;
  maxReleases?: number;
  /**
   * Override the companion update endpoint. Default `/api/caspian-store/update`.
   * Set to `null` to hide the in-app Update button entirely (only the copy-command
   * fallback will show).
   */
  updateEndpoint?: string | null;
  className?: string;
}

export function AdminAboutPage({
  owner = DEFAULT_REPO_OWNER,
  repo = DEFAULT_REPO_NAME,
  maxReleases = 5,
  updateEndpoint = '/api/caspian-store/update',
  className,
}: AdminAboutPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [releases, setReleases] = useState<GithubRelease[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<SelfUpdateResult | null>(null);

  async function load(force: boolean) {
    setError(null);
    if (force) setReloading(true);
    try {
      const data = await fetchRecentReleases(owner, repo, maxReleases, { force });
      setReleases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch releases');
    } finally {
      setReloading(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, [owner, repo, maxReleases]);

  const latest = releases?.[0];
  const behind =
    latest && latest.version ? isUpdateAvailable(CASPIAN_STORE_VERSION, latest.version) : false;

  async function handleUpdate() {
    if (!latest?.version || !user) return;
    setUpdating(true);
    setUpdateResult(null);
    try {
      const result = await triggerSelfUpdate(user, latest.version, {
        endpoint: updateEndpoint ?? undefined,
      });
      setUpdateResult(result);
      if (result.ok) {
        if (result.mode === 'github-commit') {
          toast({
            title: `Update queued for v${latest.version}`,
            description:
              'Pushed a package.json bump to GitHub. Your host should redeploy in 3–5 minutes.',
          });
        } else {
          toast({
            title: `Updated to v${latest.version}`,
            description: result.restarting
              ? 'Server is restarting — refresh in a few seconds.'
              : 'Restart your server for changes to take effect.',
          });
        }
      } else {
        toast({
          title: 'Update failed',
          description: result.error ?? `HTTP ${result.status}`,
          variant: 'destructive',
        });
      }
    } finally {
      setUpdating(false);
    }
  }

  function copyInstallCommand() {
    if (!latest?.version) return;
    const cmd = `npm install github:${owner}/${repo}#v${latest.version}`;
    void navigator.clipboard.writeText(cmd).then(
      () => toast({ title: 'Command copied', description: cmd }),
      () => toast({ title: 'Copy failed', variant: 'destructive' }),
    );
  }

  return (
    <div className={className}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>About</h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        Library version and recent news from {owner}/{repo}.
      </p>

      <section
        style={{
          marginTop: 24,
          padding: 20,
          border: '1px solid #eee',
          borderRadius: 'var(--caspian-radius, 8px)',
          background: '#fff',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <VersionBlock label="Installed" value={`v${CASPIAN_STORE_VERSION}`} />
          <VersionBlock
            label="Latest on GitHub"
            value={latest ? latest.tagName || `v${latest.version}` : undefined}
            loading={!releases && !error}
            fallback={error ? 'Unavailable' : undefined}
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {error ? (
              <Badge variant="destructive">Offline</Badge>
            ) : !releases ? (
              <Skeleton style={{ width: 100, height: 20 }} />
            ) : behind ? (
              <Badge>Update available</Badge>
            ) : (
              <Badge variant="secondary">Up to date</Badge>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {behind && latest?.version && (
            <>
              {updateEndpoint && user && (
                <Button size="sm" onClick={handleUpdate} loading={updating}>
                  {updating ? 'Installing…' : `Update to v${latest.version}`}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={copyInstallCommand}>
                Copy install command
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => void load(true)} loading={reloading}>
            <RefreshIcon size={14} /> Refresh
          </Button>
        </div>
      </section>

      {error && (
        <p style={{ marginTop: 12, color: '#991b1b', fontSize: 13 }}>
          Couldn&apos;t reach GitHub: {error}
        </p>
      )}

      {updateResult && <UpdateResultPanel result={updateResult} />}

      <Separator />

      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '8px 0 12px' }}>Recent releases</h2>

      {!releases && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: Math.min(maxReleases, 4) }).map((_, i) => (
            <Skeleton key={i} style={{ height: 56 }} />
          ))}
        </div>
      )}

      {releases && releases.length === 0 && !error && (
        <p style={{ color: '#666', fontSize: 13 }}>No releases yet.</p>
      )}

      {releases && releases.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {releases.map((r) => (
            <ReleaseRow key={r.tagName || r.htmlUrl} release={r} />
          ))}
        </ul>
      )}

      <Separator />

      <ErrorsSection owner={owner} repo={repo} />

      <Separator />

      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 13,
          color: '#444',
        }}
      >
        <ExternalLink href={`https://github.com/${owner}/${repo}`}>Repository</ExternalLink>
        <ExternalLink href={`https://github.com/${owner}/${repo}/blob/main/CHANGELOG.md`}>
          CHANGELOG.md
        </ExternalLink>
        <ExternalLink href={`https://github.com/${owner}/${repo}/discussions/categories/announcements`}>
          Announcements
        </ExternalLink>
      </div>
    </div>
  );
}

/**
 * Errors-on-this-installation panel (mod1182). Reads the most recent
 * entries from `errorLogs` and lets the admin dismiss each one or open a
 * pre-filled GitHub issue against the upstream repo.
 */
function ErrorsSection({ owner, repo }: { owner: string; repo: string }) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const { toast } = useToast();
  const [errors, setErrors] = useState<ErrorLog[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const list = await listRecentErrors(db, 25);
      setErrors(list);
    } catch {
      // Non-admin viewers hit this path; rules deny the read.
      setErrors([]);
      setLoadFailed(true);
    }
  }, [db]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDismiss(id: string) {
    setBusyId(id);
    try {
      await dismissError(db, id);
      setErrors((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    } catch {
      toast({ title: t('admin.about.errors.dismissFailed'), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  function handleReport(entry: ErrorLog) {
    const url = buildUpstreamIssueUrl(entry, { owner, repo });
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section style={{ margin: '16px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('admin.about.errors.title')}</h2>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshIcon size={14} /> {t('admin.about.errors.refresh')}
        </Button>
      </div>
      <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
        {t('admin.about.errors.description')}
      </p>

      {errors === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 56 }} />
          ))}
        </div>
      ) : errors.length === 0 ? (
        <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
          {loadFailed ? t('admin.about.errors.loadFailed') : t('admin.about.errors.empty')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {errors.map((e) => (
            <ErrorRow
              key={e.id}
              entry={e}
              busy={busyId === e.id}
              onDismiss={() => void handleDismiss(e.id)}
              onReport={() => handleReport(e)}
              t={t}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ErrorRow({
  entry,
  busy,
  onDismiss,
  onReport,
  t,
}: {
  entry: ErrorLog;
  busy: boolean;
  onDismiss: () => void;
  onReport: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li
      style={{
        padding: '12px 14px',
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Badge variant="outline">{entry.source}</Badge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={entry.origin}
          >
            {entry.origin}
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#444',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={entry.message}
          >
            {entry.message}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {formatDate(entry.timestamp?.toDate?.().toISOString?.() ?? '')}
            {entry.seenCount > 1 && (
              <>
                {' · '}
                <Badge variant="secondary">×{entry.seenCount}</Badge>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('admin.about.errors.hideDetails') : t('admin.about.errors.showDetails')}
          </Button>
          <Button variant="outline" size="sm" onClick={onReport}>
            <ExternalLinkIcon size={14} /> {t('admin.about.errors.reportUpstream')}
          </Button>
          <Button variant="outline" size="sm" onClick={onDismiss} loading={busy}>
            <TrashIcon size={14} /> {t('admin.about.errors.dismiss')}
          </Button>
        </div>
      </div>
      {expanded && entry.stack && (
        <pre
          style={{
            margin: '10px 0 0',
            padding: 10,
            maxHeight: 220,
            overflow: 'auto',
            background: '#f8fafc',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {entry.stack}
        </pre>
      )}
    </li>
  );
}

function UpdateResultPanel({ result }: { result: SelfUpdateResult }) {
  const borderColor = result.ok ? '#16a34a' : '#dc2626';
  const bg = result.ok ? '#f0fdf4' : '#fef2f2';
  const title = result.ok
    ? result.mode === 'github-commit'
      ? 'Commit pushed — host will redeploy'
      : result.restarting
        ? 'Installed — server restarting'
        : 'Installed — restart your server'
    : 'Update failed';
  const log = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  const isProjectIdError =
    !result.ok && !!result.error && /Unable to detect a Project Id/i.test(result.error);
  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--caspian-radius, 8px)',
        background: bg,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
      {result.ok && result.mode === 'github-commit' && (
        <GithubCommitDetails
          message={result.message}
          commitSha={result.commitSha}
          commitUrl={result.commitUrl}
          lockfileUpdated={result.lockfileUpdated}
        />
      )}
      {result.error && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#991b1b' }}>{result.error}</p>
      )}
      {isProjectIdError && <ProjectIdRemediation />}
      {log && (
        <pre
          style={{
            margin: '8px 0 0',
            padding: 10,
            maxHeight: 200,
            overflow: 'auto',
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {log}
        </pre>
      )}
    </div>
  );
}

function GithubCommitDetails({
  message,
  commitSha,
  commitUrl,
  lockfileUpdated,
}: {
  message?: string;
  commitSha?: string;
  commitUrl?: string;
  lockfileUpdated?: boolean;
}) {
  return (
    <div style={{ marginTop: 6 }}>
      {message && (
        <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>{message}</p>
      )}
      {commitSha && (
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>
          Commit{' '}
          {commitUrl ? (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#166534', textDecoration: 'underline' }}
            >
              {commitSha.slice(0, 7)}
            </a>
          ) : (
            <code>{commitSha.slice(0, 7)}</code>
          )}
          {' '}— {lockfileUpdated ? 'package.json + package-lock.json' : 'package.json only'}
        </p>
      )}
    </div>
  );
}

function ProjectIdRemediation() {
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 6,
        fontSize: 13,
        lineHeight: 1.5,
        color: '#1f2937',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>How to fix</div>
      <p style={{ margin: '0 0 6px' }}>
        Your hosting environment is missing the Firebase project ID. The self-update API
        route can&apos;t verify your admin token without it.
      </p>
      <p style={{ margin: '0 0 4px' }}>
        Add either of these environment variables on your host and redeploy. Both are read
        by the route — pick whichever fits your env-management workflow.
      </p>
      <pre
        style={{
          margin: '0 0 4px',
          padding: 8,
          background: '#f3f4f6',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        GOOGLE_CLOUD_PROJECT=&lt;your-firebase-project-id&gt;
      </pre>
      <pre
        style={{
          margin: '0 0 8px',
          padding: 8,
          background: '#f3f4f6',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=&lt;your-firebase-project-id&gt;
      </pre>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>
        <strong>If you scaffolded before v7.4.0 and even setting these doesn&apos;t help</strong>
        , your <code>src/app/api/caspian-store/update/route.ts</code> is the old in-lined
        version that doesn&apos;t read <code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code>. Replace
        its contents with this 8-line shim — future fixes to the route will then land
        automatically via <code>npm install</code>:
      </p>
      <pre
        style={{
          margin: '0 0 10px',
          padding: 8,
          background: '#f3f4f6',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {`import { caspianHandleSelfUpdate } from '@caspian-explorer/script-caspian-store/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  return caspianHandleSelfUpdate(req);
}`}
      </pre>
      <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
        <li>
          <strong>Local development (Next.js)</strong>: add the line to{' '}
          <code>.env.local</code> at your project root, then fully stop and restart{' '}
          <code>next dev</code> (Ctrl+C, then <code>npm run dev</code>) — Next reads{' '}
          <code>.env.local</code> only at server startup.
        </li>
        <li>
          <strong>Vercel</strong>: Project Settings → Environment Variables → add for
          Production + Preview, then redeploy.
        </li>
        <li>
          <strong>Firebase App Hosting</strong>: add to <code>apphosting.yaml</code> under{' '}
          <code>env:</code> with <code>availability: [BUILD, RUNTIME]</code>, then redeploy.
        </li>
        <li>
          <strong>Self-hosted Node</strong>: export it in the process environment before
          starting the server (PM2 ecosystem file, systemd unit, Docker <code>-e</code>, …).
        </li>
      </ul>
    </div>
  );
}

function VersionBlock({
  label,
  value,
  loading,
  fallback,
}: {
  label: string;
  value: string | undefined;
  loading?: boolean;
  fallback?: string;
}) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#888',
        }}
      >
        {label}
      </p>
      <div style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700 }}>
        {loading ? <Skeleton style={{ height: 22, width: 90 }} /> : (value ?? fallback ?? '—')}
      </div>
    </div>
  );
}

function ReleaseRow({ release }: { release: GithubRelease }) {
  const title = release.name?.trim() || release.tagName;
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        border: '1px solid #eee',
        borderRadius: 'var(--caspian-radius, 8px)',
        background: '#fff',
      }}
    >
      <Badge variant="outline">{release.tagName}</Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={title}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>{formatDate(release.publishedAt)}</div>
      </div>
      {release.htmlUrl && (
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: '#444',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          View notes <ExternalLinkIcon size={14} />
        </a>
      )}
    </li>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        color: 'inherit',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children} <ExternalLinkIcon size={12} />
    </a>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day && diffMs >= 0) return 'Today';
  if (diffMs < 2 * day && diffMs >= 0) return 'Yesterday';
  if (diffMs < 30 * day && diffMs >= 0) {
    const days = Math.floor(diffMs / day);
    return `${days} days ago`;
  }
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
