'use client';

import { useEffect, useRef } from 'react';
import { useHomeEditor } from './home-editor-context';

/** True when the event came from a text-entry surface (input / textarea / select / contentEditable). */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return el.closest('[contenteditable="true"]') != null;
}

/**
 * Global editor keyboard shortcuts, mounted only in edit mode. A single window
 * keydown listener, registered once and reading the latest editor state through
 * a ref so the handler stays stable. Events from a typing surface are ignored,
 * so Ctrl+Z reaches the browser's native text undo and Delete never removes a
 * block while its text is being edited.
 *
 * Bindings: Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z or Ctrl+Y redo · Delete/Backspace
 * remove selected · Ctrl/Cmd+D duplicate · Ctrl/Cmd+C copy (only with a collapsed
 * selection) · Ctrl/Cmd+V paste.
 */
export function EditorHotkeys() {
  const editor = useHomeEditor();
  const ref = useRef(editor);
  useEffect(() => {
    ref.current = editor;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const ed = ref.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && !e.shiftKey && key === 'z') {
        if (ed.canUndo) {
          e.preventDefault();
          ed.undo();
        }
        return;
      }
      if ((mod && e.shiftKey && key === 'z') || (mod && key === 'y')) {
        if (ed.canRedo) {
          e.preventDefault();
          ed.redo();
        }
        return;
      }
      if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (ed.selectedId) {
          e.preventDefault();
          ed.removeBlock(ed.selectedId);
        }
        return;
      }
      if (mod && key === 'd') {
        if (ed.selectedId) {
          e.preventDefault();
          ed.duplicateBlock(ed.selectedId);
        }
        return;
      }
      if (mod && key === 'c') {
        // Only when there's no real text selection to copy.
        const sel = window.getSelection();
        if (ed.selectedId && (!sel || sel.isCollapsed)) {
          e.preventDefault();
          ed.copyBlock(ed.selectedId);
        }
        return;
      }
      if (mod && key === 'v') {
        if (ed.canPaste) {
          e.preventDefault();
          ed.pasteBlock();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
