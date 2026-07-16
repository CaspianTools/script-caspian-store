import type { PageBlock } from '../types';

/**
 * Pure helpers for the page-builder block tree. Top-level blocks live in the
 * `PageLayout.blocks` array; layout containers/columns hold nested `children`.
 * The synthetic `ROOT_ID` names the top-level array so move/insert operations
 * can treat it like any other parent.
 */
export const ROOT_ID = '__root__';

/** Prefix for a container's droppable id in the editor's nested DnD tree. */
export const CONTAINER_PREFIX = 'container:';

export function findBlock(blocks: PageBlock[], id: string): PageBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlock(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Replace the block with `id` by `fn(block)`, returning a new tree. */
export function mapBlock(
  blocks: PageBlock[],
  id: string,
  fn: (b: PageBlock) => PageBlock,
): PageBlock[] {
  return blocks.map((b) => {
    if (b.id === id) return fn(b);
    if (b.children) return { ...b, children: mapBlock(b.children, id, fn) };
    return b;
  });
}

/** Remove the block with `id`, returning the new tree and the removed block. */
export function removeBlock(
  blocks: PageBlock[],
  id: string,
): { tree: PageBlock[]; removed: PageBlock | null } {
  let removed: PageBlock | null = null;
  const walk = (list: PageBlock[]): PageBlock[] => {
    const out: PageBlock[] = [];
    for (const b of list) {
      if (b.id === id) {
        removed = b;
        continue;
      }
      out.push(b.children ? { ...b, children: walk(b.children) } : b);
    }
    return out;
  };
  const tree = walk(blocks);
  return { tree, removed };
}

/** The children of `parentId` (or the top-level array for `ROOT_ID`). */
export function getChildren(blocks: PageBlock[], parentId: string): PageBlock[] {
  if (parentId === ROOT_ID) return blocks;
  return findBlock(blocks, parentId)?.children ?? [];
}

/** The id of the parent that holds `id` (`ROOT_ID` if it's top-level), or null. */
export function findParentId(blocks: PageBlock[], id: string, parent: string = ROOT_ID): string | null {
  for (const b of blocks) {
    if (b.id === id) return parent;
    if (b.children) {
      const found = findParentId(b.children, id, b.id);
      if (found) return found;
    }
  }
  return null;
}

/** True when any block in the tree satisfies `pred` (used for singleton checks). */
export function anyBlock(blocks: PageBlock[], pred: (b: PageBlock) => boolean): boolean {
  for (const b of blocks) {
    if (pred(b)) return true;
    if (b.children && anyBlock(b.children, pred)) return true;
  }
  return false;
}

/** True when `maybeId` is `block` itself or anywhere in its subtree. */
export function isSelfOrDescendant(block: PageBlock, maybeId: string): boolean {
  if (block.id === maybeId) return true;
  return (block.children ?? []).some((c) => isSelfOrDescendant(c, maybeId));
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Insert `block` into `parentId`'s children at `index`, returning a new tree. */
export function insertInto(
  blocks: PageBlock[],
  parentId: string,
  index: number,
  block: PageBlock,
): PageBlock[] {
  if (parentId === ROOT_ID) {
    const next = [...blocks];
    next.splice(clamp(index, 0, next.length), 0, block);
    return next;
  }
  return blocks.map((b) => {
    if (b.id === parentId) {
      const children = [...(b.children ?? [])];
      children.splice(clamp(index, 0, children.length), 0, block);
      return { ...b, children };
    }
    if (b.children) return { ...b, children: insertInto(b.children, parentId, index, block) };
    return b;
  });
}
