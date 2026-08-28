import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type {
  CaspianLinkProps,
  CaspianNavigation,
  FrameworkAdapters,
} from '@caspian-explorer/script-caspian-store';

/**
 * Routing for the register, in the URL fragment.
 *
 * This used to be `memory-navigation.tsx`, and the route lived in a module
 * variable. That kept the shop's static host out of the routing problem, which
 * was the right worry -- but it cost every URL the register has. The address
 * bar never changed, Back left the app entirely, there were no bookmarks and no
 * deep links, and a reload always landed on the register no matter where the
 * cashier had been. Two comments in `pos-root.tsx` described "a cashier who
 * mistypes a URL" and "a till that bookmarked it", and neither could happen.
 *
 * The fragment gets all of that back and keeps the original worry answered.
 * The document requested is always `/pos/`; the part after `#` is never sent to
 * the server, so no host needs a rewrite rule, on any host, forever. History
 * routing would have needed one -- and the service worker cannot cover the gap,
 * because a first visit, cleared site data or a private window has no
 * controlling worker to fall back through.
 *
 * It also lines up with the offline shell: the only document the cache has to
 * hold is `/pos/`, so reloading a deep link works offline too, which History
 * routing could not have delivered without host configuration.
 *
 * Route strings are unchanged -- `/pos/store/abc` throughout -- so `PosRoot`'s
 * switch, `screenOf` and `stripLocalePrefix` never learn about any of this.
 * Moving to History routing later is this one file plus host config, with no
 * data migration; the cost of the fragment is a `#` in an address bar that a
 * till in a shop has no reason to look at.
 */

const HOME = '/pos';

/** `/pos/store/abc?q=1` -> `#/store/abc?q=1`, and `/pos` -> `#/`. */
function toHash(route: string): string {
  const rest = route.startsWith(HOME) ? route.slice(HOME.length) : route;
  return `#${rest || '/'}`;
}

/** `#/store/abc` -> `/pos/store/abc`, and an absent or bare hash -> `/pos`. */
function fromHash(hash: string): string {
  const rest = hash.replace(/^#/, '');
  if (!rest || rest === '/') return HOME;
  return `${HOME}${rest.startsWith('/') ? rest : `/${rest}`}`;
}

function currentRoute(): string {
  if (typeof window === 'undefined') return HOME;
  return fromHash(window.location.hash);
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  // `pushState` does not fire `hashchange`, and `popstate` covers the Back and
  // Forward buttons that are the whole point of this change.
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
  };
}

/**
 * `useSyncExternalStore` compares snapshots by identity, so this has to return
 * the same string for the same URL rather than deriving a fresh one each call.
 */
let cachedHash: string | null = null;
let cachedRoute = HOME;

function snapshot(): string {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  if (hash !== cachedHash) {
    cachedHash = hash;
    cachedRoute = fromHash(hash);
  }
  return cachedRoute;
}

function serverSnapshot(): string {
  return HOME;
}

/** Anything that is not an in-app route: http(s), mailto:, tel:, protocol-relative. */
function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function normalise(href: string): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed === '#') return currentRoute();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function go(href: string, mode: 'push' | 'replace'): void {
  const next = normalise(href);
  if (next === currentRoute()) return;
  const url = `${window.location.pathname}${window.location.search}${toHash(next)}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  // Neither pushState nor replaceState fires an event, so the store is told
  // by hand. The listeners above exist for the browser's own navigation.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function push(href: string): void {
  go(href, 'push');
}

export function replace(href: string): void {
  go(href, 'replace');
}

export function back(): void {
  // The browser's history stack, not a hand-rolled one. The array this replaces
  // could not see a Back press, so the two disagreed the moment anyone used the
  // browser's own button.
  window.history.back();
}

let cachedQuery: string | null = null;
let cachedParams = new URLSearchParams();

function searchParamsFor(current: string): URLSearchParams {
  const query = current.includes('?') ? current.slice(current.indexOf('?') + 1) : '';
  if (query !== cachedQuery) {
    cachedQuery = query;
    cachedParams = new URLSearchParams(query);
  }
  return cachedParams;
}

export function usePosNavigation(): CaspianNavigation {
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(
    () => ({
      pathname: current.split('?')[0],
      searchParams: searchParamsFor(current),
      push,
      replace,
      back,
    }),
    [current],
  );
}

export function PosLink({ href, children, onClick, ...rest }: CaspianLinkProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      // Let the browser handle a modified click: with a real fragment href,
      // middle-click, Ctrl-click and "copy link address" now produce something
      // that actually works.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      if (!isExternal(href)) push(href);
    },
    [href, onClick],
  );

  return (
    <a href={isExternal(href) ? href : toHash(normalise(href))} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export const posAdapters: FrameworkAdapters = {
  Link: PosLink,
  useNavigation: usePosNavigation,
};
