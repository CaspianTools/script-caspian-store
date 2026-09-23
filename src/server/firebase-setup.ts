/**
 * Installs this library's Firestore rules, Storage rules and composite
 * indexes into the store's Firebase project from the host's server — no
 * Firebase CLI, no `firebase deploy`. Used by the admin "Install / repair"
 * banner and the first-run setup.
 *
 * Needs the server's credentials (see admin-app.ts) to hold, in Google Cloud
 * IAM: Firebase Rules Admin (`roles/firebaserules.admin`) and Cloud Datastore
 * Index Admin (`roles/datastore.indexAdmin`). When they don't, every call
 * reports `permissionMissing` with the console link that grants them.
 */

import { CASPIAN_FIRESTORE_RULES, CASPIAN_STORAGE_RULES } from '../firebase/rules.generated';
import { CASPIAN_FIRESTORE_INDEXES } from '../firebase/indexes.generated';
import type { CaspianFirestoreIndex } from '../firebase/indexes-types';
import { CASPIAN_STORE_VERSION } from '../version';
import {
  getCaspianAdminApp,
  getGoogleAccessToken,
  resolveProjectId,
  resolveStorageBucket,
} from './admin-app';

export type RulesState = 'current' | 'outdated' | 'missing' | 'unknown';

export interface FirebaseSetupStatus {
  version: string;
  projectId: string | null;
  firestoreRules: RulesState;
  storageRules: RulesState;
  /** Composite indexes this version needs that the project does not have. */
  missingIndexes: number | null;
  /** True when every piece is installed and current. */
  ready: boolean;
  /** Set when the server's credentials lack an IAM role; `grantUrl` fixes it. */
  permissionMissing?: { roles: string[]; serviceAccount: string | null; grantUrl: string };
  error?: string;
}

const REQUIRED_ROLES = ['roles/firebaserules.admin', 'roles/datastore.indexAdmin'];

const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();

function isPermissionError(err: unknown): boolean {
  const e = err as { code?: string | number; status?: number; message?: string };
  const msg = String(e?.message ?? '');
  return (
    e?.status === 403 ||
    e?.code === 403 ||
    e?.code === 'permission-denied' ||
    /permission|PERMISSION_DENIED|forbidden|403/i.test(msg)
  );
}

async function serviceAccountEmail(): Promise<string | null> {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      return (JSON.parse(text) as { client_email?: string }).client_email ?? null;
    } catch {
      return null;
    }
  }
  // Metadata server: present on App Hosting / Cloud Run / Functions.
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
      { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(1500) },
    );
    return res.ok ? (await res.text()).trim() : null;
  } catch {
    return null;
  }
}

async function permissionHint(projectId: string): Promise<FirebaseSetupStatus['permissionMissing']> {
  return {
    roles: REQUIRED_ROLES,
    serviceAccount: await serviceAccountEmail(),
    grantUrl: `https://console.cloud.google.com/iam-admin/iam?project=${encodeURIComponent(projectId)}`,
  };
}

async function rulesState(
  getSource: () => Promise<string | null>,
  expected: string,
): Promise<RulesState> {
  const source = await getSource();
  if (source === null) return 'missing';
  return normalize(source) === normalize(expected) ? 'current' : 'outdated';
}

function indexKey(index: {
  collectionGroup: string;
  queryScope?: string;
  fields: Array<{ fieldPath: string; order?: string; arrayConfig?: string }>;
}): string {
  const fields = index.fields
    .filter((f) => f.fieldPath !== '__name__')
    .map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? ''}`)
    .join(',');
  return `${index.collectionGroup}|${index.queryScope ?? 'COLLECTION'}|${fields}`;
}

const firestoreAdminBase = (projectId: string) =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)`;

