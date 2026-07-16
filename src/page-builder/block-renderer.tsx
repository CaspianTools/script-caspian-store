'use client';

import { Fragment, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { Breakpoint, PageBlock, SiteSettings } from '../types';
import { cn } from '../utils/cn';
import { blockCategoryOf, getBlockType } from './catalog';
import { blockStyleToCss, collectResponsiveCss, effectiveStyle, hasStyle } from './block-style';
import { SectionEditProvider } from './section-edit-context';

/**
 * Canvas drag-and-drop adapter (v9.5). A plain-interface seam so the shared
 * renderer never imports `@dnd-kit` (it also renders the public storefront). The
 * editor supplies a concrete adapter (`canvas-dnd.tsx`); without one the edit
 * wrapper is a plain clickable div, exactly as before.
 */
export interface CanvasDndAdapter {
  /** Wrap a level's children in a sortable context keyed by their ids. */
  SortableList: (props: { itemIds: string[]; children: ReactNode }) => ReactElement;
  /** The per-block edit wrapper: a sortable node with a drag handle. */
  DraggableWrapper: (props: {
    block: PageBlock;
    className: string;
    style: CSSProperties;
    onSelect: () => void;
    children: ReactNode;
  }) => ReactElement;
}

export interface BlockRendererProps {
  blocks: PageBlock[];
  siteSettings: SiteSettings | null;
  editing?: boolean;
  selectedId?: string | null;
  /** Active device while editing — drives the inline preview. Default desktop. */
  breakpoint?: Breakpoint;
  onFieldChange?: (blockId: string, key: string, value: unknown) => void;
  onSelect?: (blockId: string, fieldKey?: string) => void;
  getProductHref?: (productId: string) => string;
  formatPrice?: (price: number) => string;
  /** Canvas drag-and-drop, injected by the editor while editing. */
  dnd?: CanvasDndAdapter;
}

/**
 * Renders a block tree by resolving each block's `type` through the catalog.
 * Unknown types are skipped; saved props are merged over the type's
 * `defaultProps`. Premade sections render full-bleed (no wrapper unless styled);
 * widgets render in a centered container; styled / responsive blocks get a
 * `data-pb-id` wrapper carrying inline style. Per-breakpoint overrides are
 * emitted once as a `@media` stylesheet (inline styles can't express them).
 * Recursive: a block's `children` render inside its component as `childrenSlot`.
 */
export function BlockRenderer(props: BlockRendererProps): ReactElement {
  const css = collectResponsiveCss(props.blocks);
  return (
    <>
      {css ? <style>{css}</style> : null}
      <BlockList {...props} />
    </>
  );
}

function BlockList({ blocks, ...rest }: BlockRendererProps): ReactElement {
  const nodes = (
    <>
      {blocks.map((block) => (
        <BlockNode key={block.id} block={block} {...rest} />
      ))}
    </>
  );
  // In edit mode with the DnD adapter, wrap this level in a sortable context so
  // its blocks can be dragged to reorder on the canvas.
  if (rest.editing && rest.dnd) {
    const Sortable = rest.dnd.SortableList;
    return <Sortable itemIds={blocks.map((b) => b.id)}>{nodes}</Sortable>;
  }
  return nodes;
}

function BlockNode({
  block,
  siteSettings,
  editing = false,
  selectedId,
  breakpoint = 'desktop',
  onFieldChange,
  onSelect,
  getProductHref,
  formatPrice,
  dnd,
}: Omit<BlockRendererProps, 'blocks'> & { block: PageBlock }): ReactElement | null {
  const entry = getBlockType(block.type);
  if (!entry) return null;
  if (!editing && !block.visible) return null;

  // Per-breakpoint CONTENT overrides (v9.5): tablet/mobile props layer over the
  // base props. `@media` can't swap text, so this merge is how responsive
  // content is expressed — the renderer is fed the active breakpoint.
  const bpProps = breakpoint !== 'desktop' ? block.responsive?.[breakpoint]?.props : undefined;
  const merged = { ...entry.defaultProps, ...block.props, ...bpProps };
  const isWidget = blockCategoryOf(entry) === 'widget';
  const style = blockStyleToCss(effectiveStyle(block, breakpoint));
  const hasResponsive = Boolean(block.responsive && Object.keys(block.responsive).length > 0);
  const needsWrapper = hasStyle(block.style) || hasResponsive;
  const idAttr = needsWrapper || isWidget ? block.id : undefined;
  const bpHidden = breakpoint !== 'desktop' && block.responsive?.[breakpoint]?.hidden;
  const bgCredit = renderBgCredit(block.style?.background?.imageAttribution);

  const childrenSlot: ReactNode =
    block.children && block.children.length > 0 ? (
      <BlockList
        blocks={block.children}
        siteSettings={siteSettings}
        editing={editing}
        selectedId={selectedId}
        breakpoint={breakpoint}
        onFieldChange={onFieldChange}
        onSelect={onSelect}
        getProductHref={getProductHref}
        formatPrice={formatPrice}
        dnd={dnd}
      />
    ) : undefined;

  const inner = (
    <SectionEditProvider
      value={{
        editing,
        sectionId: block.id,
        selected: selectedId === block.id,
        onFieldChange: (key, value) => onFieldChange?.(block.id, key, value),
        onSelect: (fieldKey) => onSelect?.(block.id, fieldKey),
      }}
    >
      <entry.Component
        props={merged}
        variant={block.variant}
        editing={editing}
        siteSettings={siteSettings}
        getProductHref={getProductHref}
        formatPrice={formatPrice}
        childrenSlot={childrenSlot}
      />
    </SectionEditProvider>
  );

  // View mode: widgets get a centered container; styled / responsive blocks get
  // a wrapper carrying inline style + data-pb-id; unstyled sections emit no
  // wrapper, so the DOM stays identical to the pre-builder page.
  if (!editing) {
    if (isWidget) {
      return (
        <div className="pb-block pb-block--widget" style={style} data-pb-id={idAttr}>
          {inner}
          {bgCredit}
        </div>
      );
    }
    if (needsWrapper) {
      return (
        <div className="pb-styled" style={style} data-pb-id={idAttr}>
          {inner}
          {bgCredit}
        </div>
      );
    }
    return <Fragment>{inner}</Fragment>;
  }

  // Edit mode: a clickable selection wrapper around every block, previewing the
  // active breakpoint's style inline. Blocks hidden on this device are flagged.
  const editClassName = cn(
    'pb-edit-section',
    isWidget && 'pb-block--widget',
    selectedId === block.id && 'pb-edit-section--selected',
    !block.visible && 'pb-edit-section--hidden',
    bpHidden && 'pb-edit-section--bp-hidden',
  );

  // With the DnD adapter, the wrapper becomes a sortable node with a drag handle;
  // without it, a plain clickable div (unchanged legacy behavior).
  if (dnd) {
    const Draggable = dnd.DraggableWrapper;
    return (
      <Draggable block={block} className={editClassName} style={style} onSelect={() => onSelect?.(block.id)}>
        {inner}
        {bgCredit}
      </Draggable>
    );
  }

  return (
    <div className={editClassName} style={style} data-pb-id={idAttr} onClick={() => onSelect?.(block.id)}>
      {inner}
      {bgCredit}
    </div>
  );
}

/** Small credit pill for a stock background image (attribution = legal for CC-BY). */
function renderBgCredit(attribution: unknown): ReactNode {
  if (!attribution || typeof attribution !== 'object') return null;
  const a = attribution as { creator?: string | null; foreignLandingUrl?: string; license?: string };
  const name = a.creator || (a.foreignLandingUrl ? 'Source' : '');
  const license = a.license ? a.license.toUpperCase() : '';
  if (!name && !license) return null;
  return (
    <small className="pb-bg-credit">
      {name &&
        (a.foreignLandingUrl ? (
          <a href={a.foreignLandingUrl} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ) : (
          name
        ))}
      {name && license ? ' · ' : ''}
      {license}
    </small>
  );
}
