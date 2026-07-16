'use client';

import { EditableImage, EditableText } from '../editor/editable';
import type { SectionComponentProps, SectionType } from '../types';

function StoryPanelSection({ props }: SectionComponentProps) {
  const s = (k: string) => String(props[k] ?? '');

  return (
    <section className="home__story">
      <EditableImage fieldKey="imageUrl" value={s('imageUrl')} />
      <div>
        <EditableText as="span" className="eyebrow" fieldKey="eyebrow" value={s('eyebrow')} />
        <EditableText as="h2" fieldKey="heading" value={s('heading')} />
        <EditableText as="p" fieldKey="body" value={s('body')} multiline />
      </div>
    </section>
  );
}

export const STORY_PANEL_SECTION: SectionType = {
  type: 'story-panel',
  nameKey: 'pageBuilder.section.storyPanel.name',
  descriptionKey: 'pageBuilder.section.storyPanel.desc',
  fields: [
    { key: 'imageUrl', labelKey: 'pageBuilder.field.image', type: 'image' },
    { key: 'eyebrow', labelKey: 'pageBuilder.field.eyebrow', type: 'text', inline: true },
    { key: 'heading', labelKey: 'pageBuilder.field.heading', type: 'text', inline: true },
    { key: 'body', labelKey: 'pageBuilder.field.body', type: 'text', multiline: true, inline: true },
  ],
  defaultProps: {
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=1400&q=80',
    eyebrow: 'House values',
    heading: 'Six pieces a year, made well.',
    body: 'We design for the next decade, not the next drop. Pieces are repaired in-house — bring yours in for a stitch, or send by post.',
  },
  Component: StoryPanelSection,
};
