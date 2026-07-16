import type { PageBlock } from '../types';
import { getBlockType } from './catalog';

/** A fresh, stable, key/CSS-safe block id (e.g. `widget-heading-3f9a1c20`). */
export function newBlockId(type: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const prefix = type.replace(/[^a-z0-9]+/gi, '-');
  return `${prefix}-${rand}`;
}

/**
 * Build a fresh block instance from a catalog type, seeded with the type's
 * `defaultProps` and (for layout blocks) its `defaultChildren` recursively —
 * e.g. inserting a "Columns" block auto-creates its two empty Column children.
 *
 * `seen` guards against a self-referential `defaultChildren` (a type that seeds
 * itself, directly or through a cycle): once a type is already on the current
 * ancestry path it is built WITHOUT its children, breaking the recursion. No
 * catalog entry cycles today; this is a defensive backstop against a future one
 * stack-overflowing the editor.
 */
export function createBlock(type: string, seen: ReadonlySet<string> = new Set()): PageBlock | null {
  const entry = getBlockType(type);
  if (!entry) return null;
  const block: PageBlock = {
    id: newBlockId(type),
    type,
    visible: true,
    props: { ...entry.defaultProps },
  };
  if (entry.defaultChildren && entry.defaultChildren.length > 0 && !seen.has(type)) {
    const nextSeen = new Set(seen).add(type);
    block.children = entry.defaultChildren
      .map((childType) => createBlock(childType, nextSeen))
      .filter((b): b is PageBlock => b !== null);
  }
  return block;
}

/**
 * Deep-clone a block subtree with fresh ids at every level, so a duplicate /
 * paste never collides with the source (or with a repeated paste). Props and
 * style are deep-copied (JSON round-trip) so nested objects aren't shared.
 */
export function cloneWithNewIds(block: PageBlock): PageBlock {
  const copy: PageBlock = JSON.parse(JSON.stringify(block));
  const reId = (b: PageBlock) => {
    b.id = newBlockId(b.type);
    if (b.children) b.children.forEach(reId);
  };
  reId(copy);
  return copy;
}
