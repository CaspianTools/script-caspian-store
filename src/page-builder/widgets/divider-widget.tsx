'use client';

import type { BlockComponentProps, BlockType } from '../types';

/** Divider widget — a thin horizontal rule between blocks. */
function DividerWidget(_props: BlockComponentProps) {
  return <hr className="pb-w-divider" />;
}

export const DIVIDER_WIDGET: BlockType = {
  type: 'widget:divider',
  category: 'widget',
  styleable: false,
  nameKey: 'pageBuilder.widget.divider.name',
  descriptionKey: 'pageBuilder.widget.divider.desc',
  fields: [],
  defaultProps: {},
  Component: DividerWidget,
};
