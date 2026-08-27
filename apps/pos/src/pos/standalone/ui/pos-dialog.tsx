'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronLeftIcon, XIcon } from '../../../icons';
import { cn } from '@caspian-explorer/script-caspian-store';

export type PosDialogSize = 'sm' | 'md' | 'lg';

export interface PosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** A line under the title. Skip it when the fields already say what this is. */
  description?: string;
  children?: ReactNode;
  /** The action row. Put Cancel first and the verb last, as every screen does. */
  foot?: ReactNode;
  size?: PosDialogSize;
  /**
   * Draws a back chevron at the start of the head, for a dialog with more than
   * one step (Quick add). In the head rather than the body so it stays put while
   * a long form scrolls under it.
   */
  onBack?: () => void;
  /** The back button's accessible name. Required whenever `onBack` is passed. */
  backLabel?: string;
  className?: string;
}

const SIZE_CLASS: Record<PosDialogSize, string> = {
  sm: '',
  md: 'cpos-modal__panel--md',
  lg: 'cpos-modal__panel--lg',
};

/**
 * The till's modal.
 *
 * Deliberately not the library's `<Dialog>`, which the back office used until
 * v1.4.0. That one paints a white panel with a hardcoded `rgba(0,0,0,0.6)`
 * scrim, so on a dark till it arrived as a white sheet -- and its buttons and
 * fields came from `src/ui/` too, which is how half the register ended up on a
 * different design system from the other half. This renders the same
 * `.cpos-modal` markup the tender dialog has always used, so a form popup and
 * the payment popup are visibly the same object.
 *
 * Behaviour it owns, so that eleven call sites do not each get it slightly
 * wrong: Escape, the backdrop click, the body scroll lock, and returning focus
 * to whatever opened it.
 */
export function PosDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  foot,
  size = 'md',
  onBack,
  backLabel,
  className,
}: PosDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    // Captured before focus moves, and restored on close. Without it, closing a
    // dialog opened from a table row drops focus onto <body>, and the next Tab
    // starts again from the top of the page -- which on a till driven by a
    // barcode scanner means the scan lands nowhere.
    openerRef.current = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="cpos-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        // mousedown, not click: a click fires on the scrim when a drag that
        // began inside the panel -- selecting the text in a price field, say --
        // finishes outside it, and closing a half-filled form on that is
        // infuriating.
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'cpos-modal__panel cpos-modal__panel--framed',
          SIZE_CLASS[size],
          className,
        )}
      >
        <header className="cpos-modal__head">
          {onBack ? (
            <button
              type="button"
              className="cpos-iconbtn"
              onClick={onBack}
              aria-label={backLabel}
            >
              <ChevronLeftIcon size={18} />
            </button>
          ) : null}
          <span className="cpos-cardhead__text">
            <h2 className="cpos-modal__title" id={titleId}>
              {title}
            </h2>
            {description ? <span className="cpos-cardhead__sub">{description}</span> : null}
          </span>
          <button
            type="button"
            className="cpos-iconbtn"
            onClick={() => onOpenChange(false)}
            aria-label={title}
          >
            <XIcon size={18} />
          </button>
        </header>

        <div className="cpos-modal__body">{children}</div>

        {foot ? <footer className="cpos-modal__foot">{foot}</footer> : null}
      </div>
    </div>
  );
}
