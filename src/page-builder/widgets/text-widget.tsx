'use client';

import { HtmlContent } from '../../ui';
import { useT } from '../../i18n';
import type { BlockComponentProps, BlockType } from '../types';

/**
 * Rich-text widget. The body is authored in the side panel via the
 * `richtext` field control (`<RichTextEditor>`) and stored as sanitized HTML;
 * the canvas renders it through `<HtmlContent>` (sanitized again at render).
 * When empty in edit mode it shows a hint so the block stays selectable.
 */
function TextWidget({ props, editing }: BlockComponentProps) {
  const t = useT();
  const html = String(props.html ?? '');
  if (!html) {
    if (!editing) return null;
    return <p className="pb-w-text pb-w-text--empty">{t('pageBuilder.widget.text.empty')}</p>;
  }
  return <HtmlContent className="pb-w-text" html={html} />;
}

export const TEXT_WIDGET: BlockType = {
  type: 'widget:text',
  category: 'widget',
  nameKey: 'pageBuilder.widget.text.name',
  descriptionKey: 'pageBuilder.widget.text.desc',
  fields: [{ key: 'html', labelKey: 'pageBuilder.field.richText', type: 'richtext' }],
  defaultProps: {
    html: '<p>Write something worth reading.</p>',
  },
  Component: TextWidget,
};
