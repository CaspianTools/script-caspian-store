/**
 * Staff-readable callable powering the POS Instagram screen: connection status +
 * recent media + their comments for this store. When the store isn't connected
 * it returns `{ connected: false }` cleanly (NOT an error) so the POS shows the
 * "Connect" affordance; a live token error (expired/revoked) throws so the POS
 * surfaces it as a per-shop error.
 *
 * Returns ms-epoch timestamps and the exact field names the POS expects
 * (see caspian-store-pos `src/main/instagram.ts` BackendInbox).
 */
import { onCall } from 'firebase-functions/v2/https';
import { assertStaff } from './auth';
import { getConnection } from './store';
import { getMedia, getComments, type GraphMedia, type GraphComment } from './graph';

/** Recent media to read, and how many of them to also pull comments for. */
const MEDIA_LIMIT = 24;
const COMMENT_MEDIA_LIMIT = 12;

function toMs(ts?: string): number {
  if (!ts) return 0;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : 0;
}

function mapMedia(m: GraphMedia) {
  return {
    id: m.id,
    caption: m.caption ?? '',
    mediaType: m.media_type ?? 'IMAGE',
    mediaUrl: m.media_url,
    thumbnailUrl: m.thumbnail_url,
    permalink: m.permalink,
    timestampMs: toMs(m.timestamp),
    likeCount: m.like_count,
    commentsCount: m.comments_count,
  };
}

function mapComment(mediaId: string, c: GraphComment) {
  return {
    id: c.id,
    mediaId,
    username: c.username ?? '',
    text: c.text ?? '',
    timestampMs: toMs(c.timestamp),
    hidden: Boolean(c.hidden),
    likeCount: c.like_count,
    replyCount: Array.isArray(c.replies?.data) ? c.replies!.data!.length : undefined,
  };
}

export const instagramInbox = onCall({ cors: true }, async (request) => {
  await assertStaff(request);

  const conn = await getConnection();
  if (!conn) {
    return { status: { connected: false as const }, media: [], comments: [] };
  }

  const token = conn.pageAccessToken;
  const rawMedia = await getMedia(conn.igUserId, token, MEDIA_LIMIT);
  const media = rawMedia.map(mapMedia);

  // Pull comments for the most recent media only (bounded fan-out).
  const commentLists = await Promise.all(
    rawMedia.slice(0, COMMENT_MEDIA_LIMIT).map(async (m) => {
      const list = await getComments(m.id, token);
      return list.map((c) => mapComment(m.id, c));
    }),
  );
  const comments = commentLists.flat();

  return {
    status: {
      connected: true as const,
      username: conn.username,
      expiresAtMs: conn.tokenExpiresAtMs,
    },
    media,
    comments,
  };
});
