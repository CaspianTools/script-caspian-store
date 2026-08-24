'use client';

import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--cpos-border, #eee)', borderRadius: 'var(--caspian-radius, 6px)' }}>
      <table
        className={cn('caspian-table', className)}
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
        {...rest}
      />
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
