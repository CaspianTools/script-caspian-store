/**
 * The single `instagram/connection` document holds this store's Instagram link:
 * the discovered IG Business account + the access tokens. Tokens are secrets and
 * never leave the server — `firestore.rules` denies ALL client access to the
 * `instagram` collection, so only these Admin-SDK functions read/write it.
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const CONNECTION_ID = 'connection';

export interface InstagramConnectionDoc {
  igUserId: string;
  username: string;
  pageId: string;
  pageAccessToken: string;
  userAccessToken: string;
  tokenExpiresAtMs: number;
  connectedBy?: string;
}

function ref() {
  return getFirestore().collection('instagram').doc(CONNECTION_ID);
}

export async function getConnection(): Promise<InstagramConnectionDoc | null> {
  const snap = await ref().get();
  return snap.exists ? (snap.data() as InstagramConnectionDoc) : null;
}

export async function saveConnection(data: InstagramConnectionDoc): Promise<void> {
  await ref().set(
    {
      ...data,
      connectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Update only the rotated token fields (used by the scheduled refresh). */
export async function updateTokens(
  patch: Pick<InstagramConnectionDoc, 'userAccessToken' | 'pageAccessToken' | 'tokenExpiresAtMs'>,
): Promise<void> {
  await ref().set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteConnection(): Promise<void> {
  await ref().delete();
}
