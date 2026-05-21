'use client';

import { SiteFooter } from '../site-footer';
import { SiteHeader } from '../site-header';
import type { LayoutShellChromeProps } from './layout-shell-chrome-default';

/**
 * Tech chrome — used by the `electronics-tech` template. Wraps the
 * standard `<SiteHeader>` + content + `<SiteFooter>` with two
 * template-specific decorative bands:
 *
 * - **Top announcement bar.** A thin monospace strip above the header
 *   with rotating spec-style callouts ("// FREE SHIPPING OVER $50",
 *   "// 12 MONTH WARRANTY", etc.). Sells the brand identity in the
 *   first 8px of the viewport.
 * - **Pre-footer spec strip.** A second monospace band just above the
 *   footer reinforcing the same identity at the bottom of the page,
 *   plus a quiet `// Built for daily use.` sign-off.
 *
 * The standard header and footer components handle their own internals
 * (nav, cart, search, social links, etc.) — this variant only adds
 * decoration; it doesn't replace them. That keeps the surface area
 * narrow and means template authors don't have to re-implement a full
 * header to ship a distinctive top-of-page identity.
 */
export function LayoutShellChromeTech({
  header,
  footer,
  contentPaddingY,
  children,
}: LayoutShellChromeProps) {
  return (
    <>
      <div
        className="caspian-layout-tech-announce"
        style={{
          background: '#0a0a0a',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'center',
          gap: 28,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'var(--caspian-accent, #22c55e)' }}>// FREE SHIPPING $50+</span>
        <span>// 12mo warranty</span>
        <span>// Hand-tested</span>
      </div>
      {header !== null && <SiteHeader {...(header ?? {})} />}
      <div style={{ paddingTop: contentPaddingY, paddingBottom: contentPaddingY }}>
        {children}
      </div>
      <div
        className="caspian-layout-tech-prefooter"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 16px',
          textAlign: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          letterSpacing: '0.2em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
        }}
      >
        <p style={{ margin: 0 }}>// Built for daily use.</p>
        <p style={{ margin: '6px 0 0', fontSize: 10, opacity: 0.7 }}>
          Every product tested for ≥30 days before launch.
        </p>
      </div>
      {footer !== null && <SiteFooter {...(footer ?? {})} />}
    </>
  );
}
