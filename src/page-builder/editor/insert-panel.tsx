'use client';

import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useT } from '../../i18n';
import { Input } from '../../ui';
import { cn } from '../../utils/cn';
import { listBlockTypesByCategory } from '../catalog';
import type { BlockCategory, BlockType } from '../types';
import { NEW_DRAG_PREFIX } from './canvas-dnd';
import { useHomeEditor } from './home-editor-context';

const GROUPS: { category: BlockCategory; labelKey: string }[] = [
  { category: 'section', labelKey: 'pageBuilder.group.sections' },
  { category: 'layout', labelKey: 'pageBuilder.group.layout' },
  { category: 'widget', labelKey: 'pageBuilder.group.widgets' },
];

/** Fallback glyph per category when a block declares no `icon`. */
const CATEGORY_GLYPH: Record<BlockCategory, string> = {
  section: '▤',
  layout: '▥',
  widget: '◻',
};

/**
 * Block library. Lists every catalog entry grouped by category with a search
 * filter and a per-block glyph. Click to insert relative to the selection, OR
 * drag an item onto the canvas to drop it exactly where you want.
 */
export function InsertPanel() {
  const t = useT();
  const { blocks, insertBlock } = useHomeEditor();
  const present = new Set(blocks.map((b) => b.type));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matches = (e: BlockType) =>
    !q || t(e.nameKey).toLowerCase().includes(q) || t(e.descriptionKey).toLowerCase().includes(q);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, items: listBlockTypesByCategory(g.category).filter(matches) })).filter(
        (g) => g.items.length > 0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );

  return (
    <div className="pb-panel__section">
      <h3 className="pb-panel__title">{t('pageBuilder.addBlock')}</h3>
      <Input
        className="pb-insert-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('pageBuilder.searchBlocks')}
        aria-label={t('pageBuilder.searchBlocks')}
      />
      {groups.length === 0 ? (
        <p className="pb-panel__note">{t('pageBuilder.noBlocksFound')}</p>
      ) : (
        groups.map((g) => (
          <div key={g.category} className="pb-insert-group">
            <p className="pb-insert-group__label">{t(g.labelKey)}</p>
            <div className="pb-insert-grid">
              {g.items.map((e) => (
                <InsertItem
                  key={e.type}
                  entry={e}
                  glyph={e.icon ?? CATEGORY_GLYPH[g.category]}
                  disabled={Boolean(e.singleton) && present.has(e.type)}
                  onInsert={() => insertBlock(e.type)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function InsertItem({
  entry,
  glyph,
  disabled,
  onInsert,
}: {
  entry: BlockType;
  glyph: string;
  disabled: boolean;
  onInsert: () => void;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: NEW_DRAG_PREFIX + entry.type,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn('pb-insert-item', isDragging && 'pb-insert-item--dragging')}
      disabled={disabled}
      title={t(entry.descriptionKey)}
      onClick={onInsert}
      {...attributes}
      {...listeners}
    >
      <span className="pb-insert-item__icon" aria-hidden>
        {glyph}
      </span>
      {t(entry.nameKey)}
    </button>
  );
}
