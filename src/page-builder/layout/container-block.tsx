'use client';

import { useT } from '../../i18n';
import type { BlockComponentProps, BlockType } from '../types';

/**
 * Container — a full-width band that stacks its children vertically. Useful for
 * grouping blocks so they share a background / padding (set on the Style tab).
 * Empty containers show a hint in edit mode so they stay selectable + droppable.
 */
function ContainerBlock({ childrenSlot, editing }: BlockComponentProps) {
  const t = useT();
  const empty = !childrenSlot;
  return (
    <div className="pb-container">
      {empty && editing ? <div className="pb-layout-empty">{t('pageBuilder.layout.empty')}</div> : childrenSlot}
    </div>
  );
}

export const CONTAINER_BLOCK: BlockType = {
  type: 'layout:container',
  category: 'layout',
  acceptsChildren: true,
  nameKey: 'pageBuilder.layout.container.name',
  descriptionKey: 'pageBuilder.layout.container.desc',
  fields: [],
  defaultProps: {},
  Component: ContainerBlock,
};
