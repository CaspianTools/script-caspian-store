'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

export interface DropdownMenuProps {
  /**
   * The element that opens the menu. Click toggles, Space/Enter/ArrowDown open.
   * If it's a DOM element, props are merged in; if it's a component, ensure it
   * forwards refs + passes through aria-* / onClick.
   */
  trigger: ReactElement;
  /** Menu alignment relative to the trigger. Default: `end`. */
  align?: 'start' | 'end';
  /** Menu min width in px. Default: `180`. */
  minWidth?: number;
  children: ReactNode;
  className?: string;
}

export interface DropdownMenuItemProps {
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Icon rendered at the left of the label. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface PanelPos {
  top: number;
  left: number | null;
  right: number | null;
}

/**
 * Minimal headless dropdown. Click-outside + ESC close. Arrow keys move
 * focus between items. The panel is portaled to `document.body` and
 * positioned with `position: fixed`, so it escapes every `overflow`
 * ancestor — callers can drop `<DropdownMenu>` inside scroll containers
 * (e.g. the admin products table) without clipping.
 */
export function DropdownMenu({
  trigger,
  align = 'end',
  minWidth = 180,
  children,
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!rootRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      setPanelPos({
        top: r.bottom + 4,
        left: align === 'end' ? null : r.left,
        right: align === 'end' ? window.innerWidth - r.right : null,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    const items = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ),
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? items.indexOf(active) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  type TriggerProps = {
    onClick?: (e: MouseEvent<HTMLElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
    'aria-haspopup'?: 'menu';
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
  };

  const existingProps: TriggerProps = isValidElement<TriggerProps>(trigger)
    ? trigger.props
    : {};

  const triggerWithProps = isValidElement<TriggerProps>(trigger)
    ? cloneElement(trigger, {
        onClick: (e: MouseEvent<HTMLElement>) => {
          existingProps.onClick?.(e);
          toggle();
        },
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          existingProps.onKeyDown?.(e);
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
      })
    : trigger;

  const panel =
    open && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
            style={{
              position: 'fixed',
              top: panelPos.top,
              ...(panelPos.left != null ? { left: panelPos.left } : {}),
              ...(panelPos.right != null ? { right: panelPos.right } : {}),
              zIndex: 50,
              minWidth,
              background: 'var(--cpos-surface, #fff)',
              borderRadius: 'var(--caspian-radius, 8px)',
              border: '1px solid var(--cpos-border, rgba(0,0,0,0.1))',
              boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('[role="menuitem"]')) close();
            }}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn('caspian-dropdown-menu', className)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {triggerWithProps}
      {panel}
    </div>
  );
}

export function DropdownMenuItem({
  onSelect,
  disabled,
  destructive,
  icon,
  children,
  className,
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={cn('caspian-dropdown-menu-item', className)}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onSelect?.();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        border: 0,
        background: 'transparent',
        color: destructive ? 'var(--cpos-danger, #b91c1c)' : 'var(--cpos-fg, inherit)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14,
        textAlign: 'left',
        borderRadius: 'calc(var(--caspian-radius, 6px) - 2px)',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cpos-surface-3, #f4f4f5)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
      onFocus={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cpos-surface-3, #f4f4f5)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      )}
      <span style={{ flex: 1 }}>{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator() {
  return (
    <hr
      aria-hidden
      style={{
        border: 0,
        borderTop: '1px solid var(--cpos-border, rgba(0,0,0,0.08))',
        margin: '4px 0',
      }}
    />
  );
}
