'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}
const TabsCtx = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const setCurrent = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsCtx.Provider value={{ value: current, setValue: setCurrent }}>
      <div className={cn('caspian-tabs', className)}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn('caspian-tabs-list', className)}
      style={{
        display: 'inline-flex',
        gap: 24,
        borderBottom: '1px solid var(--a-line, var(--line, #e8eaed))',
      }}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsCtx)!;
  const active = ctx.value === value;
  // Accent + muted resolve in both contexts: admin (`--a-*`) and storefront
  // (`--caspian`/`--accent`), falling back to the same hex either way.
  const accent = 'var(--a-accent, var(--accent, #1a73e8))';
  const muted = 'var(--a-muted, var(--muted, #5f6368))';
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cn('caspian-tabs-trigger', className)}
      style={{
        padding: '8px 2px',
        // Overlap the list's 1px rule so the active 2px bar reads as flush.
        marginBottom: -1,
        background: 'transparent',
        color: active ? accent : muted,
        border: 0,
        borderBottom: `2px solid ${active ? accent : 'transparent'}`,
        borderRadius: 0,
        cursor: 'pointer',
        fontWeight: active ? 600 : 500,
        fontSize: 14,
      }}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={cn('caspian-tabs-content', className)} style={{ paddingTop: 16 }}>
      {children}
    </div>
  );
}
