'use client';

import { useCaspianLink } from '../../provider/caspian-store-provider';
import { cn } from '../../utils/cn';
import { EditableImage, EditableText } from '../editor/editable';
import type { SectionComponentProps, SectionType } from '../types';

function HeroSection({ props, variant, editing, siteSettings }: SectionComponentProps) {
  const Link = useCaspianLink();
  const s = (k: string) => String(props[k] ?? '');
  const brand = siteSettings?.brandName?.trim() || 'Luivante';

  return (
    <section className={cn('home__hero', variant === 'media-left' && 'home__hero--media-left')}>
      <div className="home__hero-text">
        <EditableText as="span" className="eyebrow" fieldKey="eyebrow" value={s('eyebrow')} />
        <h1 className="home__hero-h">
          <EditableText as="span" fieldKey="headlinePre" value={s('headlinePre')} />
          <br />
          <EditableText as="span" fieldKey="headlineMid" value={s('headlineMid')} />
          <br />
          <EditableText as="em" fieldKey="headlinePost" value={s('headlinePost')} />
        </h1>
        <EditableText as="p" fieldKey="body" value={s('body')} multiline />
        <div className="home__hero-cta">
          {editing ? (
            <>
              <span className="btn btn--primary">
                <EditableText fieldKey="primaryCtaLabel" value={s('primaryCtaLabel')} />
              </span>
              <span className="btn btn--ghost">
                <EditableText fieldKey="secondaryCtaLabel" value={s('secondaryCtaLabel')} />
              </span>
            </>
          ) : (
            <>
              <Link href={s('primaryCtaHref') || '/shop'} className="btn btn--primary">
                {s('primaryCtaLabel')}
              </Link>
              <Link href={s('secondaryCtaHref') || '/journal'} className="btn btn--ghost">
                {s('secondaryCtaLabel')}
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="home__hero-media">
        <EditableImage fieldKey="imageUrl" value={s('imageUrl')} />
        <span className="home__hero-tag">{brand} · Atelier</span>
      </div>
    </section>
  );
}

export const HERO_SECTION: SectionType = {
  type: 'hero',
  nameKey: 'pageBuilder.section.hero.name',
  descriptionKey: 'pageBuilder.section.hero.desc',
  variants: [
    { id: 'media-right', labelKey: 'pageBuilder.hero.variant.mediaRight' },
    { id: 'media-left', labelKey: 'pageBuilder.hero.variant.mediaLeft' },
  ],
  fields: [
    { key: 'eyebrow', labelKey: 'pageBuilder.field.eyebrow', type: 'text', inline: true },
    { key: 'headlinePre', labelKey: 'pageBuilder.field.headlinePre', type: 'text', inline: true },
    { key: 'headlineMid', labelKey: 'pageBuilder.field.headlineMid', type: 'text', inline: true },
    { key: 'headlinePost', labelKey: 'pageBuilder.field.headlinePost', type: 'text', inline: true },
    { key: 'body', labelKey: 'pageBuilder.field.body', type: 'text', multiline: true, inline: true },
    { key: 'primaryCtaLabel', labelKey: 'pageBuilder.field.primaryCtaLabel', type: 'text', inline: true },
    { key: 'primaryCtaHref', labelKey: 'pageBuilder.field.primaryCtaHref', type: 'link' },
    { key: 'secondaryCtaLabel', labelKey: 'pageBuilder.field.secondaryCtaLabel', type: 'text', inline: true },
    { key: 'secondaryCtaHref', labelKey: 'pageBuilder.field.secondaryCtaHref', type: 'link' },
    { key: 'imageUrl', labelKey: 'pageBuilder.field.image', type: 'image' },
  ],
  defaultProps: {
    eyebrow: 'New season',
    headlinePre: 'A wardrobe',
    headlineMid: 'of considered',
    headlinePost: 'permanence.',
    body: 'Garments built once, worn often. Traceable to the mill.',
    primaryCtaLabel: 'Shop the collection',
    primaryCtaHref: '/shop',
    secondaryCtaLabel: 'The look book →',
    secondaryCtaHref: '/journal',
    imageUrl: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=1400&q=80',
  },
  singleton: true,
  Component: HeroSection,
};
