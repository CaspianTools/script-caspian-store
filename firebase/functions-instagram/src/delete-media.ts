/**
 * Admin callable that deletes a published Instagram post (Phase 3) — the
 * "remove old products" action. Uses the stored Page token (no Meta secret).
 *
 * Requires the connected token to carry `instagram_manage_contents`
 * (Facebook-Login only). Deleting a carousel removes the whole album, not a
 * single slide; an unsupported media type surfaces as the Graph error message.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { assertAdmin } from './auth';
import { getConnection } from './store';
import { deleteMedia } from './graph';

export const deleteInstagramMedia = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);

  const mediaId = (request.data as { mediaId?: unknown })?.mediaId;
  if (typeof mediaId !== 'string' || !mediaId) {
    throw new HttpsError('invalid-argument', 'mediaId is required.');
  }

  const conn = await getConnection();
  if (!conn) throw new HttpsError('failed-precondition', 'Instagram is not connected for this store.');

  await deleteMedia(mediaId, conn.pageAccessToken);
  logger.info(`[deleteInstagramMedia] admin=${request.auth!.uid} media=${mediaId}`);
  return { ok: true as const };
});
