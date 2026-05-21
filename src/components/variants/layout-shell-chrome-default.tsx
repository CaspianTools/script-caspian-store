'use client';

import type { ReactNode } from 'react';
import { SiteFooter, type SiteFooterProps } from '../site-footer';
import { SiteHeader, type SiteHeaderProps } from '../site-header';

export interface LayoutShellChromeProps {
  header: SiteHeaderProps | null;
  footer: SiteFooterProps | null;
  contentPaddingY: number;
  children: ReactNode;
}

/**
 * Default chrome — the storefront's v8.x header + content + footer
 * composition extracted into its own variant. Used by the default
 * storefront and the `fashion-minimal` template.
 *
 * The chrome is the part of `<LayoutShell>` that templates can override.
 * Bypass-prefix routing, coming-soon gating, and the double-mount
 * sentinel stay in the outer `<LayoutShell>` dispatcher — those concerns
 * are framework-level and not something individual templates should
 * re-implement. Variants only get to choose how the chrome is composed.
 */
export function LayoutShellChromeDefault({
  header,
  footer,
  contentPaddingY,
  children,
}: LayoutShellChromeProps) {
  return (
    <>
      {header !== null && <SiteHeader {...(header ?? {})} />}
      <div style={{ paddingTop: contentPaddingY, paddingBottom: contentPaddingY }}>
        {children}
      </div>
      {footer !== null && <SiteFooter {...(footer ?? {})} />}
    </>
  );
}
