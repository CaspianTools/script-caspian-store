'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { cn } from '../utils/cn';
import { richHtmlToText, sanitizeRichHtml } from './rich-text-editor';

export interface HtmlContentProps {
  /** HTML authored via `<RichTextEditor>`. Sanitized before render. */
  html: string | undefined | null;
  className?: string;
  style?: React.CSSProperties;
}

const noopSubscribe = () => () => {};

/**
 * Renders sanitized HTML authored via `<RichTextEditor>`. Runs the same
 * allowlist sanitizer a second time at render so any Firestore-stored HTML
 * that was produced by an older editor (or written directly) is clamped to
 * the same safe subset before hitting the DOM.
 *
 * The DOM sanitizer needs `DOMParser`, which the server does not have, so
 * the server render (and the matching hydration pass) emits the content as
 * plain text instead of injecting the stored markup. Once mounted the
 * sanitized HTML takes over.
 */
export function HtmlContent({ html, className, style }: HtmlContentProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const safe = useMemo(() => (mounted && html ? sanitizeRichHtml(html) : ''), [html, mounted]);
  const text = useMemo(() => (!mounted && html ? richHtmlToText(html) : ''), [html, mounted]);

  if (!mounted) {
    if (!text) return null;
    return (
      <div className={cn('caspian-html-content', className)} style={{ whiteSpace: 'pre-line', ...style }}>
        {text}
      </div>
    );
  }
  if (!safe) return null;
  return (
    <div
      className={cn('caspian-html-content', className)}
      style={style}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
