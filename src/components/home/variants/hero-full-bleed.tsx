'use client';

import { useScriptSettings } from '../../../context/script-settings-context';
import { useCaspianImage, useCaspianLink } from '../../../provider/caspian-store-provider';
import { Button } from '../../../ui/button';
import { cn } from '../../../utils/cn';
import type { HeroTokens } from '../../../types';
import type { HeroProps } from '../hero';

/**
 * Full-bleed product-forward hero — used by the `electronics-tech`
 * template. Cinematic 80vh slab with a slow ken-burns zoom on the
 * background image, bottom-left typography, monospace subtitle for the
 * tech aesthetic, and a single CTA pill in the template's accent color.
 *
 * The ken-burns animation is defined in the template's `css` field
 * (electronics-tech registers `@keyframes caspian-hero-fullbleed-zoom`),
 * scoped by `[data-caspian-template="electronics-tech"]`. The class
 * hooks below are the contract between this component and the template
 * CSS — if you rename them you also need to update the template.
 */
export function HeroFullBleed({ hero: override, className }: HeroProps) {
  const { settings } = useScriptSettings();
  const Image = useCaspianImage();
  const Link = useCaspianLink();
  const hero: HeroTokens = {
    title: override?.title ?? settings.hero?.title ?? '',
    subtitle: override?.subtitle ?? settings.hero?.subtitle ?? '',
    cta: override?.cta ?? settings.hero?.cta ?? '',
    ctaHref: override?.ctaHref ?? settings.hero?.ctaHref ?? '/products',
    imageUrl: override?.imageUrl ?? settings.hero?.imageUrl,
  };

  return (
    <section
      className={cn('caspian-hero', 'caspian-hero-fullbleed', className)}
      style={{
        position: 'relative',
        width: '100%',
        height: '80vh',
        minHeight: 520,
        display: 'flex',
        alignItems: 'flex-end',
        color: '#fff',
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      <div
        className="caspian-hero-fullbleed-bg"
        style={{ position: 'absolute', inset: 0 }}
      >
        {hero.imageUrl ? (
          <Image src={hero.imageUrl} alt="" fill priority />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at center, #1a1a1a 0%, #0a0a0a 100%)',
            }}
          />
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0) 75%)',
        }}
      />
      <div
        className="caspian-hero-fullbleed-inner"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 32px 64px',
        }}
      >
        <div
          className="caspian-hero-fullbleed-eyebrow"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
            letterSpacing: '0.2em',
            color: 'var(--caspian-accent, #22c55e)',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          // {hero.subtitle ? hero.subtitle.slice(0, 40) : 'Now shipping'}
        </div>
        <h1
          className="caspian-hero-fullbleed-title"
          style={{
            fontFamily: 'var(--caspian-font-headline, inherit)',
            fontSize: 'clamp(2.25rem, 6vw, 5rem)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: 0,
            maxWidth: 720,
          }}
        >
          {hero.title}
        </h1>
        <p
          className="caspian-hero-fullbleed-subtitle"
          style={{
            fontSize: 'clamp(0.95rem, 1.5vw, 1.0625rem)',
            marginTop: 16,
            color: 'rgba(255,255,255,0.78)',
            maxWidth: 560,
            lineHeight: 1.55,
          }}
        >
          {hero.subtitle}
        </p>
        {hero.cta && hero.ctaHref && (
          <div style={{ marginTop: 28 }}>
            <Link href={hero.ctaHref}>
              <Button size="lg">{hero.cta} →</Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
