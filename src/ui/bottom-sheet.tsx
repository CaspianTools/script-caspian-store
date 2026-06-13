'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading shown in the sheet header. Omit to render no header row. */
  title?: ReactNode;
  /** Accessible dialog label when `title` is not a plain string. */
  ariaLabel?: string;
  /** Accessible label for the × close button. */
  closeLabel: string;
  children: ReactNode;
  /** Optional sticky footer (e.g. action buttons). */
  footer?: ReactNode;
  /** Show the centered drag-handle pill. Default true. */
  showHandle?: boolean;
  /** Max height of the sheet card. Default `85vh`. */
  maxHeight?: string;
  /** Extra class on the sheet card. */
  className?: string;
}

/**
 * Mobile-first bottom sheet: a dimmed veil with a card anchored to the bottom
 * edge that slides up. Generalizes the conventions used by `<CartSheet>` and
 * `<ShopFilterDrawer>` — Escape + body-scroll lock + click-veil-to-close — and
 * adds focus-on-open with restore-on-close. Inline-styled to match the rest of
 * the storefront chrome; the slide-up reuses the `caspian-drawer-slide-up`
 * keyframe from globals.css. Holds no user-facing strings (`closeLabel` and any
 * string `title` are passed in by the consumer). Unmounts when closed.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  ariaLabel,
  closeLabel,
  children,
  footer,
  showHandle = true,
  maxHeight = '85vh',
  className,
}: BottomSheetProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => {
      (closeRef.current ?? sheetRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : ariaLabel}
    >
      <aside
        ref={sheetRef}
        tabIndex={-1}
        className={cn('caspian-bottom-sheet', className)}
        style={{
          width: '100%',
          maxHeight,
          background: '#fff',
          color: '#111',
          borderTopLeftRadius: 'var(--caspian-radius, 12px)',
          borderTopRightRadius: 'var(--caspian-radius, 12px)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
          animation: 'caspian-drawer-slide-up 220ms ease-out',
        }}
      >
        {showHandle && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <span
              aria-hidden="true"
              style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(0,0,0,0.18)' }}
            />
          </div>
        )}

        {title != null && (
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 12px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
            <button
              ref={closeRef}
              type="button"
              aria-label={closeLabel}
              onClick={() => onOpenChange(false)}
              style={{
                background: 'transparent',
                border: 0,
                fontSize: 22,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
                color: '#444',
              }}
            >
              ×
            </button>
          </header>
        )}

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 20px 20px',
          }}
        >
          {children}
        </div>

        {footer != null && (
          <footer
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 20px max(12px, env(safe-area-inset-bottom))',
              borderTop: '1px solid rgba(0,0,0,0.08)',
              background: '#fff',
            }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
