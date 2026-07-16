'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useT } from '../../i18n';
import { Switch } from '../../ui';
import { cn } from '../../utils/cn';
import { getBlockType } from '../catalog';
import { CONTAINER_PREFIX, ROOT_ID } from '../block-tree';
import type { PageBlock } from '../../types';
import { useHomeEditor } from './home-editor-context';

/**
 * The block-tree side panel. A single `DndContext` spans the whole tree; each
 * container (the root plus every `acceptsChildren` block) is a droppable with
 * its own `SortableContext`, so dragging reorders within a level and moves
 * between levels — drop over a block to sit before it, or over a container's
 * area to append into it. Moves are committed once on drop (one undo step).
 */
export function BlockTreePanel() {
  const t = useT();
  const { blocks, dropBlock } = useHomeEditor();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) dropBlock(String(active.id), String(over.id));
  };

  return (
    <div className="pb-panel__section">
      <h3 className="pb-panel__title">{t('pageBuilder.blocks')}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <TreeLevel parentId={ROOT_ID} blocks={blocks} />
      </DndContext>
    </div>
  );
}

function TreeLevel({ parentId, blocks }: { parentId: string; blocks: PageBlock[] }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: CONTAINER_PREFIX + parentId });
  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={cn('pb-tree', isOver && 'pb-tree--over')}>
        {blocks.map((b) => (
          <TreeRow key={b.id} block={b} />
        ))}
        {blocks.length === 0 && <li className="pb-tree-empty">{t('pageBuilder.layout.dropHere')}</li>}
      </ul>
    </SortableContext>
  );
}

function TreeRow({ block }: { block: PageBlock }) {
  const t = useT();
  const { selectedId, select, setVisible, removeBlock } = useHomeEditor();
  const entry = getBlockType(block.type);
  const acceptsChildren = Boolean(entry?.acceptsChildren);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('pb-tree-item', isDragging && 'pb-tree-item--dragging')}
    >
      <div
        className={cn(
          'pb-panel__row',
          selectedId === block.id && 'pb-panel__row--active',
          !block.visible && 'pb-panel__row--hidden',
        )}
        onClick={() => select(block.id)}
      >
        <button
          type="button"
          className="pb-drag-handle"
          aria-label={t('pageBuilder.drag')}
          title={t('pageBuilder.drag')}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="pb-panel__row-name">{entry ? t(entry.nameKey) : block.type}</span>
        <span className="pb-panel__row-actions" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={block.visible}
            onChange={(v) => setVisible(block.id, v)}
            ariaLabel={t('pageBuilder.visible')}
          />
          <button
            type="button"
            title={t('pageBuilder.remove')}
            aria-label={t('pageBuilder.remove')}
            onClick={() => removeBlock(block.id)}
          >
            ✕
          </button>
        </span>
      </div>
      {acceptsChildren && (
        <div className="pb-tree-children">
          <TreeLevel parentId={block.id} blocks={block.children ?? []} />
        </div>
      )}
    </li>
  );
}
