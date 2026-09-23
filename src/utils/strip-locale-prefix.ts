/**
 * Drop a leading locale segment from a pathname: `/az/pos/settings` → `/pos/settings`.
 *
 * Consumer apps that put the locale in the URL hand every component a prefixed
 * pathname, so anything routing on `pathname` has to strip it first or it silently
 * matches nothing. `PosRoot` did not, which is why `/az/pos/settings` rendered the
 * register instead of the settings page until v10.3.0 — a non-English till could
 * not reach its own settings at all.
 *
 * Deliberately matches *any* two-letter segment rather than the built-in locale
 * list: a consumer may add locales the library has never heard of, and this was
 * the behaviour already shipped in `caspian-root.tsx`. The trade-off is that a
 * real two-letter top-level route would be eaten — avoid naming one.
 */
export function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/i);
  if (!match) return pathname;
  return pathname.slice(match[1].length + 1) || '/';
}

/**
 * The leading locale segment of a pathname, with its slash: `/fr/cart` → `/fr`,
 * `/cart` → `''`. Same two-letter rule as `stripLocalePrefix`.
 */
export function getLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/i);
  return match ? `/${match[1]}` : '';
}

/**
 * Put `prefix` in front of a root-relative href: `('/cart', '/fr')` → `/fr/cart`.
 * Leaves alone anything that is not root-relative (`https://…`, `//cdn…`, `#top`,
 * `mailto:`), and any href that already starts with a locale segment, so an
 * explicit switch to another language is not double-prefixed.
 */
export function withLocalePrefix(href: string, prefix: string): string {
  if (!prefix || !href.startsWith('/') || href.startsWith('//')) return href;
  if (getLocalePrefix(href)) return href;
  return href === '/' ? prefix : `${prefix}${href}`;
}
