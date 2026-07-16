'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { cn } from '../../utils/cn';
import { getBlockType } from '../catalog';
import type { CanvasDndAdapter } from '../block-renderer';
import type { PageBlock } from '../../types';
import { useHomeEditor } from './home-editor-context';

/** Draggable-library item ids are prefixed so drops can tell "insert new" from "move". */
export const NEW_DRAG_PREFIX = 'new:';

function SortableList({ itemIds, children }: { itemIds: string[]; children: ReactNode }) {
  // Context only, no DOM wrapper — the canvas layout is untouched.
  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

function DraggableWrapper({
  block,
  className,
  style,
  onSelect,
  children,
}: {
  block: PageBlock;
  className: string;
  style: CSSProperties;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const dndStyle: CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isDragging && 'pb-edit-section--dragging')}
      style={dndStyle}
      data-pb-id={block.id}
      onClick={onSelect}
    >
      {/* Handle-only drag so the block body stays clickable / caret-editable. */}
      <button
        type="button"
        className="pb-edit-section__handle"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {children}
    </div>
  );
}

export const canvasDndAdapter: CanvasDndAdapter = { SortableList, DraggableWrapper };

/**
 * The single DndContext spanning the canvas + editor chrome while editing. Drops
 * route to `dropBlock` (reorder / move an existing block — drop onto a block to
 * sit before it) or `insertNewBlock` (drag-from-library, active id
 * `new:<type>`). Sets the editor drag flag so autosave pauses mid-drag.
 */
export function CanvasDndProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { dropBlock, insertNewBlock, setDragging } = useHomeEditor();
  const [dragType, setDragType] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setDragging(true);
    const id = String(e.active.id);
    setDragType(id.startsWith(NEW_DRAG_PREFIX) ? id.slice(NEW_DRAG_PREFIX.length) : null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(false);
    const type = dragType;
    setDragType(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith(NEW_DRAG_PREFIX)) {
      if (type) insertNewBlock(type, overId);
    } else if (activeId !== overId) {
      dropBlock(activeId, overId);
    }
  };

  const onDragCancel = () => {
    setDragging(false);
    setDragType(null);
  };

  const ghostEntry = dragType ? getBlockType(dragType) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {ghostEntry ? <div className="pb-drag-ghost">{t(ghostEntry.nameKey)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
