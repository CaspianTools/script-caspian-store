'use client';

import { useEffect, useRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /**
   * Below 820px each row renders as a card with every cell prefixed by its
   * column header (see the mobile-first block in globals.css). Default true.
   * Set false for tables whose cells are self-describing (a two-column
   * key/value table, a bare list).
   */
  responsive?: boolean;
}

export function Table({ className, responsive = true, children, ...rest }: TableProps) {
  const ref = useRef<HTMLTableElement | null>(null);

  // Stamp every body cell with its header's text so the card layout can
  // print it via `attr(data-label)`. Done from the DOM rather than a prop
  // on <TD> so the 30-odd admin tables need no per-cell changes; cells
  // that already carry a data-label keep it.
  useEffect(() => {
    if (!responsive) return;
    const table = ref.current;
    if (!table) return;
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th')).map(
      (th) => th.textContent?.trim() ?? '',
    );
    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
      Array.from(tr.cells).forEach((cell, i) => {
        if (cell.hasAttribute('data-label')) return;
        cell.setAttribute('data-label', headers[i] ?? '');
      });
    });
  });

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--cpos-border, #eee)', borderRadius: 'var(--caspian-radius, 6px)' }}>
      <table
        ref={ref}
        className={cn('caspian-table', className)}
        data-responsive={responsive ? 'true' : 'false'}
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('caspian-thead', className)} style={{ background: 'var(--cpos-surface-2, #fafafa)' }} {...rest} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('caspian-tr', className)} style={{ borderTop: '1px solid var(--cpos-border, #eee)' }} {...rest} />;
}

export function TH({ className, style, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('caspian-th', className)}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        whiteSpace: 'nowrap',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--cpos-fg-muted, #555)',
        ...style,
      }}
      {...rest}
    />
  );
}

export function TD({ className, style, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('caspian-td', className)}
      style={{
        padding: '10px 12px',
        verticalAlign: 'middle',
        ...style,
      }}
      {...rest}
    />
  );
}
