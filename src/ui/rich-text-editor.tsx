'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '../utils/cn';

/**
 * Minimal HTML sanitizer for the rich-text editor. Accepts an input string,
 * parses it via `DOMParser`, and emits a fresh DOM containing only the tags
 * in `ALLOWED_TAGS` (with no attributes). Everything else becomes text, so
 * pasted spans/divs collapse into plain text without breaking the document.
 *
 * This is deliberately tiny — no DOMPurify dep. The allowlist is scoped to
 * what the toolbar produces: paragraphs, line breaks, bold, and bullet
 * lists. Inline content inside disallowed containers is preserved.
 */
const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'UL', 'LI']);

export function sanitizeRichHtml(input: string): string {
  if (typeof window === 'undefined' || !input) return input;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  cleanNode(root);
  return root.innerHTML;
}

function cleanNode(node: Element): void {
  // Walk children; disallowed elements are unwrapped (children promoted),
  // allowed elements have their attributes stripped.
  const children = Array.from(node.children);
  for (const child of children) {
    cleanNode(child);
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Unwrap: move children up, drop the wrapper.
      while (child.firstChild) {
        child.parentNode?.insertBefore(child.firstChild, child);
      }
      child.remove();
    } else {
      // Strip every attribute on allowed tags.
      for (const attr of Array.from(child.attributes)) {
        child.removeAttribute(attr.name);
      }
    }
  }
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Minimal contentEditable editor. Exposes a two-button toolbar (Bold +
 * Bulleted list) and sanitizes output on every edit. Output HTML is
 * restricted to `<p>`, `<strong>`, `<b>`, `<ul>`, `<li>`, `<br>`.
 *
 * Uses `document.execCommand` — deprecated but still the universally-
 * supported contentEditable API. Not perfect; fine for an optional field
 * that most admins will only use for short bulleted specs.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 140,
  disabled,
  ariaLabel,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  // Sync upstream value → DOM only when it changed out-of-band (e.g. reset).
  // Avoids clobbering the editor's caret on every keystroke.
  useEffect(() => {
    if (!ref.current) return;
    if (value !== lastValueRef.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value ?? '';
      lastValueRef.current = value;
    }
  }, [value]);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const raw = ref.current.innerHTML;
    const clean = sanitizeRichHtml(raw);
    lastValueRef.current = clean;
    onChange(clean);
  }, [onChange]);

  const exec = (cmd: 'bold' | 'insertUnorderedList') => {
    if (disabled) return;
    // Keep focus in the editor before executing the command.
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Intercept Cmd/Ctrl+B since we want sanitize-on-change to follow.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      exec('bold');
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Paste as plain text so foreign markup doesn't sneak past the sanitizer
    // between input events.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  };

  const isEmpty = !value || value === '' || value === '<p></p>' || value === '<br>';

  return (
    <div className={cn('caspian-rich-editor', className)}>
      <div
        role="toolbar"
        aria-label={ariaLabel ? `${ariaLabel} toolbar` : 'Rich text toolbar'}
        style={{
          display: 'flex',
          gap: 4,
          padding: 6,
          border: '1px solid rgba(0,0,0,0.15)',
          borderBottom: 0,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          background: '#fafafa',
        }}
      >
        <ToolbarButton
          label="Bold (Ctrl+B)"
          onClick={() => exec('bold')}
          disabled={disabled}
        >
          <strong style={{ fontSize: 14 }}>B</strong>
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          onClick={() => exec('insertUnorderedList')}
          disabled={disabled}
        >
          <BulletIcon />
        </ToolbarButton>
      </div>
      <div style={{ position: 'relative' }}>
        <div
          ref={ref}
          role="textbox"
          aria-label={ariaLabel}
          aria-multiline
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          style={{
            minHeight,
            padding: 12,
            border: '1px solid rgba(0,0,0,0.15)',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
            background: '#fff',
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: 'inherit',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.6 : 1,
          }}
          data-placeholder={placeholder ?? ''}
        />
        {isEmpty && placeholder && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              pointerEvents: 'none',
              color: '#999',
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent the contentEditable from losing focus before we run execCommand.
        e.preventDefault();
      }}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        border: '1px solid transparent',
        background: 'transparent',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#333',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function BulletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="2" cy="4" r="1.2" fill="currentColor" />
      <circle cx="2" cy="8" r="1.2" fill="currentColor" />
      <circle cx="2" cy="12" r="1.2" fill="currentColor" />
      <rect x="5.5" y="3.3" width="9" height="1.4" rx="0.7" fill="currentColor" />
      <rect x="5.5" y="7.3" width="9" height="1.4" rx="0.7" fill="currentColor" />
      <rect x="5.5" y="11.3" width="9" height="1.4" rx="0.7" fill="currentColor" />
    </svg>
  );
}
