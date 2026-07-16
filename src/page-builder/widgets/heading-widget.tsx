'use client';

import { EditableText } from '../editor/editable';
import type { BlockComponentProps, BlockType } from '../types';

type Level = 'h2' | 'h3' | 'h4';

/**
 * Heading widget — an inline-editable title at one of three levels. Atomic
 * building block introduced with the v9.4 drag-and-drop builder.
 */
function HeadingWidget({ props }: BlockComponentProps) {
  const level = (String(props.level ?? 'h2') as Level) || 'h2';
  const align = String(props.align ?? 'left');
  return (
    <EditableText
      as={level}
      className="pb-w-heading"
      style={{ textAlign: align as 'left' | 'center' | 'right' }}
      fieldKey="text"
      value={String(props.text ?? '')}
    />
  );
}

export const HEADING_WIDGET: BlockType = {
  type: 'widget:heading',
  category: 'widget',
  nameKey: 'pageBuilder.widget.heading.name',
  descriptionKey: 'pageBuilder.widget.heading.desc',
  fields: [
    { key: 'text', labelKey: 'pageBuilder.field.text', type: 'text', inline: true },
    {
      key: 'level',
      labelKey: 'pageBuilder.field.headingLevel',
      type: 'select',
      options: [
        { value: 'h2', labelKey: 'pageBuilder.headingLevel.h2' },
        { value: 'h3', labelKey: 'pageBuilder.headingLevel.h3' },
        { value: 'h4', labelKey: 'pageBuilder.headingLevel.h4' },
      ],
    },
    {
      key: 'align',
      labelKey: 'pageBuilder.field.align',
      type: 'select',
      options: [
        { value: 'left', labelKey: 'pageBuilder.align.left' },
        { value: 'center', labelKey: 'pageBuilder.align.center' },
        { value: 'right', labelKey: 'pageBuilder.align.right' },
      ],
    },
  ],
  defaultProps: {
    text: 'A new heading',
    level: 'h2',
    align: 'left',
  },
  Component: HeadingWidget,
};
