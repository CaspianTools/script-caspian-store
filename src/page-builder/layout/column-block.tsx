'use client';

import { useT } from '../../i18n';
import type { BlockComponentProps, BlockType } from '../types';

/**
 * Column — one cell of a Columns row. Stacks its own children vertically and
 * sizes itself via the parent grid. Only ever lives inside a Columns block.
 */
function ColumnBlock({ childrenSlot, editing }: BlockComponentProps) {
  const t = useT();
  const empty = !childrenSlot;
  return (
    <div className="pb-column">
      {empty && editing ? (
        <div className="pb-layout-empty pb-layout-empty--column">{t('pageBuilder.layout.dropHere')}</div>
      ) : (
        childrenSlot
      )}
    </div>
  );
}

export const COLUMN_BLOCK: BlockType = {
  type: 'layout:column',
  category: 'layout',
  acceptsChildren: true,
  styleable: true,
  nameKey: 'pageBuilder.layout.column.name',
  descriptionKey: 'pageBuilder.layout.column.desc',
  fields: [],
  defaultProps: {},
  Component: ColumnBlock,
};
