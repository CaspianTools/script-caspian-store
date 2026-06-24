/**
 * Thin Meta Graph API client for the Instagram channel (Facebook Login path).
 * Node 22 ships a global `fetch`, so no HTTP dependency. Every call throws an
 * `HttpsError` carrying Meta's own error message on failure, so the POS surfaces
 * a meaningful per-shop error.
 *
 * Flow recap (Instagram API with Facebook Login):
 *   1. The desktop POS does the loopback OAuth and obtains an authorization `code`.
 *   2. `linkInstagram` exchanges code → short-lived user token → long-lived user
 *      token, then discovers the Facebook Page that owns the IG Business account
 *      and keeps that Page's access token (effectively non-expiring while the
 *      long-lived user token is valid). IG endpoints are called with the Page token.
 */
import { HttpsError } from 'firebase-functions/v2/https';

export const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function graph<T>(method: string, path: string, params: Record<string, string>): Promise<T> {
  const usp = new URLSearchParams(params);
  let url = `${BASE}/${path}`;
  const init: RequestInit = { method };
  // GET/DELETE put params on the query string; POST sends a form body.
  if (method === 'GET' || method === 'DELETE') {
    url += `?${usp.toString()}`;
  } else {
    init.body = usp;
  }
  let resp: Response;
  try {
    resp = await fetch(url, init);
  } catch (err) {
    throw new HttpsError('unavailable', `Instagram request failed: ${(err as Error).message}`);
  }
  const json = (await resp.json().catch(() => ({}))) as T & GraphError;
  if (!resp.ok || json.error) {
    const msg = json.error?.message || `Graph API ${resp.status}`;
    // An invalid/expired token is the common "reconnect needed" signal.
    const code = resp.status === 401 || json.error?.code === 190 ? 'unauthenticated' : 'internal';
    throw new HttpsError(code, `Instagram: ${msg}`);
  }
  return json;
}

/** Exchange the OAuth authorization code for a short-lived user access token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
): Promise<string> {
  const res = await graph<{ access_token?: string }>('GET', 'oauth/access_token', {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  if (!res.access_token) throw new HttpsError('internal', 'Instagram: token exchange returned no token.');
  return res.access_token;
}

/** Upgrade a short-lived user token to a long-lived one (~60 days). */
export async function exchangeForLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string,
): Promise<{ token: string; expiresAtMs: number }> {
  const res = await graph<{ access_token?: string; expires_in?: number }>('GET', 'oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  if (!res.access_token) throw new HttpsError('internal', 'Instagram: long-lived exchange returned no token.');
  const expiresInSec = typeof res.expires_in === 'number' ? res.expires_in : 60 * 24 * 60 * 60;
  return { token: res.access_token, expiresAtMs: Date.now() + expiresInSec * 1000 };
}

export interface IgAccount {
  igUserId: string;
  username: string;
  pageId: string;
  pageAccessToken: string;
}

/**
 * Discover the IG Business account linked to one of the user's Pages, and keep
 * that Page's access token (used for all subsequent IG calls). Picks the first
 * Page that has an `instagram_business_account`.
 */
export async function discoverInstagramAccount(userToken: string): Promise<IgAccount> {
  const res = await graph<{
    data?: Array<{
      id: string;
      access_token?: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
  }>('GET', 'me/accounts', {
    fields: 'name,access_token,instagram_business_account{id,username}',
    access_token: userToken,
  });
  const page = (res.data ?? []).find((p) => p.instagram_business_account?.id);
  if (!page || !page.instagram_business_account?.id || !page.access_token) {
    throw new HttpsError(
      'failed-precondition',
      'No Instagram Business account is linked to a Facebook Page on this login. Connect the IG account to a Page (Professional account) and try again.',
    );
  }
  return {
    igUserId: page.instagram_business_account.id,
    username: page.instagram_business_account.username ?? '',
    pageId: page.id,
    pageAccessToken: page.access_token,
  };
}

export interface GraphMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

/** Recent published media for the IG Business account. */
export async function getMedia(igUserId: string, token: string, limit: number): Promise<GraphMedia[]> {
  const res = await graph<{ data?: GraphMedia[] }>('GET', `${igUserId}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: String(limit),
    access_token: token,
  });
  return res.data ?? [];
}

export interface GraphComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  hidden?: boolean;
  like_count?: number;
  replies?: { data?: unknown[] };
}

/** Comments on one media item (top-level; includes a reply count). */
export async function getComments(mediaId: string, token: string): Promise<GraphComment[]> {
  const res = await graph<{ data?: GraphComment[] }>('GET', `${mediaId}/comments`, {
    fields: 'id,text,username,timestamp,hidden,like_count,replies.summary(true)',
    access_token: token,
  });
  return res.data ?? [];
}

export async function replyToComment(commentId: string, message: string, token: string): Promise<void> {
  await graph('POST', `${commentId}/replies`, { message, access_token: token });
}

export async function setCommentHidden(commentId: string, hide: boolean, token: string): Promise<void> {
  await graph('POST', commentId, { hide: String(hide), access_token: token });
}

export async function deleteComment(commentId: string, token: string): Promise<void> {
  await graph('DELETE', commentId, { access_token: token });
}

/* --- Content publishing (Phase 2) -------------------------------------------
 * Two-step container flow: create a media container from a PUBLIC image URL,
 * then publish it. Carousels create one child container per image, then a
 * parent CAROUSEL container over the children. Images must be reachable by
 * Instagram (public HTTPS) — POS product images on Firebase Storage qualify.
 */

/** Create a single-image media container; returns the creation id. */
export async function createMediaContainer(
  igUserId: string,
  imageUrl: string,
  caption: string,
  token: string,
): Promise<string> {
  const res = await graph<{ id?: string }>('POST', `${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token,
  });
  if (!res.id) throw new HttpsError('internal', 'Instagram: media container returned no id.');
  return res.id;
}

/** Create one carousel child container (no caption); returns its id. */
export async function createCarouselItem(
  igUserId: string,
  imageUrl: string,
  token: string,
): Promise<string> {
  const res = await graph<{ id?: string }>('POST', `${igUserId}/media`, {
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: token,
  });
  if (!res.id) throw new HttpsError('internal', 'Instagram: carousel item returned no id.');
  return res.id;
}

/** Create the parent CAROUSEL container over child ids; returns the creation id. */
export async function createCarouselContainer(
  igUserId: string,
  childIds: string[],
  caption: string,
  token: string,
): Promise<string> {
  const res = await graph<{ id?: string }>('POST', `${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token,
  });
  if (!res.id) throw new HttpsError('internal', 'Instagram: carousel container returned no id.');
  return res.id;
}

/** Publish a previously created container; returns the published media id. */
export async function publishMedia(
  igUserId: string,
  creationId: string,
  token: string,
): Promise<string> {
  const res = await graph<{ id?: string }>('POST', `${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  if (!res.id) throw new HttpsError('internal', 'Instagram: publish returned no media id.');
  return res.id;
}

/** Fetch the public permalink for a published media id. */
export async function getPermalink(mediaId: string, token: string): Promise<string> {
  const res = await graph<{ permalink?: string }>('GET', mediaId, {
    fields: 'permalink',
    access_token: token,
  });
  return res.permalink ?? '';
}
