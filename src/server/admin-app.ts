/**
 * The Firebase Admin app used by the server API (`caspianHandleApi`).
 *
 * Credentials, in order:
 *   1. `FIREBASE_SERVICE_ACCOUNT` — a service-account JSON key (as JSON text
 *      or base64). For hosts without Google credentials of their own
 *      (Vercel, a VPS).
 *   2. Application Default Credentials — automatic on Firebase App Hosting,
 *      Cloud Run and Cloud Functions, where the backend's own service
 *      account is used. Nothing to configure.
 */

import type { App } from 'firebase-admin/app';

export function resolveProjectId(): string | undefined {
  const fromWebConfig = (() => {
    try {
      const raw = process.env.FIREBASE_WEBAPP_CONFIG;
      return raw ? (JSON.parse(raw) as { projectId?: string }).projectId : undefined;
    } catch {
      return undefined;
    }
  })();
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.CASPIAN_FIREBASE_PROJECT_ID ||
    fromWebConfig ||
    undefined
  );
}

export function resolveStorageBucket(projectId: string): string {
  const fromWebConfig = (() => {
    try {
      const raw = process.env.FIREBASE_WEBAPP_CONFIG;
      return raw ? (JSON.parse(raw) as { storageBucket?: string }).storageBucket : undefined;
    } catch {
      return undefined;
    }
  })();
  return (
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    fromWebConfig ||
    `${projectId}.firebasestorage.app`
  );
}

function readServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(text) as Record<string, string>;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON (or base64 JSON).');
  }
}

/** Idempotent: initialises the default Admin app once per server instance. */
export async function getCaspianAdminApp(): Promise<App> {
  const { getApps, initializeApp, applicationDefault, cert } = await import('firebase-admin/app');
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error(
      'The server cannot tell which Firebase project to use. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_WEBAPP_CONFIG) on the host.',
    );
  }
  process.env.GOOGLE_CLOUD_PROJECT ||= projectId;
  const serviceAccount = readServiceAccount();
  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId,
    storageBucket: resolveStorageBucket(projectId),
  });
}

/** OAuth access token for Google REST APIs, from the same credentials. */
export async function getGoogleAccessToken(): Promise<string> {
  const app = await getCaspianAdminApp();
  const credential = app.options.credential;
  if (!credential) throw new Error('No server credentials available.');
  const { access_token } = await credential.getAccessToken();
  return access_token;
}
