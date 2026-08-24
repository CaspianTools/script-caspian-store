import type { ComponentType, ReactNode } from 'react';

/**
 * Minimal contract the host framework must satisfy so Caspian Store components
 * can render links, images, and navigate without depending on next/link, next/image
 * or next/navigation.
 *
 * Consumers pass these via <CaspianStoreProvider adapters={{ ... }}>.
 */

export interface CaspianLinkProps {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  target?: string;
  rel?: string;
  'aria-label'?: string;
  /**
   * Marks the link the reader is currently on. Optional so an adapter written
   * against an older version of this contract still satisfies it; an adapter
   * that does not forward it loses the announcement, not the link.
   */
  'aria-current'?: 'page' | 'step' | 'location' | 'true' | 'false';
}

export type CaspianLinkComponent = ComponentType<CaspianLinkProps>;

export interface CaspianImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  sizes?: string;
  fill?: boolean;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
}

export type CaspianImageComponent = ComponentType<CaspianImageProps>;

export interface CaspianNavigation {
  /** Full pathname of the current route, e.g. `/product/abc`. */
  pathname: string;
  /**
   * Current URL query string as a `URLSearchParams` — must be a *reactive*
   * source in real framework adapters so URL-driven components re-render on
   * client-side navigation. Populate from `useSearchParams()` in Next.js.
   * Components that read this must tolerate it being `undefined` (older
   * consumer adapters may not supply it) and fall back gracefully.
   */
  searchParams?: URLSearchParams;
  /** Push a new route. */
  push: (href: string) => void;
  /** Replace the current route. */
  replace: (href: string) => void;
  /** Navigate back in history. */
  back: () => void;
}

export type UseCaspianNavigation = () => CaspianNavigation;

export interface FrameworkAdapters {
  Link: CaspianLinkComponent;
  Image?: CaspianImageComponent;
  useNavigation: UseCaspianNavigation;
}
