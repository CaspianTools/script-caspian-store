'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { cn } from '../utils/cn';
import { ChevronDownIcon, SearchIcon } from './icons';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional trailing hint shown in muted text next to the label (e.g. ISO code, description). */
  hint?: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  /** Placeholder inside the search input. Default "Type to filter…". */
  searchPlaceholder?: string;
  /** Text when the filter matches no option. Default "No matches." */
  emptyText?: string;
  /** Max height of the open dropdown list in pixels. Default 260. */
  maxListHeight?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

/**
 * Type-to-filter dropdown for long option lists (countries, states, pages).
 * Built on a button trigger + a popover containing a search input + filtered
 * list. Unlike the native `<select>`, it supports client-side fuzzy filter
 * and arbitrary option labels.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '— Select —',
  searchPlaceholder = 'Type to filter…',
  emptyText = 'No matches.',
  maxListHeight = 260,
  disabled,
  className,
  style,
  id,
}: SearchableSelectProps) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      // Defer so the input exists in the DOM before focusing.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (highlight > filtered.length - 1) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[highlight];
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  const pick = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[highlight];
      if (target) pick(target.value);
    } else if (e.key === 'Escape') {
      // Consumed here: a parent <Dialog>'s document listener would otherwise
      // close the whole dialog on the same keypress.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn('caspian-searchable-select', className)}
      style={{ position: 'relative', ...style }}
    >
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          border: '1px solid rgba(0,0,0,0.15)',
          borderRadius: 'var(--caspian-radius, 6px)',
          background: disabled ? '#f5f5f5' : '#fff',
          color: selected ? 'inherit' : '#888',
          fontSize: 14,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          gap: 8,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon size={16} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 40,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 'var(--caspian-radius, 8px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <SearchIcon size={14} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                border: 0,
                outline: 'none',
                fontSize: 14,
                background: 'transparent',
              }}
            />
          </div>
          <div ref={listRef} style={{ maxHeight: maxListHeight, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', color: '#888', fontSize: 13 }}>{emptyText}</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlight;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pick(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      border: 0,
                      background: isHighlighted
                        ? 'rgba(0,0,0,0.06)'
                        : isSelected
                          ? 'rgba(0,0,0,0.03)'
                          : 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                      textAlign: 'left',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <span>{opt.label}</span>
                    {opt.hint && (
                      <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                        {opt.hint}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
