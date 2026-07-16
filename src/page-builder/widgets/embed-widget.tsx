'use client';

import { useT } from '../../i18n';
import type { BlockComponentProps, BlockType } from '../types';

/**
 * Embed widget — an `<iframe>` from a single URL (YouTube/Vimeo embed links,
 * Google Maps, etc.) at a chosen aspect ratio. Deliberately URL-only rather
 * than raw HTML: it avoids the arbitrary-markup XSS surface while covering the
 * common "drop in a video/map" case. In edit mode pointer events on the frame
 * are disabled so a click selects the block instead of interacting with it.
 */
function EmbedWidget({ props, editing }: BlockComponentProps) {
  const t = useT();
  const src = String(props.src ?? '');
  const title = String(props.title ?? 'Embedded content');
  const ratio = String(props.ratio ?? '16 / 9');

  if (!src) {
    if (!editing) return null;
    return <div className="pb-w-embed pb-w-embed--empty">{t('pageBuilder.widget.embed.empty')}</div>;
  }

  return (
    <div className="pb-w-embed" style={{ aspectRatio: ratio }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={editing ? { pointerEvents: 'none' } : undefined}
      />
    </div>
  );
}

export const EMBED_WIDGET: BlockType = {
  type: 'widget:embed',
  category: 'widget',
  nameKey: 'pageBuilder.widget.embed.name',
  descriptionKey: 'pageBuilder.widget.embed.desc',
  fields: [
    {
      key: 'src',
      labelKey: 'pageBuilder.field.embedSrc',
      type: 'link',
      placeholderKey: 'pageBuilder.field.embedSrcPlaceholder',
    },
    { key: 'title', labelKey: 'pageBuilder.field.embedTitle', type: 'text' },
    {
      key: 'ratio',
      labelKey: 'pageBuilder.field.aspectRatio',
      type: 'select',
      options: [
        { value: '16 / 9', labelKey: 'pageBuilder.aspectRatio.wide' },
        { value: '4 / 3', labelKey: 'pageBuilder.aspectRatio.classic' },
        { value: '1 / 1', labelKey: 'pageBuilder.aspectRatio.square' },
      ],
    },
  ],
  defaultProps: {
    src: '',
    title: 'Embedded content',
    ratio: '16 / 9',
  },
  Component: EmbedWidget,
};
