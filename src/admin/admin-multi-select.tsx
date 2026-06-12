'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, PlusIcon, SearchIcon, XIcon } from '../ui/icons';

export interface MultiSelectItem {
  id: string;
  name: string;
  /** Parent id; if set the item indents under its parent in the dropdown. */
  parent?: string | null;
  /** Optional metadata shown right-aligned in the row (e.g. product count). */
  meta?: ReactNode;
}

export interface MultiSelectProps {
  items: MultiSelectItem[];
  picked: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
  placeholder?: string;
  /** Render small parent/child indent. Default true. */
  indent?: boolean;
  /** Show a "Create new" footer that fires `onCreate` with the current search. */
  allowCreate?: boolean;
  onCreate?: (name: string) => void;
}

interface MenuPos {
  top: number;
  left: number;
  width: number;
}

/**
 * Pill-trigger dropdown with search and a checkable, multi-select list. The
 * trigger shows the chosen items as removable chips; the menu offers search,
 * optional parent/child indentation, and an optional "Create new" footer.
 *
 * The menu is portaled to `document.body` and positioned with `position: fixed`
 * computed from the trigger's bounding rect (mirroring {@link DropdownMenu}), so
 * it escapes every `overflow` ancestor — drop it inside a scroll container or a
 * modal with `overflow:hidden` and the menu still renders above everything,
 * un-clipped, instead of overlapping nearby content. Styling lives in the
 * shipped `styles.css` under the `caspian-msel` / `caspian-catpick` classes.
 */
export function MultiSelect({
  items,
  picked,
  onChange,
  label = 'Select',
  placeholder = 'Search…',
  indent = true,
  allowCreate = false,
  onCreate,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<MenuPos | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const row = rowRef.current;
      if (!row) return;
      const r = row.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(r.width, 260), vw - 16);
      let left = r.left;
      if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
      const menuH = panelRef.current?.offsetHeight ?? 320;
      const below = vh - r.bottom;
      const top =
        below < menuH + 8 && r.top > below
          ? Math.max(8, r.top - menuH - 4)
          : r.bottom + 4;
      setPos({ top, left, width });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = items.filter((it) => !search || it.name.toLowerCase().includes(search.toLowerCase()));
  const pickedItems = items.filter((it) => picked.has(it.id));

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const menu =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="caspian-msel__menu"
            ref={panelRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              minWidth: 0,
              maxWidth: 'none',
              zIndex: 1000,
              boxSizing: 'border-box',
            }}
          >
            <div className="caspian-catpick__search">
              <SearchIcon size={13} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
              />
            </div>
            <ul className="caspian-catpick__list">
              {filtered.map((it) => {
                const on = picked.has(it.id);
                const isChild = indent && !!it.parent;
                return (
                  <li key={it.id}>
                    <label className={on ? 'is-on' : ''}>
                      <input type="checkbox" checked={on} onChange={() => toggle(it.id)} />
                      <span
                        style={{
                          paddingLeft: isChild ? 20 : 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          flex: 1,
                        }}
                      >
                        {isChild && <span style={{ color: '#dadce0', fontSize: 12 }}>└</span>}
                        <span style={{ fontWeight: isChild ? 400 : 500 }}>{it.name}</span>
                        {it.meta != null && (
                          <span style={{ marginLeft: 'auto', color: '#5f6368', fontSize: 11 }}>
                            {it.meta}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="caspian-catpick__empty">
                  No matches{search ? ` for “${search}”` : ''}.
                </li>
              )}
            </ul>
            {allowCreate && search.trim() && (
              <button
                type="button"
                className="caspian-catpick__create"
                onClick={() => {
                  onCreate?.(search.trim());
                  setSearch('');
                }}
              >
                <PlusIcon size={12} /> Create “{search.trim()}”
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="caspian-msel" ref={ref}>
      <div className="caspian-msel__row" ref={rowRef}>
        <button
          type="button"
          className={`caspian-msel__pill ${open ? 'is-open' : ''} ${pickedItems.length ? 'has-pick' : ''}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{label}</span>
          {pickedItems.length > 0 && <em>{pickedItems.length}</em>}
          <ChevronDownIcon size={12} />
        </button>
        {pickedItems.length > 0 && (
          <div className="caspian-msel__chips">
            {pickedItems.map((it) => (
              <span key={it.id} className="caspian-msel__chip">
                {it.name}
                <button type="button" onClick={() => toggle(it.id)} aria-label={`Remove ${it.name}`}>
                  <XIcon size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {menu}
    </div>
  );
}
