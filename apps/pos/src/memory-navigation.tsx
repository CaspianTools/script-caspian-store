import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type {
  CaspianLinkProps,
  CaspianNavigation,
  FrameworkAdapters,
} from '@caspian-explorer/script-caspian-store';

/**
 * Routing for the browser-based PWA register.
 *
 * The installed till runs as a single-purpose app, so navigation lives in
 * module state rather than the URL bar. This avoids needing a server-side
 * SPA fallback for `/pos/settings` etc. when the app is served from a
 * static host, and it keeps the route stable while a sale is in progress.
 *
 * The framework-adapter contract is the supported seam for this
 * (`src/primitives/types.ts`), so no library change is required.
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
