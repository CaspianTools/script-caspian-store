import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { caspianCollections } from '../firebase/collections';
import type { ErrorLog, ErrorLogSource } from '../types';
import { CASPIAN_STORE_VERSION } from '../version';
import { redactError, redactString, MAX_MESSAGE_LENGTH, MAX_STACK_LENGTH } from '../utils/redact-error';
import { DEFAULT_REPO_OWNER, DEFAULT_REPO_NAME } from './github-updates-service';

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 6000 is well under GitHub's practical URL cap (~8192) and leaves room for browser overhead. */
const MAX_UPSTREAM_URL_LENGTH = 6000;

export interface LogErrorInput {
  source: ErrorLogSource;
  origin: string;
  /** Raw error — redacted + truncated before write. */
  error: unknown;
  /** Small scalar-only context bag. */
  context?: Record<string, string | number | boolean>;
  /** Client-only; falls back to `navigator.userAgent` when available. */
  userAgent?: string;
  /** Client-only; falls back to `location.pathname` when available. */
  route?: string;
  firebaseProjectId?: string;
}

function docToErrorLog(snap: QueryDocumentSnapshot): ErrorLog {
  const data = snap.data();
  return {
    id: snap.id,
    timestamp: data.timestamp,
    source: data.source,
    origin: data.origin,
    message: data.message,
    stack: data.stack ?? undefined,
    context: data.context ?? undefined,
    userAgent: data.userAgent ?? undefined,
    route: data.route ?? undefined,
    libraryVersion: data.libraryVersion,
    firebaseProjectId: data.firebaseProjectId ?? undefined,
    seenCount: data.seenCount ?? 1,
    lastSeenAt: data.lastSeenAt ?? data.timestamp,
  };
}

/**
 * Persist an error to this installation's `errorLogs` collection. Called
 * from the `ErrorBoundary`, global window handlers, admin-page service
 * catch-sites, and any consumer plugin. Failures inside the logger itself
 * are swallowed — a broken logger must not mask the real error.
 *
 * Dedup: if an admin-authenticated caller logs an identical (origin,
 * message) pair seen within the last 24h, bump `seenCount` on that doc
 * instead of creating a new one. Non-admin (shopper) writes always create
 * a new doc — the daily retention sweep trims them.
 */
export async function logError(db: Firestore, input: LogErrorInput): Promise<string | null> {
  try {
    const { message, stack } = redactError(input.error);
    const origin = input.origin.slice(0, 200);
    const now = Timestamp.now();

    const base: Record<string, unknown> = {
      source: input.source,
      origin,
      message: message.slice(0, MAX_MESSAGE_LENGTH),
      libraryVersion: CASPIAN_STORE_VERSION,
      seenCount: 1,
      lastSeenAt: now,
      timestamp: now,
    };
    if (stack) base.stack = stack.slice(0, MAX_STACK_LENGTH);
    if (input.context) base.context = redactContext(input.context);
    if (input.userAgent ?? getUserAgent()) base.userAgent = (input.userAgent ?? getUserAgent())!.slice(0, 500);
    if (input.route ?? getRoute()) base.route = (input.route ?? getRoute())!.slice(0, 500);
    if (input.firebaseProjectId) base.firebaseProjectId = input.firebaseProjectId.slice(0, 80);

    const existing = await findRecentMatch(db, origin, base.message as string);
    if (existing) {
      try {
        await updateDoc(doc(db, 'errorLogs', existing.id), {
          seenCount: increment(1),
          lastSeenAt: now,
        });
        return existing.id;
      } catch {
        // Non-admin — rules forbid update. Fall through to create.
      }
    }

    const ref = await addDoc(caspianCollections(db).errorLogs, base);
    return ref.id;
  } catch {
    // Logger failures must never throw into the caller.
    return null;
  }
}

async function findRecentMatch(
  db: Firestore,
  origin: string,
  message: string,
): Promise<{ id: string } | null> {
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - DEDUP_WINDOW_MS);
    const q = query(
      caspianCollections(db).errorLogs,
      where('origin', '==', origin),
      where('message', '==', message),
      where('timestamp', '>=', cutoff),
      orderBy('timestamp', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    return first ? { id: first.id } : null;
  } catch {
    // Read is admin-only; non-admin callers can't dedup. That's fine.
    return null;
  }
}

