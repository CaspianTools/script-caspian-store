/**
 * Stand-in for `firebase-functions/v2/https` when the Cloud Functions sources
 * under firebase/functions-* are bundled into the `./server` entry (see
 * tsup.config.ts `alias`). The same handler code then runs either as a
 * deployed Cloud Function or inside the host's Next.js route — no copy to
 * keep in sync. Only the surface those sources use is implemented.
 */

export type FunctionsErrorCode =
  | 'ok'
  | 'cancelled'
  | 'unknown'
  | 'invalid-argument'
  | 'deadline-exceeded'
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'aborted'
  | 'out-of-range'
  | 'unimplemented'
  | 'internal'
  | 'unavailable'
  | 'data-loss'
  | 'unauthenticated';

const HTTP_STATUS: Record<FunctionsErrorCode, number> = {
  ok: 200,
  cancelled: 499,
  unknown: 500,
  'invalid-argument': 400,
  'deadline-exceeded': 504,
  'not-found': 404,
  'already-exists': 409,
  'permission-denied': 403,
  'resource-exhausted': 429,
  'failed-precondition': 400,
  aborted: 409,
  'out-of-range': 400,
  unimplemented: 501,
  internal: 500,
  unavailable: 503,
  'data-loss': 500,
  unauthenticated: 401,
};

export class HttpsError extends Error {
  readonly code: FunctionsErrorCode;
  readonly details?: unknown;
  readonly httpStatus: number;
  constructor(code: FunctionsErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpsError';
    this.code = code;
    this.details = details;
    this.httpStatus = HTTP_STATUS[code] ?? 500;
  }
}

export interface CallableRequest<T = any> {
  data: T;
  auth?: { uid: string; token: Record<string, any> & { email?: string; uid: string } };
  rawRequest: Request;
}

export interface ShimCallable<T = any, R = any> {
  readonly __caspianCallable: (request: CallableRequest<T>) => R | Promise<R>;
}

export function onCall<T = any, R = any>(
  optsOrHandler: unknown,
  maybeHandler?: (request: CallableRequest<T>) => R | Promise<R>,
): ShimCallable<T, R> {
  const handler = (typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler) as (
    request: CallableRequest<T>,
  ) => R | Promise<R>;
  return { __caspianCallable: handler };
}

/** Express-shaped request/response the Cloud Functions `onRequest` handlers use. */
export interface ShimRequest {
  method: string;
  headers: Record<string, string | undefined>;
  rawBody: Buffer;
  body: unknown;
}
export interface ShimResponse {
  status(code: number): ShimResponse;
  send(body?: unknown): ShimResponse;
  json(body: unknown): ShimResponse;
  set(name: string, value: string): ShimResponse;
}

export interface ShimOnRequest {
  readonly __caspianOnRequest: (req: ShimRequest, res: ShimResponse) => void | Promise<void>;
}

export function onRequest(
  optsOrHandler: unknown,
  maybeHandler?: (req: ShimRequest, res: ShimResponse) => void | Promise<void>,
): ShimOnRequest {
  const handler = (typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler) as (
    req: ShimRequest,
    res: ShimResponse,
  ) => void | Promise<void>;
  return { __caspianOnRequest: handler };
}
