'use client';

import { BlockRenderer } from '../block-renderer';
import { useActiveBreakpoint } from '../use-active-breakpoint';
import { canvasDndAdapter } from './canvas-dnd';
import { useHomeEditor } from './home-editor-context';

/**
 * Renders a builder-managed page's block tree from the editor context — the
 * generic, non-homepage counterpart to `HomePageDefault`'s editor host. Admins
 * inside a `<HomeEditorProvider pageId={slug}>` get the live draft + edit
 * affordances; shoppers get the saved layout. Product helpers aren't threaded
 * here, so product-bearing sections render without storefront links on custom
 * pages (use widgets / layout blocks for landing pages).
 */
export function BuilderPageView() {
  const { blocks, loading, siteSettings, isEditing, selectedId, breakpoint, updateField, select } =
    useHomeEditor();
  const viewportBp = useActiveBreakpoint();

  if (loading) return <div style={{ minHeight: '60vh' }} aria-busy="true" />;

  return (
    <main className="pb-page">
      <BlockRenderer
        blocks={blocks}
        siteSettings={siteSettings}
        editing={isEditing}
        selectedId={selectedId}
        breakpoint={isEditing ? breakpoint : viewportBp}
        onFieldChange={updateField}
        onSelect={(id) => select(id)}
        dnd={isEditing ? canvasDndAdapter : undefined}
      />
    </main>
  );
}