function redactContext(
  ctx: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') out[k] = redactString(v).slice(0, 500);
    else out[k] = v;
  }
  return out;
}

function getUserAgent(): string | undefined {
  if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
    return navigator.userAgent;
  }
  return undefined;
}

function getRoute(): string | undefined {
  if (typeof location !== 'undefined' && typeof location.pathname === 'string') {
    return location.pathname;
  }
  return undefined;
}

/**
 * Convenience wrapper for service-layer catch blocks. Preserves the existing
 * `console.error('[caspian-store] …', err)` debug output and additionally
 * persists the error to Firestore. Use at the boundary where a thrown error
 * first becomes "handled" (toast shown, skeleton rendered, etc.).
 */
export function reportServiceError(
  db: Firestore,
  origin: string,
  err: unknown,
  context?: Record<string, string | number | boolean>,
): void {
  // eslint-disable-next-line no-console
  console.error(`[caspian-store] ${origin}:`, err);
  void logError(db, { source: 'service', origin, error: err, context });
}

export async function listRecentErrors(db: Firestore, max = 25): Promise<ErrorLog[]> {
  const q = query(caspianCollections(db).errorLogs, orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(docToErrorLog);
}

export async function dismissError(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'errorLogs', id));
}

/**
 * Build a `github.com/…/issues/new?title=…&body=…` URL pre-populated with
 * the error details so an admin can one-click-report it to the upstream
 * script repo (`CaspianTools/script-caspian-store`).
 *
 * Length-bounded: the returned URL is capped at ~6000 chars; if the body
 * would push it over, the stack is trimmed to fit. Title is always included.
 */
export function buildUpstreamIssueUrl(
  entry: Pick<ErrorLog, 'source' | 'origin' | 'message' | 'stack' | 'libraryVersion' | 'firebaseProjectId' | 'seenCount'>,
  opts: { owner?: string; repo?: string } = {},
): string {
  const owner = opts.owner ?? DEFAULT_REPO_OWNER;
  const repo = opts.repo ?? DEFAULT_REPO_NAME;
  const titleRaw = `[${entry.source}] ${entry.origin}: ${entry.message}`.slice(0, 200);
  const base = `https://github.com/${owner}/${repo}/issues/new?title=${encodeURIComponent(titleRaw)}&body=`;

  const header = [
    `**Source:** \`${entry.source}\``,
    `**Origin:** \`${entry.origin}\``,
    `**Library version:** \`${entry.libraryVersion}\``,
    entry.firebaseProjectId ? `**Firebase project:** \`${entry.firebaseProjectId}\`` : null,
    `**Seen:** ${entry.seenCount} time${entry.seenCount === 1 ? '' : 's'}`,
    '',
    '**Message**',
    '```',
    entry.message,
    '```',
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

  const footer = '\n\n---\n_Reported from caspian-store admin → About → Errors._';

  // Budget for the stack section = total cap − base URL − encoded(header+footer+wrapping).
  const tryBody = (stack: string | undefined): string => {
    const parts = [header];
    if (stack) {
      parts.push('', '**Stack**', '```', stack, '```');
    }
    parts.push(footer);
    return parts.join('\n');
  };

  let body = tryBody(entry.stack);
  let url = base + encodeURIComponent(body);
  if (url.length <= MAX_UPSTREAM_URL_LENGTH) return url;

  // Over budget — trim the stack until the encoded URL fits. Binary search
  // would be tidier but a linear shrink is plenty for a one-off click path.
  let stack = entry.stack ?? '';
  while (url.length > MAX_UPSTREAM_URL_LENGTH && stack.length > 0) {
    stack = stack.slice(0, Math.max(0, stack.length - 200));
    body = tryBody(stack ? stack + '\n… (truncated)' : undefined);
    url = base + encodeURIComponent(body);
  }
  return url;
}

export const UPSTREAM_ISSUE_URL_LIMIT = MAX_UPSTREAM_URL_LENGTH;
