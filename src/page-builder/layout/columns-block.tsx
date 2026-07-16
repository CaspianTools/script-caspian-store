'use client';

import type { BlockComponentProps, BlockType } from '../types';
import { COLUMN_BLOCK } from './column-block';

/**
 * Columns — a horizontal row whose children are Column blocks laid out as
 * equal-width grid tracks (stacking on narrow screens via CSS). Inserting one
 * seeds two empty columns; drag widgets into a column, or select a column and
 * insert into it. Add/remove columns by inserting/removing Column blocks.
 */
function ColumnsBlock({ childrenSlot }: BlockComponentProps) {
  return <div className="pb-row">{childrenSlot}</div>;
}

export const COLUMNS_BLOCK: BlockType = {
  type: 'layout:columns',
  category: 'layout',
  acceptsChildren: true,
  defaultChildren: [COLUMN_BLOCK.type, COLUMN_BLOCK.type],
  nameKey: 'pageBuilder.layout.columns.name',
  descriptionKey: 'pageBuilder.layout.columns.desc',
  fields: [],
  defaultProps: {},
  Component: ColumnsBlock,
};
