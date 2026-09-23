'use client';

import type { SiteSettings } from '../types';
import { useT } from '../i18n/locale-context';

export interface ComingSoonSplashProps {
  settings: Pick<SiteSettings, 'brandName' | 'brandDescription' | 'logoUrl' | 'comingSoon'>;
}

/**
 * Fullscreen "launching soon" splash rendered by `<LayoutShell>` when
 * `SiteSettings.comingSoon.enabled` is true and the current route is not
 * admin / preview. Kept intentionally minimal: brand mark, message, and a
 * quiet footer — merchants who want richer splashes can replace the storefront
 * root with their own layout.
 */
export function ComingSoonSplash({ settings }: ComingSoonSplashProps) {
  const t = useT();
  const message = settings.comingSoon?.message?.trim() || t('comingSoon.defaultMessage');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 4vw, 24px)',
        boxSizing: 'border-box',
        background: 'var(--caspian-background, #fafafa)',
        color: 'inherit',
        textAlign: 'center',
        gap: 24,
      }}
      role="main"
      aria-label={t('comingSoon.ariaLabel')}
    >
      {settings.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.logoUrl}
          alt={settings.brandName || t('comingSoon.logoAlt')}
          style={{ maxHeight: 64, maxWidth: 280, objectFit: 'contain' }}
        />
      )}
      {!settings.logoUrl && settings.brandName && (
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
          {settings.brandName}
        </h1>
      )}
      <p
        style={{
          fontSize: 18,
          lineHeight: 1.5,
          margin: 0,
          maxWidth: 540,
          opacity: 0.72,
          whiteSpace: 'pre-wrap',
        }}
      >
        {message}
      </p>
      {settings.brandDescription && (
        <p
          style={{
            fontSize: 14,
            opacity: 0.5,
            margin: 0,
            maxWidth: 480,
          }}
        >
          {settings.brandDescription}
        </p>
      )}
    </div>
  );
}
