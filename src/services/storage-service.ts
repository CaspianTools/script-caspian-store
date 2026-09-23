import { caspianCallable } from './caspian-callable';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import { doc, getDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { updateProfile, type Auth } from 'firebase/auth';
import type { Functions } from 'firebase/functions';

const PROFILE_PHOTO_PATH = (uid: string, ext: string) => `users/${uid}/avatar.${ext}`;
const LEGACY_PROFILE_PHOTO_PATHS = ['jpg', 'jpeg', 'png', 'webp'];

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function extFromType(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export interface UploadProfilePhotoInput {
  storage: FirebaseStorage;
  db: Firestore;
  auth: Auth;
  uid: string;
  file: File;
}

export async function uploadProfilePhoto({
  storage,
  db,
  auth,
  uid,
  file,
}: UploadProfilePhotoInput): Promise<string> {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(file.type)) {
    throw new Error('Please select a JPEG, PNG, or WebP image.');
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error(`Image must be under ${MAX_PROFILE_PHOTO_BYTES / 1024 / 1024} MB.`);
  }

  const ext = extFromType(file.type);
  const path = PROFILE_PHOTO_PATH(uid, ext);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  await updateDoc(doc(db, 'users', uid), { photoURL: url, updatedAt: Timestamp.now() });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: url });
  }
  return url;
}

/**
 * Generic image upload helper for admin surfaces (logo/favicon, product
 * photos, journal cover images, pageContents assets). Returns the public
 * download URL.
 *
 * `path` is arbitrary but must match your deployed Storage rules — the
 * package ships rules for `siteSettings/**`, `products/**`, `journal/**`,
 * and `pageContents/**` (see `firebase/storage.rules` /
 * `CASPIAN_STORAGE_RULES`).
 *
 * Pass `auth` to enable the v8.6.0 self-heal: if Storage returns
 * `storage/unauthorized` on the first attempt, the helper force-refreshes
 * the user's ID token and retries once. This recovers the common case where
 * an admin's claim was set after their cached ID token was issued (e.g.
 * `claimAdmin` ran in another tab, or `syncAdminClaim` fired during the
 * session). The retry runs at most once — if it also fails the original
 * error is rethrown so callers can surface a precise diagnostic via
 * {@link diagnoseUploadDenial}.
 *
 * `uploadBytes` may throw a `FirebaseError`; common `error.code` values
 * callers should handle:
 *   - `storage/unauthorized` — rules deny the path, or the user's Firestore
 *     `users/{uid}.role !== 'admin'`, or the admin custom claim isn't on
 *     the token. Use {@link diagnoseUploadDenial} to disambiguate.
 *   - `storage/unauthenticated` — no auth user. Sign in again.
 *   - `storage/quota-exceeded` — Storage bucket is full.
 *   - `storage/retry-limit-exceeded` / `storage/canceled` — network drop.
 */
