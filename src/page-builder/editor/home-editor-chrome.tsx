'use client';

import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { useCaspianNavigation } from '../../provider/caspian-store-provider';
import { EditorHotkeys } from './editor-hotkeys';
import { EditorPanel } from './editor-panel';
import { EditorToolbar } from './editor-toolbar';
import { useHomeEditor } from './home-editor-context';

/**
 * Admin-only editor chrome mounted alongside the homepage. Shows nothing for
 * shoppers; a floating "Edit page" pill for admins; the side panel + toolbar
 * once edit mode is on. Toggles a `pb-editing` body class so the layout makes
 * room for the fixed panel.
 */
export function HomeEditorChrome() {
  const t = useT();
  const { isAdmin, isEditing, enterEdit, breakpoint, loading, dirty } = useHomeEditor();
  const nav = useCaspianNavigation();
  const wantEdit = nav.searchParams?.get('edit') === '1';
  const autoEntered = useRef(false);

  // Deep-linked editing: admin → Pages "Edit" sends the admin to the page with
  // `?edit=1`. Enter edit mode once the layout has loaded (a one-shot, so a
  // manual Exit while the param lingers doesn't immediately re-enter).
  useEffect(() => {
    if (!isAdmin || isEditing || loading || autoEntered.current) return;
    if (wantEdit) {
      autoEntered.current = true;
      enterEdit();
    }
  }, [isAdmin, isEditing, loading, wantEdit, enterEdit]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('pb-editing', isEditing);
    return () => document.body.classList.remove('pb-editing');
  }, [isEditing]);

  // Guard against silently losing unsaved edits: while editing with a dirty
  // draft, prompt the browser's leave-confirmation on tab close / navigation.
  // (The draft lives only in memory, so an unguarded unload discards it.)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!isEditing || !dirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditing, dirty]);

  // Reflect the active device on <body> so CSS can constrain the canvas width
  // to a tablet/mobile preview while editing.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const cls = ['pb-bp-desktop', 'pb-bp-tablet', 'pb-bp-mobile'];
    document.body.classList.remove(...cls);
    if (isEditing) document.body.classList.add(`pb-bp-${breakpoint}`);
    return () => document.body.classList.remove(...cls);
  }, [isEditing, breakpoint]);

  if (!isAdmin) return null;

  if (!isEditing) {
    // Hide the pill until the layout has loaded — `enterEdit` no-ops while the
    // saved layout is still null, so a click then would do nothing.
    if (loading) return null;
    return (
      <button type="button" className="pb-edit-pill" onClick={enterEdit}>
        {t('pageBuilder.editPage')}
      </button>
    );
  }

  return (
    <>
      <EditorHotkeys />
      <EditorPanel />
      <EditorToolbar />
    </>
  );
}
