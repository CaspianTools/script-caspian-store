import { useMemo, useSyncExternalStore } from 'react';
import type { CaspianNavigation, UseCaspianNavigation } from './types';

// The provider's LocationChangeBridge fires `caspian:locationchange` after
// every pushState/replaceState; popstate covers back/forward.
function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener('caspian:locationchange', onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('caspian:locationchange', onChange);
  };
}

const getSearch = () => window.location.search;
const getPathname = () => window.location.pathname;
const serverSearch = () => '';
const serverPathname = () => '/';

/**
 * Default navigation hook — reads from window.location and dispatches full-page
 * navigations via window.location.href. Consumers should pass a real hook via
 * `adapters.useNavigation` for SPA-style transitions.
 */
export const useDefaultCaspianNavigation: UseCaspianNavigation = (): CaspianNavigation => {
  const search = useSyncExternalStore(subscribe, getSearch, serverSearch);
  const pathname = useSyncExternalStore(subscribe, getPathname, serverPathname);
  // Keyed on the query string so effects that depend on `searchParams` only
  // re-run when the URL actually changes, not on every render.
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  return {
    pathname,
    searchParams,
    push: (href: string) => {
      if (typeof window !== 'undefined') window.location.href = href;
    },
    replace: (href: string) => {
      if (typeof window !== 'undefined') window.location.replace(href);
    },
    back: () => {
      if (typeof window !== 'undefined') window.history.back();
    },
  };
};
