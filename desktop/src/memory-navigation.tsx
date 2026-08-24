import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type {
  CaspianLinkProps,
  CaspianNavigation,
  FrameworkAdapters,
} from '@caspian-explorer/script-caspian-store';

/**
 * Routing for the bundled register.
 *
 * Tauri serves the bundle from a custom protocol with no SPA fallback, so the
 * default `window.location` adapter cannot be used: navigating to
 * `/pos/settings` would ask the protocol handler for a file that does not
 * exist and the window would go blank. The route therefore lives in module
 * state and never touches the URL bar the window does not have.
 *
 * The framework-adapter contract is the supported seam for this
 * (`src/primitives/types.ts`), which is why none of it needs a library change.
 */

const HOME = '/pos';

let route = HOME;
const stack: string[] = [HOME];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string {
  return route;
}

/** Anything that is not an in-app route: http(s), mailto:, tel:, protocol-relative. */
function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function normalise(href: string): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed === '#') return route;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function push(href: string): void {
  const next = normalise(href);
  if (next === route) return;
  stack.push(next);
  route = next;
  emit();
}

export function replace(href: string): void {
  const next = normalise(href);
  if (next === route) return;
  stack[stack.length - 1] = next;
  route = next;
  emit();
}

export function back(): void {
  if (stack.length < 2) return;
  stack.pop();
  route = stack[stack.length - 1];
  emit();
}

// `new URLSearchParams(...)` per render would hand every consumer a fresh
// object, so anything holding it in a dependency array would re-run forever.
// Cached on the query string it was parsed from.
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

export function useMemoryNavigation(): CaspianNavigation {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(
    () => ({
      pathname: current.split('?')[0],
      // Reactive, and deliberately not omitted: a real adapter that leaves this
      // out re-introduces issue #43, where URL-driven screens stop re-rendering.
      searchParams: searchParamsFor(current),
      push,
      replace,
      back,
    }),
    [current],
  );
}

export function MemoryLink({ href, children, onClick, ...rest }: CaspianLinkProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      // Always intercept. An offline till has no address bar and no browser
      // back button, so letting the webview follow any href -- external or not
      // -- is a one-way trip out of the register with no way back short of
      // restarting the app. External links are simply inert here.
      event.preventDefault();
      if (!isExternal(href)) push(href);
    },
    [href, onClick],
  );

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export const memoryAdapters: FrameworkAdapters = {
  Link: MemoryLink,
  useNavigation: useMemoryNavigation,
};
