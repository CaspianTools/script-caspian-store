'use client';

import type { BlockComponentProps, BlockType } from '../types';

/**
 * Spacer widget — vertical whitespace of a configurable height. In edit mode
 * the selection wrapper makes the otherwise-invisible block clickable.
 */
function SpacerWidget({ props }: BlockComponentProps) {
  const height = Number(props.height ?? 48);
  return <div className="pb-w-spacer" style={{ height: `${height}px` }} aria-hidden />;
}

export const SPACER_WIDGET: BlockType = {
  type: 'widget:spacer',
  category: 'widget',
  styleable: false,
  nameKey: 'pageBuilder.widget.spacer.name',
  descriptionKey: 'pageBuilder.widget.spacer.desc',
  fields: [
    {
      key: 'height',
      labelKey: 'pageBuilder.field.height',
      type: 'number',
      min: 0,
      max: 400,
      step: 4,
    },
  ],
  defaultProps: { height: 48 },
  Component: SpacerWidget,
};
