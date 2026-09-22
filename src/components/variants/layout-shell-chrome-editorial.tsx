'use client';

import { useScriptSettings } from '../../context/script-settings-context';
import { useT } from '../../i18n/locale-context';
import { SiteFooter } from '../site-footer';
import { SiteHeader } from '../site-header';
import type { LayoutShellChromeProps } from './layout-shell-chrome-default';

/**
 * Editorial chrome — used by the `home-goods` template. Adds an
 * editorial sign-off block between the content and the standard
 * `<SiteFooter>`: a magazine-style typography break with a serif
 * pull-quote and attribution, the kind of marginalia that ends a
 * feature spread.
 *
 * The quote is `ScriptSettings.copy.quote` (falling back to the brand
 * description) and the attribution `copy.quoteAttribution` (falling back
 * to the brand name). Nothing to quote → no block. It used to ship a
 * fictional maker's quote signed "Workshop Six" on every store.
 *
 * No announcement bar above the header — the editorial identity reads
 * better when the page opens straight into navigation + brand rather
 * than a transactional strip.
 */
export function LayoutShellChromeEditorial({
  header,
  footer,
  contentPaddingY,
  children,
}: LayoutShellChromeProps) {
  const { settings } = useScriptSettings();
  const t = useT();
  const quote = settings.copy?.quote?.trim() || settings.brandDescription?.trim();
  const attribution =
    settings.copy?.quoteAttribution?.trim() ||
    (settings.brandName?.trim()
      ? t('home.quote.attributionFallback', { brand: settings.brandName.trim() })
      : '');
  return (
    <>
      {header !== null && <SiteHeader {...(header ?? {})} />}
      <div style={{ paddingTop: contentPaddingY, paddingBottom: contentPaddingY }}>
        {children}
      </div>
      {quote && (
        <section
          className="caspian-layout-editorial-signoff"
          style={{
            background: 'var(--caspian-background, #fdfaf4)',
            borderTop: '1px solid rgba(124, 93, 63, 0.18)',
            borderBottom: '1px solid rgba(124, 93, 63, 0.18)',
            padding: 'clamp(48px, 8vw, 96px) clamp(24px, 6vw, 80px)',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <blockquote
              style={{
                fontFamily: 'var(--caspian-font-headline, var(--caspian-font-family, inherit))',
                fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)',
                lineHeight: 1.4,
                fontWeight: 400,
                fontStyle: 'italic',
                margin: 0,
                color: 'var(--caspian-primary, #7c5d3f)',
              }}
            >
              {quote}
            </blockquote>
            {attribution && (
              <p
                style={{
                  marginTop: 18,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  color: 'var(--caspian-primary, #7c5d3f)',
                  opacity: 0.55,
                  textTransform: 'uppercase',
                }}
              >
                {attribution}
              </p>
            )}
          </div>
        </section>
      )}
      {footer !== null && <SiteFooter {...(footer ?? {})} />}
    </>
  );
}
