import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Auto-promote the first-ever user to admin.
 *
 * Fires when a document is created at `users/{uid}`. Two promotion paths:
 *
 *   1. **Email allowlist** (v8.7.0). If any docs exist in
 *      `pendingSuperAdmin`, only promote when the new user's auth-record
 *      email matches a pending entry. Closes the race window in the
 *      legacy "first user wins" path: an installer can designate
 *      `someone@example.com` from the setup wizard before sign-up, and
 *      no other accidental signup can claim admin in the meantime.
 *      The matched pending doc is deleted on success.
 *
 *   2. **First-user-wins** (legacy). If `pendingSuperAdmin` is empty,
 *      fall back to the original behavior: the first user to register
 *      becomes admin. Preserved so existing v8.6.x installs that haven't
 *      moved to the wizard flow still bootstrap correctly.
 *
 * In both paths, the promotion is gated by a "no admin already exists"
 * check, so the function is safe to leave deployed indefinitely.
 *
 * Race-window caveat (path 2): if a malicious actor registers between
 * "function deployed" and "installer registers their own account," they
 * win the role. Mitigation is to use path 1 — the wizard writes a pending
 * entry first, locking the eventual admin to a specific email.
 */
export const onUserCreate = onDocumentCreated('users/{uid}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const uid = event.params.uid;
  const db = getFirestore();
  const existingAdmins = await db
    .collection('users')
    .where('role', '==', 'admin')
    .limit(1)
    .get();

  if (!existingAdmins.empty) {
    logger.info(`[onUserCreate] Skipping promote: admin already exists (uid=${uid}).`);
    return;
  }

  const userRecord = await getAuth().getUser(uid);
  const userEmail = (userRecord.email ?? '').trim().toLowerCase();

  // Path 1: email allowlist. If any pending entry exists, the wizard has
  // designated who the first admin will be — only that email is allowed.
  const pendingSnap = await db.collection('pendingSuperAdmin').limit(1).get();
  if (!pendingSnap.empty) {
    if (!userEmail) {
      logger.info(
        `[onUserCreate] Skipping promote: pending designations exist but new user has no email (uid=${uid}).`,
      );
      return;
    }
    const matchSnap = await db
      .collection('pendingSuperAdmin')
      .doc(userEmail)
      .get();
    if (!matchSnap.exists) {
      logger.info(
        `[onUserCreate] Skipping promote: ${userEmail} is not on the pendingSuperAdmin allowlist (uid=${uid}).`,
      );
      return;
    }
    await snap.ref.update({ role: 'admin' });
    await getAuth().setCustomUserClaims(uid, {
      ...(userRecord.customClaims ?? {}),
      role: 'admin',
    });
    await matchSnap.ref.delete();
    logger.info(
      `[onUserCreate] Promoted designated admin via allowlist: uid=${uid} email=${userEmail}.`,
    );
    return;
  }

  // Path 2: legacy first-user-wins. No designation — any first user wins,
  // except an anonymous guest: guest checkout creates a `users/{uid}` doc for
  // every anonymous session, and the first shopper to open the checkout on a
  // fresh install must not become the store's admin.
  if (userRecord.providerData.length === 0) {
    logger.info(`[onUserCreate] Skipping promote: anonymous user cannot be first admin (uid=${uid}).`);
    return;
  }
  await snap.ref.update({ role: 'admin' });
  await getAuth().setCustomUserClaims(uid, {
    ...(userRecord.customClaims ?? {}),
    role: 'admin',
  });
  logger.info(`[onUserCreate] First user promoted to admin (legacy path): uid=${uid}.`);
});
