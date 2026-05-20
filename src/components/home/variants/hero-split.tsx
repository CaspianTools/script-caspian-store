'use client';

import { useScriptSettings } from '../../../context/script-settings-context';
import { useCaspianImage, useCaspianLink } from '../../../provider/caspian-store-provider';
import { Button } from '../../../ui/button';
import { cn } from '../../../utils/cn';
import type { HeroTokens } from '../../../types';
import type { HeroProps } from '../hero';

/**
 * Two-column editorial hero — used by the `home-goods` template. 50/50
 * split on desktop with copy on the left and imagery on the right;
 * stacks vertically below ~840px (image top, copy below).
 *
 * Entrance animation is defined in the template's `css` field
 * (home-goods registers `@keyframes caspian-hero-split-copy-in` and
 * `caspian-hero-split-image-in`), scoped by
 * `[data-caspian-template="home-goods"]`. Class hooks below match those
 * keyframe selectors.
 *
 * The copy column uses the template's `--caspian-background` token as
 * the panel background so warm earth tones land naturally without
 * hardcoded colors.
 */
export function HeroSplit({ hero: override, className }: HeroProps) {
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
      className={cn('caspian-hero', 'caspian-hero-split', className)}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '70vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'var(--caspian-background, #fdfaf4)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @media (max-width: 840px) {
          .caspian-hero-split {
            grid-template-columns: 1fr !important;
            grid-template-rows: 50vh auto !important;
          }
          .caspian-hero-split-copy { order: 2 !important; }
          .caspian-hero-split-image { order: 1 !important; }
        }
      `}</style>

      <div
        className="caspian-hero-split-copy"
        style={{
          padding: 'clamp(32px, 6vw, 80px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 20,
        }}
      >
        <div
          className="caspian-hero-split-eyebrow"
          style={{
            fontSize: 12,
            letterSpacing: '0.18em',
            color: 'var(--caspian-primary, #7c5d3f)',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          A curated selection
        </div>
        <h1
          className="caspian-hero-split-title"
          style={{
            fontFamily: 'var(--caspian-font-headline, var(--caspian-font-family, inherit))',
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            margin: 0,
            color: 'var(--caspian-primary, #7c5d3f)',
            maxWidth: 540,
          }}
        >
          {hero.title}
        </h1>
        <p
          className="caspian-hero-split-subtitle"
          style={{
            fontSize: 'clamp(1rem, 1.6vw, 1.125rem)',
            color: 'var(--caspian-primary, #7c5d3f)',
            opacity: 0.78,
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 480,
          }}
        >
          {hero.subtitle}
        </p>
        {hero.cta && hero.ctaHref && (
          <div style={{ marginTop: 12 }}>
            <Link href={hero.ctaHref}>
              <Button size="lg">{hero.cta}</Button>
            </Link>
          </div>
        )}
      </div>

      <div
        className="caspian-hero-split-image"
        style={{ position: 'relative', minHeight: 320 }}
      >
        {hero.imageUrl ? (
          <Image src={hero.imageUrl} alt="" fill priority />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, var(--caspian-accent, #a07a4c) 0%, var(--caspian-primary, #7c5d3f) 100%)',
            }}
          />
        )}
      </div>
    </section>
  );
}
