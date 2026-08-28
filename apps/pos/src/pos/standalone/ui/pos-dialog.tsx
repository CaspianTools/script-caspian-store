'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { ChevronLeftIcon, XIcon } from '../../../icons';
import { cn } from '@caspian-explorer/script-caspian-store';

// --- the overlay contract ----------------------------------------------------

/**
 * What every overlay in the till owes the person using it.
 *
 * Three overlays existed and each answered differently. `PosDialog` had Escape,
 * a backdrop click, a scroll lock and focus return. The tender panel had none
 * of them -- Tab walked straight out of a payment screen onto the quantity
 * buttons behind the scrim, so a keyboard or screen-reader user could change
 * the basket while taking money for it. The nav drawer had a scrim and nothing
 * else, and the page scrolled underneath it.
 *
 * This is that behaviour lifted out of `PosDialog` so the two that are not
 * `PosDialog` can borrow it without becoming it. What each one wants to be
 * dismissed BY still differs -- see `dismissOn` -- but nothing gets to
 * accidentally lack a focus trap again.
 */
export interface PosOverlayOptions {
  open: boolean;
  /**
   * Everything that stays live. Focus is trapped inside the first; the rest
   * merely escape `inert`. The drawer needs two, because its scrim is a
   * SIBLING of the panel and inerting it would kill the click-to-dismiss that
   * is currently the only way out.
   */
  containers: Array<RefObject<HTMLElement | null>>;
  onDismiss: () => void;
  /**
   * Both default to false. An overlay opts IN to being easy to leave, so the
   * tender screen's resistance is a property of its own call rather than an
   * absence buried in the primitive.
   */
  dismissOn?: { escape?: boolean };
}

const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Body scroll is locked by a COUNT, not a boolean.
 *
 * `pos-shift-page.tsx` renders two `PosDialog`s, and with a plain
 * save-and-restore the second to unmount put back whatever `overflow` the first
 * one had saved -- which was already `hidden`, leaving the page permanently
 * unscrollable behind a closed dialog.
 */
let scrollLocks = 0;
let scrollWas = '';

function lockScroll(): () => void {
  if (scrollLocks === 0) {
    scrollWas = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = scrollWas;
  };
}

/**
 * Mark everything that is not the overlay as `inert`.
 *
 * Walks from each container up to `<body>`, inerting every sibling of a node on
 * the way. That ancestor walk is why no overlay here needs to portal: a dialog
 * rendered inside `.cpos-main` inerts its page siblings, then the top bar and
 * the banners, then the sidebar. Quick add mounts outside `.cpos-shell` and
 * inerts the shell in one step. Both correct, no configuration.
 *
 * Known limit, stated rather than engineered around: an element React inserts
 * into the background WHILE the overlay is open is not inert. The shell's
 * children are stable for the life of a modal, so a MutationObserver would be
 * machinery earning nothing.
 */
function applyInert(elements: HTMLElement[]): () => void {
  const chain = new Set<Element>();
  for (const el of elements) {
    let node: Element | null = el;
    while (node && node !== document.body) {
      chain.add(node);
      node = node.parentElement;
    }
  }

  const changed: HTMLElement[] = [];
  for (const el of elements) {
    let node: Element | null = el;
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
        if (chain.has(sibling) || !(sibling instanceof HTMLElement)) continue;
        // Already inert for some other reason: leave it, and leave it alone on
        // the way out too.
        if (sibling.inert) continue;
        sibling.inert = true;
        changed.push(sibling);
      }
      node = parent;
    }
  }

  return () => {
    for (const el of changed) el.inert = false;
  };
}

export function usePosOverlay({ open, containers, onDismiss, dismissOn }: PosOverlayOptions): void {
  const openerRef = useRef<Element | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const escape = dismissOn?.escape === true;

  useEffect(() => {
    if (!open) return;

    const nodes = containers
      .map((ref) => ref.current)
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (!nodes.length) return;

    // Captured before focus moves, and restored on close. Without it, closing a
    // dialog opened from a table row drops focus onto <body>, and the next Tab
    // starts again from the top of the page -- which on a till driven by a
    // barcode scanner means the scan lands nowhere.
    openerRef.current = document.activeElement;

    const trap = nodes[0];
    const focusables = () =>
      Array.from(trap.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const onKeyDown = (event: KeyboardEvent) => {
      if (escape && event.key === 'Escape') {
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        trap.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === trap)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // The trap acts on Tab, and on focus arriving from outside. On NOTHING
    // else. A barcode scanner types into whatever is focused, so a trap that
    // reasserted focus on every keystroke would eat a scan -- which is the one
    // failure a till cannot afford from an accessibility fix.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (nodes.some((node) => node.contains(target))) return;
      const items = focusables();
      (items[0] ?? trap).focus();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    const releaseScroll = lockScroll();
    const releaseInert = applyInert(nodes);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      releaseInert();
      releaseScroll();
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
    // `containers` is a stable array of refs at every call site; depending on
    // its identity would tear the trap down and rebuild it on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, escape]);
}

// --- the modal ---------------------------------------------------------------

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
  /**
   * The close button's accessible name. Required, because the default it
   * replaced was the dialog's own TITLE -- so a screen reader announced the ✕
   * on "Edit this item" as a button called "Edit this item".
   */
  closeLabel: string;
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
 * wrong: Escape, the backdrop click, the body scroll lock, returning focus to
 * whatever opened it, a focus trap, and `inert` on everything behind it. The
 * last two arrived with `usePosOverlay` above, which is the same behaviour
 * lifted out so the tender panel and the nav drawer can have it too.
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
  closeLabel,
  className,
}: PosDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const containers = useRef([panelRef]).current;

  usePosOverlay({
    open,
    containers,
    onDismiss: () => onOpenChange(false),
    dismissOn: { escape: true },
  });

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={scrimRef}
      className="cpos-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
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
            {description ? (
              <span className="cpos-cardhead__sub" id={descriptionId}>
                {description}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="cpos-iconbtn"
            onClick={() => onOpenChange(false)}
            aria-label={closeLabel}
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
