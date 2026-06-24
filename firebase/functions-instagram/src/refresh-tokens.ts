/**
 * Daily scheduled refresh of the long-lived Instagram token. Facebook long-lived
 * user tokens last ~60 days; we re-exchange (fb_exchange_token) when within the
 * refresh window and re-derive the Page token, so a connected store keeps working
 * without a manual reconnect. No-ops when the store isn't connected.
 *
 * Cloud Scheduler must be enabled on the project; with no connection doc this
 * runs and exits cheaply.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { META_APP_ID, META_APP_SECRET, META_SECRETS } from './secrets';
import { exchangeForLongLivedToken, discoverInstagramAccount } from './graph';
import { getConnection, updateTokens } from './store';

/** Refresh when the token is within 14 days of expiry. */
const REFRESH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const refreshInstagramTokens = onSchedule(
  { schedule: 'every 24 hours', secrets: META_SECRETS },
  async () => {
    const conn = await getConnection();
    if (!conn) return;
    if (conn.tokenExpiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
      return; // still fresh — nothing to do
    }

    const appId = META_APP_ID.value();
    const appSecret = META_APP_SECRET.value();
    if (!appId || !appSecret) {
      logger.warn('[refreshInstagramTokens] Meta credentials missing; skipping refresh.');
      return;
    }

    try {
      const { token: userToken, expiresAtMs } = await exchangeForLongLivedToken(
        conn.userAccessToken,
        appId,
        appSecret,
      );
      const account = await discoverInstagramAccount(userToken);
      await updateTokens({
        userAccessToken: userToken,
        pageAccessToken: account.pageAccessToken,
        tokenExpiresAtMs: expiresAtMs,
      });
      logger.info(
        `[refreshInstagramTokens] refreshed @${account.username}; expires ${new Date(expiresAtMs).toISOString()}`,
      );
    } catch (err) {
      // Don't throw — a failed refresh (e.g. user revoked access) just means the
      // admin must reconnect; the next inbox read will surface the auth error.
      logger.error(`[refreshInstagramTokens] refresh failed: ${(err as Error).message}`);
    }
  },
);
