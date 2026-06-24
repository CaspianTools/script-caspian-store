/**
 * Cloud Secret Manager declarations for the Instagram Cloud Functions.
 *
 * Mirrors functions-email/src/secrets.ts: the Meta app credentials live in
 * Google Secret Manager, not Firestore. `META_APP_ID` is technically public (it
 * ships in OAuth URLs) but is kept here so both halves are configured together;
 * `META_APP_SECRET` must never leave the server.
 *
 * Only the functions that perform the OAuth token exchange / refresh need these
 * (linkInstagram, refreshInstagramTokens) — the read + comment-moderation
 * callables use the stored Page token, so they don't attach the secrets.
 *
 * Consumers run, once per project:
 *   firebase functions:secrets:set META_APP_ID
 *   firebase functions:secrets:set META_APP_SECRET
 * Then `firebase deploy --only functions:caspian-instagram`. A function that
 * references a secret which doesn't exist on the project fails deploy fast with
 * a clear error — the desired UX, not silent breakage.
 */
import { defineSecret } from 'firebase-functions/params';

export const META_APP_ID = defineSecret('META_APP_ID');
export const META_APP_SECRET = defineSecret('META_APP_SECRET');

/** Attach to every function that exchanges/refreshes Meta tokens. */
export const META_SECRETS = [META_APP_ID, META_APP_SECRET];