async function listExistingIndexKeys(projectId: string): Promise<Set<string>> {
  const token = await getGoogleAccessToken();
  const keys = new Set<string>();
  let pageToken = '';
  do {
    const url =
      `${firestoreAdminBase(projectId)}/collectionGroups/-/indexes?pageSize=200` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = new Error(`Listing Firestore indexes failed (${res.status})`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    const body = (await res.json()) as {
      indexes?: Array<{ name: string; queryScope?: string; fields: CaspianFirestoreIndex['fields'] }>;
      nextPageToken?: string;
    };
    for (const idx of body.indexes ?? []) {
      const collectionGroup = idx.name.split('/collectionGroups/')[1]?.split('/')[0] ?? '';
      keys.add(indexKey({ collectionGroup, queryScope: idx.queryScope, fields: idx.fields }));
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return keys;
}

function missingIndexes(existing: Set<string>): CaspianFirestoreIndex[] {
  return CASPIAN_FIRESTORE_INDEXES.indexes.filter((i) => !existing.has(indexKey(i)));
}

export async function getFirebaseSetupStatus(): Promise<FirebaseSetupStatus> {
  const projectId = resolveProjectId() ?? null;
  const status: FirebaseSetupStatus = {
    version: CASPIAN_STORE_VERSION,
    projectId,
    firestoreRules: 'unknown',
    storageRules: 'unknown',
    missingIndexes: null,
    ready: false,
  };
  if (!projectId) {
    status.error = 'The server cannot tell which Firebase project to use.';
    return status;
  }
  try {
    await getCaspianAdminApp();
    const { getSecurityRules } = await import('firebase-admin/security-rules');
    const rules = getSecurityRules();
    const bucket = resolveStorageBucket(projectId);
    const [fs, st, existing] = await Promise.all([
      rulesState(async () => {
        try {
          return (await rules.getFirestoreRuleset()).source[0]?.content ?? '';
        } catch (err) {
          if (/not.?found/i.test(String((err as Error)?.message))) return null;
          throw err;
        }
      }, CASPIAN_FIRESTORE_RULES),
      rulesState(async () => {
        try {
          return (await rules.getStorageRuleset(bucket)).source[0]?.content ?? '';
        } catch (err) {
          if (/not.?found/i.test(String((err as Error)?.message))) return null;
          throw err;
        }
      }, CASPIAN_STORAGE_RULES),
      listExistingIndexKeys(projectId),
    ]);
    status.firestoreRules = fs;
    status.storageRules = st;
    status.missingIndexes = missingIndexes(existing).length;
    status.ready = fs === 'current' && st === 'current' && status.missingIndexes === 0;
  } catch (err) {
    if (isPermissionError(err)) status.permissionMissing = await permissionHint(projectId);
    else status.error = err instanceof Error ? err.message : String(err);
  }
  return status;
}

export interface FirebaseSetupResult {
  firestoreRules: boolean;
  storageRules: boolean;
  indexesCreated: number;
  indexesAlreadyPresent: number;
  /** Index builds run in the background for a few minutes after this returns. */
  indexesBuilding: boolean;
  permissionMissing?: FirebaseSetupStatus['permissionMissing'];
  error?: string;
}

/** Publishes the bundled rules and creates any missing composite indexes. */
export async function installFirebaseSetup(): Promise<FirebaseSetupResult> {
  const result: FirebaseSetupResult = {
    firestoreRules: false,
    storageRules: false,
    indexesCreated: 0,
    indexesAlreadyPresent: 0,
    indexesBuilding: false,
  };
  const projectId = resolveProjectId();
  if (!projectId) {
    result.error = 'The server cannot tell which Firebase project to use.';
    return result;
  }
  try {
    await getCaspianAdminApp();
    const { getSecurityRules } = await import('firebase-admin/security-rules');
    const rules = getSecurityRules();
    await rules.releaseFirestoreRulesetFromSource(CASPIAN_FIRESTORE_RULES);
    result.firestoreRules = true;
    await rules.releaseStorageRulesetFromSource(CASPIAN_STORAGE_RULES, resolveStorageBucket(projectId));
    result.storageRules = true;

    const existing = await listExistingIndexKeys(projectId);
    const toCreate = missingIndexes(existing);
    result.indexesAlreadyPresent = CASPIAN_FIRESTORE_INDEXES.indexes.length - toCreate.length;
    const token = await getGoogleAccessToken();
    for (const index of toCreate) {
      const res = await fetch(
        `${firestoreAdminBase(projectId)}/collectionGroups/${encodeURIComponent(index.collectionGroup)}/indexes`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryScope: index.queryScope, fields: index.fields }),
        },
      );
      if (res.ok) {
        result.indexesCreated += 1;
      } else if (res.status === 409) {
        result.indexesAlreadyPresent += 1;
      } else {
        const err = new Error(
          `Creating the ${index.collectionGroup} index failed (${res.status}): ${await res.text()}`,
        ) as Error & { status: number };
        err.status = res.status;
        throw err;
      }
    }
    result.indexesBuilding = result.indexesCreated > 0;
  } catch (err) {
    if (isPermissionError(err)) result.permissionMissing = await permissionHint(projectId);
    else result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}
