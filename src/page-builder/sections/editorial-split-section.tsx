'use client';

import { useCaspianLink } from '../../provider/caspian-store-provider';
import { EditableImage, EditableText } from '../editor/editable';
import type { SectionComponentProps, SectionType } from '../types';

function EditorialSplitSection({ props, editing }: SectionComponentProps) {
  const Link = useCaspianLink();
  const s = (k: string) => String(props[k] ?? '');

  return (
    <section className="home__editorial">
      <div className="home__edit-text">
        <EditableText as="span" className="eyebrow" fieldKey="eyebrow" value={s('eyebrow')} />
        <EditableText as="h2" fieldKey="heading" value={s('heading')} />
        <EditableText as="p" fieldKey="body" value={s('body')} multiline />
        {editing ? (
          <span className="link">
            <EditableText fieldKey="linkLabel" value={s('linkLabel')} />
          </span>
        ) : (
          <Link href={s('linkHref') || '/journal'} className="link">
            {s('linkLabel')}
          </Link>
        )}
      </div>
      <EditableImage fieldKey="imageUrl" value={s('imageUrl')} />
    </section>
  );
}

export const EDITORIAL_SPLIT_SECTION: SectionType = {
  type: 'editorial-split',
  nameKey: 'pageBuilder.section.editorialSplit.name',
  descriptionKey: 'pageBuilder.section.editorialSplit.desc',
  fields: [
    { key: 'eyebrow', labelKey: 'pageBuilder.field.eyebrow', type: 'text', inline: true },
    { key: 'heading', labelKey: 'pageBuilder.field.heading', type: 'text', inline: true },
    { key: 'body', labelKey: 'pageBuilder.field.body', type: 'text', multiline: true, inline: true },
    { key: 'linkLabel', labelKey: 'pageBuilder.field.linkLabel', type: 'text', inline: true },
    { key: 'linkHref', labelKey: 'pageBuilder.field.linkHref', type: 'link' },
    { key: 'imageUrl', labelKey: 'pageBuilder.field.image', type: 'image' },
  ],
  defaultProps: {
    eyebrow: 'Notes from the atelier',
    heading: 'On the discipline of restraint.',
    body: 'Pieces designed for the next decade, not the next drop. We weigh additions against subtractions and ship only what earns its place.',
    linkLabel: 'Read the journal →',
    linkHref: '/journal',
    imageUrl: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=1200&q=80',
  },
  Component: EditorialSplitSection,
};
