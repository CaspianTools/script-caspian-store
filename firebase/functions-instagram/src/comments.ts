/**
 * Admin comment-moderation callables — reply / hide·unhide / delete — for the
 * POS Instagram screen. Each resolves the stored Page token and calls the Graph
 * API. The POS only sends the comment id (+ text/hidden), since one project = one
 * connected IG account.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { assertAdmin } from './auth';
import { getConnection } from './store';
import { replyToComment, setCommentHidden, deleteComment } from './graph';

async function requireToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn) throw new HttpsError('failed-precondition', 'Instagram is not connected for this store.');
  return conn.pageAccessToken;
}

function requireCommentId(data: unknown): string {
  const id = (data as { commentId?: unknown })?.commentId;
  if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'commentId is required.');
  return id;
}

export const replyInstagramComment = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);
  const commentId = requireCommentId(request.data);
  const text = (request.data as { text?: unknown }).text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new HttpsError('invalid-argument', 'text is required.');
  }
  await replyToComment(commentId, text.trim(), await requireToken());
  logger.info(`[replyInstagramComment] admin=${request.auth!.uid} comment=${commentId}`);
  return { ok: true as const };
});

export const setInstagramCommentHidden = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);
  const commentId = requireCommentId(request.data);
  const hidden = Boolean((request.data as { hidden?: unknown }).hidden);
  await setCommentHidden(commentId, hidden, await requireToken());
  logger.info(`[setInstagramCommentHidden] admin=${request.auth!.uid} comment=${commentId} hidden=${hidden}`);
  return { ok: true as const };
});

export const deleteInstagramComment = onCall({ cors: true }, async (request) => {
  await assertAdmin(request);
  const commentId = requireCommentId(request.data);
  await deleteComment(commentId, await requireToken());
  logger.info(`[deleteInstagramComment] admin=${request.auth!.uid} comment=${commentId}`);
  return { ok: true as const };
});
