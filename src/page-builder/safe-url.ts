/**
 * URL guards for admin-authored block props. A page layout is written by an
 * admin but rendered for every shopper, so a `javascript:` or `data:` value in
 * a link / embed field would run in the shopper's browser. Both helpers return
 * `''` for anything they reject, which the widgets treat as "unset".
 */

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** An absolute http(s) URL, else `''`. Used for iframe sources. */
export function safeHttpUrl(value: string): string {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : '';
}

/** An absolute http(s) URL or a scheme-less (relative / same-site) path, else `''`. */
export function safeLinkHref(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (!SCHEME_RE.test(v)) return v;
  return safeHttpUrl(v);
}
