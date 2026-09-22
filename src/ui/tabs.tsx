'use client';

import { createContext, useContext, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../utils/cn';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
}
const TabsCtx = createContext<TabsContextValue | null>(null);

// Tab values are free-form (may contain spaces); keep the derived DOM ids valid.
const slug = (v: string) => v.replace(/[^A-Za-z0-9_-]+/g, '-');
const tabId = (baseId: string, v: string) => `${baseId}-tab-${slug(v)}`;
const panelId = (baseId: string, v: string) => `${baseId}-panel-${slug(v)}`;

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const baseId = useId();
  const current = value ?? internal;
  const setCurrent = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsCtx.Provider value={{ value: current, setValue: setCurrent, baseId }}>
      <div className={cn('caspian-tabs', className)}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  // Roving tabindex: only the active tab is in the tab order; arrows/Home/End
  // move focus and activate (automatic activation, per the WAI-ARIA pattern).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    if (tabs.length === 0) return;
    const idx = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = idx < 0 ? 0 : (idx + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = idx < 0 ? tabs.length - 1 : (idx - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };
  return (
    <div
      role="tablist"
      className={cn('caspian-tabs-list', className)}
      onKeyDown={onKeyDown}
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
      type="button"
      role="tab"
      id={tabId(ctx.baseId, value)}
      aria-selected={active}
      aria-controls={panelId(ctx.baseId, value)}
      tabIndex={active ? 0 : -1}
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
    <div
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={tabId(ctx.baseId, value)}
      className={cn('caspian-tabs-content', className)}
      style={{ paddingTop: 16 }}
    >
      {children}
    </div>
  );
}
