import type { CaspianLinkProps } from './types';

/**
 * Default Link implementation — a plain anchor tag. This causes a full page
 * reload on navigation. Consumers SHOULD pass their framework's Link via
 * CaspianStoreProvider's `adapters.Link` prop (e.g. `next/link` or
 * `react-router-dom`'s Link).
 */
export function DefaultCaspianLink({
  href,
  className,
  style,
  children,
  onClick,
  target,
  rel,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
}: CaspianLinkProps) {
  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={onClick}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
    >
      {children}
    </a>
  );
}
