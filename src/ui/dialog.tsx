'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useT } from '../i18n/locale-context';
import { XIcon } from './icons';
import { cn } from '../utils/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidth?: number;
  /**
   * Render the × button in the top-right corner. Default true. Set false for
   * flows that must be completed or explicitly cancelled through the footer.
   */
  showClose?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 18, 24, 0.55)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  zIndex: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const panelStyle: React.CSSProperties = {
  position: 'relative',
  background: 'var(--cpos-surface, #fff)',
  color: 'var(--cpos-fg, #111)',
  border: '1px solid var(--cpos-border, transparent)',
  borderRadius: 'var(--caspian-radius, 8px)',
  boxShadow: 'var(--caspian-shadow-lg, 0 20px 60px rgba(0,0,0,0.3))',
  width: '100%',
  boxSizing: 'border-box',
  maxHeight: 'min(90vh, 90dvh)',
  overflow: 'auto',
  padding: 24,
  outline: 'none',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Traps Tab inside the panel, moves focus in on open and gives
 * it back to the opener on close, closes on Escape / veil click, and labels
 * itself from `title` + `description` for screen readers.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  maxWidth = 480,
  showClose = true,
}: DialogProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();
  // Parents pass `onOpenChange` inline, so it changes identity on every
  // render. Reading it through a ref keeps the effect keyed on `open` only;
  // otherwise each keystroke in a dialog form would re-run the effect and
  // yank focus back to the first field.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const requestClose = () => onOpenChangeRef.current(false);
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // A nested overlay (SearchableSelect, DropdownMenu) that handled this
        // Escape already stopped propagation before it reached the document.
        e.stopImmediatePropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first field so a keyboard user can start typing; fall back
    // to the panel itself so Tab never escapes to the page underneath.
    const focusTimer = window.setTimeout(() => {
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      const fallback = panel.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? fallback ?? panel).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="caspian-dialog-overlay"
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={cn('caspian-dialog', className)}
        style={{ ...panelStyle, maxWidth }}
      >
        {showClose && (
          <button
            type="button"
            className="caspian-dialog-close"
            aria-label={t('common.close')}
            onClick={() => onOpenChange(false)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              background: 'transparent',
              borderRadius: 999,
              color: '#666',
              cursor: 'pointer',
            }}
          >
            <XIcon size={16} />
          </button>
        )}
        {(title || description) && (
          <header style={{ marginBottom: 16, paddingRight: showClose ? 28 : 0 }}>
            {title && (
              <h2 id={titleId} style={{ fontSize: 18, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                {title}
              </h2>
            )}
            {description && (
              <p
                id={descId}
                style={{ color: 'var(--cpos-fg-muted, #666)', fontSize: 14, marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}
              >
                {description}
              </p>
            )}
          </header>
        )}
        <div>{children}</div>
        {footer && (
          <footer style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
