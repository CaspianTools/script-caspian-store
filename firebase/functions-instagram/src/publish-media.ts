/**
 * Admin callable that publishes a post to the store's Instagram (Phase 2).
 * Takes already-public image URL(s) + a caption — the POS passes a product's
 * Firebase Storage image URLs. One image → a single photo post; 2–10 → a
 * carousel. Uses the stored Page token (so no Meta secret needed here).
 *
 * Requires the connected token to carry `instagram_content_publish`. Subject to
 * Instagram's content-publishing rate limit (~100 posts / 24h); a limit breach
 * surfaces as the Graph error message.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { assertAdmin } from './auth';
import { getConnection } from './store';
import {
  createMediaContainer,
  createCarouselItem,
  createCarouselContainer,
  publishMedia,
  getPermalink,
} from './graph';

const MAX_IMAGES = 10;

export const publishInstagramMedia = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);

  const data = (request.data ?? {}) as { imageUrls?: unknown; caption?: unknown };
  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];
  const caption = typeof data.caption === 'string' ? data.caption : '';
  if (imageUrls.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one image URL is required.');
  }
  if (imageUrls.length > MAX_IMAGES) {
    throw new HttpsError('invalid-argument', `At most ${MAX_IMAGES} images are allowed per post.`);
  }

  const conn = await getConnection();
  if (!conn) throw new HttpsError('failed-precondition', 'Instagram is not connected for this store.');
  const { igUserId, pageAccessToken: token } = conn;

  let creationId: string;
  if (imageUrls.length === 1) {
    creationId = await createMediaContainer(igUserId, imageUrls[0], caption, token);
  } else {
    const childIds = await Promise.all(imageUrls.map((url) => createCarouselItem(igUserId, url, token)));
    creationId = await createCarouselContainer(igUserId, childIds, caption, token);
  }

  const mediaId = await publishMedia(igUserId, creationId, token);
  let permalink: string | undefined;
  try {
    permalink = (await getPermalink(mediaId, token)) || undefined;
  } catch {
    // Permalink is a nicety; a published post without it is still a success.
  }

  logger.info(`[publishInstagramMedia] admin=${request.auth!.uid} media=${mediaId} images=${imageUrls.length}`);
  return { mediaId, permalink };
});