export async function uploadAdminImage({
  storage,
  path,
  file,
  auth,
  functions,
  maxBytes = 10 * 1024 * 1024,
  allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}: {
  storage: FirebaseStorage;
  path: string;
  file: File;
  auth?: Auth;
  functions?: Functions;
  maxBytes?: number;
  allowedTypes?: string[];
}): Promise<string> {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }
  if (file.size > maxBytes) {
    throw new Error(`Image must be under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  const storageRef = ref(storage, path);
  try {
    await uploadBytes(storageRef, file, { contentType: file.type });
  } catch (err) {
    if (isUnauthorized(err) && auth?.currentUser) {
      // v8.8.0: when Functions is available, try the server-side heal
      // (ensureAdminClaim mirrors users/{uid}.role to a custom claim) so
      // pre-trigger admins self-fix without running the backfill script.
      // Falls through to the v8.6.0 plain force-refresh if Functions
      // isn't passed or the callable isn't deployed.
      if (functions) {
        await tryEnsureAdminClaim({ functions, auth });
      } else {
        await auth.currentUser.getIdToken(true);
      }
      await uploadBytes(storageRef, file, { contentType: file.type });
    } else {
      throw err;
    }
  }
  return await getDownloadURL(storageRef);
}

/**
 * Calls the `ensureAdminClaim` callable (v8.8.0 of the `caspian-admin`
 * Functions codebase) to mirror the caller's `users/{uid}.role` to an
 * Auth custom claim, then force-refreshes the ID token so the new claim
 * is visible immediately.
 *
 * Returns `true` if the claim was set or already correct, `false` if
 * Firestore says the caller isn't admin OR the callable isn't deployed
 * (older Functions versions). Never throws — the upload + diagnostic
 * flow can fall through gracefully.
 *
 * Safe to call on every admin sign-in or every storage/unauthorized
 * retry: it's idempotent and won't escalate privilege beyond what
 * `users/{uid}.role` already says.
 */
export async function tryEnsureAdminClaim({
  functions,
  auth,
}: {
  functions: Functions;
  auth: Auth;
}): Promise<boolean> {
  if (!auth.currentUser) return false;
  try {
    const callable = caspianCallable<unknown, EnsureAdminClaimResult>(
      functions,
      'ensureAdminClaim',
    );
    const result = await callable({});
    if (result.data?.requiresTokenRefresh) {
      await auth.currentUser.getIdToken(true);
    } else {
      // Even if the server side was already a no-op, force-refresh as a
      // defense in depth — the local cached token might still be stale
      // from a different out-of-band claim mutation.
      await auth.currentUser.getIdToken(true);
    }
    return result.data?.role === 'admin';
  } catch {
    // Most common cause: the callable isn't deployed yet (caspian-admin
    // Functions older than v0.6.0). Older v8.6.0 fallback: just refresh
    // the token, which is enough if the trigger DID fire and the claim
    // is just stale on the client.
    try {
      await auth.currentUser.getIdToken(true);
    } catch {
      // Network blip — give up. The diagnose path will surface the right
      // message after this returns false.
    }
    return false;
  }
}

interface EnsureAdminClaimResult {
  ok: boolean;
  role?: string;
  claimSet?: boolean;
  requiresTokenRefresh?: boolean;
}

function isUnauthorized(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: unknown }).code === 'storage/unauthorized'
  );
}

/**
 * Discriminates the reason an admin image upload was denied, so the UI can
 * show a precise toast instead of always blaming "stale storage rules."
 *
 * Call after {@link uploadAdminImage} threw `storage/unauthorized` AND its
 * built-in token-refresh retry also failed.
 *
 * - `notAdmin` — Firestore `users/{uid}.role !== 'admin'`. Path: AccessDenied
 *   / `claimAdmin` flow.
 * - `claimNotSet` — Firestore says admin but the freshest ID token has no
 *   `role: 'admin'` custom claim. The `caspian-admin` Cloud Functions
 *   (specifically `syncAdminClaim`) likely aren't deployed. Path:
 *   `firebase deploy --only functions`.
 * - `rulesStale` — Firestore admin AND claim present. The rules engine
 *   still denies, so the deployed rules don't allow this path or the
 *   Firebase Rules API is disabled on the project. Path:
 *   run `npm run firebase:sync`, then `firebase deploy --only storage`.
 */
export type UploadDenialDiagnosis =
  | { kind: 'notAdmin' }
  | { kind: 'claimNotSet' }
  | { kind: 'rulesStale' };

export async function diagnoseUploadDenial({
  auth,
  db,
}: {
  auth: Auth;
  db: Firestore;
}): Promise<UploadDenialDiagnosis> {
  const user = auth.currentUser;
  if (!user) return { kind: 'notAdmin' };

  // Don't force-refresh — the retry path already did, and a second forced
  // refresh inside the same flow doesn't surface anything new.
  const tokenResult = await user.getIdTokenResult();
  const claimIsAdmin = tokenResult.claims.role === 'admin';

  let firestoreIsAdmin = false;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    firestoreIsAdmin = snap.exists() && snap.data()?.role === 'admin';
  } catch {
    // If Firestore read fails (offline / rules / network), treat as
    // not-admin — the user can't be authorized as admin if we can't even
    // read their profile. Better to over-explain than silently default to
    // "redeploy rules."
  }

  if (!firestoreIsAdmin) return { kind: 'notAdmin' };
  if (!claimIsAdmin) return { kind: 'claimNotSet' };
  return { kind: 'rulesStale' };
}

export async function deleteStorageObject(
  storage: FirebaseStorage,
  path: string,
): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* ignore missing objects */
  }
}

export async function removeProfilePhoto({
  storage,
  db,
  auth,
  uid,
}: Omit<UploadProfilePhotoInput, 'file'>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { photoURL: null, updatedAt: Timestamp.now() });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: null });
  }
  // Best-effort cleanup of any of the allowed extensions.
  for (const ext of LEGACY_PROFILE_PHOTO_PATHS) {
    try {
      await deleteObject(ref(storage, PROFILE_PHOTO_PATH(uid, ext)));
    } catch {
      /* ignore missing objects */
    }
  }
}
