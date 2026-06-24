/**
 * Admin callables that connect / disconnect this store's Instagram.
 *
 * `linkInstagram({ code, redirectUri })` completes the server side of the
 * Facebook-Login OAuth a client (e.g. the Caspian POS) started: it exchanges the
 * authorization code for a long-lived user token (using the Meta **app secret**,
 * which lives only here), discovers the linked IG Business account + Page token,
 * and stores the connection. Returns status only — never the tokens.
 *
 * `unlinkInstagram()` deletes the connection doc (tokens included).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { assertAdmin } from './auth';
import { META_APP_ID, META_APP_SECRET, META_SECRETS } from './secrets';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  discoverInstagramAccount,
} from './graph';
import { saveConnection, deleteConnection } from './store';

export const linkInstagram = onCall({ cors: true, secrets: META_SECRETS }, async (request) => {
  await assertAdmin(request);

  const { code, redirectUri } = (request.data ?? {}) as { code?: unknown; redirectUri?: unknown };
  if (typeof code !== 'string' || !code) {
    throw new HttpsError('invalid-argument', 'code is required.');
  }
  if (typeof redirectUri !== 'string' || !redirectUri) {
    throw new HttpsError('invalid-argument', 'redirectUri is required.');
  }

  const appId = META_APP_ID.value();
  const appSecret = META_APP_SECRET.value();
  if (!appId || !appSecret) {
    throw new HttpsError(
      'failed-precondition',
      'Instagram is not configured for this store. Set META_APP_ID and META_APP_SECRET first.',
    );
  }

  const shortToken = await exchangeCodeForToken(code, redirectUri, appId, appSecret);
  const { token: userToken, expiresAtMs } = await exchangeForLongLivedToken(shortToken, appId, appSecret);
  const account = await discoverInstagramAccount(userToken);

  await saveConnection({
    igUserId: account.igUserId,
    username: account.username,
    pageId: account.pageId,
    pageAccessToken: account.pageAccessToken,
    userAccessToken: userToken,
    tokenExpiresAtMs: expiresAtMs,
    connectedBy: request.auth!.uid,
  });

  logger.info(`[linkInstagram] admin=${request.auth!.uid} connected @${account.username} (ig=${account.igUserId})`);
  return { connected: true as const, username: account.username, expiresAtMs };
});

export const unlinkInstagram = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);
  await deleteConnection();
  logger.info(`[unlinkInstagram] admin=${request.auth!.uid} disconnected Instagram.`);
  return { connected: false as const };
});
