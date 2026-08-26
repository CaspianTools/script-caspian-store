'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePosLocalSession } from '../../local-session-context';
import { PosQuickAddDialog } from './pos-quick-add-dialog';

export type QuickAddEntry = 'product' | 'category' | 'supplier' | 'person';

export interface PosQuickAddValue {
  /** Opens the dialog, optionally on a particular record. */
  open: (entry?: QuickAddEntry) => void;
  close: () => void;
  /**
   * Bumps every time Quick add writes something.
   *
   * List screens put it in their refresh dependencies, which is how a product
   * added from the top bar appears on the Store screen behind the dialog without
   * either of them knowing about the other. Cheaper and far less fragile than a
   * per-entity event bus, and the till has one writer.
   */
  savedCount: number;
}

const QuickAddContext = createContext<PosQuickAddValue | null>(null);

/**
 * The one place the till creates things.
 *
 * Mounted once, inside the lock gate, so a locked till has no dialog waiting
 * behind the lock screen. Every Add button on every standalone screen calls into
 * this rather than opening a dialog of its own -- before v1.4.0 a product could
 * be added from four places with three different-looking forms, and a category
 * from an inline table row that looked like nothing else in the register.
 *
 * It is mounted from `PosShell`, which a cloud-backed register renders too, so
 * it stands down entirely outside standalone mode: everything it can create
 * lives in IndexedDB and none of it exists on a cloud till. That is the gate
 * pos/CLAUDE.md permits a shared file to carry -- one that no-ops rather than
 * one that branches.
 */
export function PosQuickAddProvider({ children }: { children: ReactNode }) {
  const { standalone } = usePosLocalSession();
  const [entry, setEntry] = useState<QuickAddEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const open = useCallback((next?: QuickAddEntry) => {
    setEntry(next ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<PosQuickAddValue>(
    () => ({ open, close, savedCount }),
    [open, close, savedCount],
  );

  if (!standalone) return <>{children}</>;

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <PosQuickAddDialog
        open={isOpen}
        initialEntry={entry}
        onOpenChange={setIsOpen}
        onSaved={() => setSavedCount((n) => n + 1)}
      />
    </QuickAddContext.Provider>
  );
}

/**
 * Throws outside the provider rather than returning a no-op.
 *
 * Every caller is a standalone screen mounted under `PosShell`, so a missing
 * provider is a wiring mistake, and a silent no-op would show as an Add button
 * that does nothing at all.
 */
export function usePosQuickAdd(): PosQuickAddValue {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error('[caspian-pos] usePosQuickAdd must be used inside PosQuickAddProvider');
  return value;
}
