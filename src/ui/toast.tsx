'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n/locale-context';
import { CheckIcon, InfoIcon, XIcon } from './icons';

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  /**
   * `default` is neutral, `success` confirms a completed action, and
   * `destructive` reports a failure. `success` was added in v15.1.0; callers
   * that never set a variant keep the neutral look.
   */
  variant?: 'default' | 'success' | 'destructive';
  durationMs?: number;
}

interface ToastContextValue {
  toast: (msg: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const PALETTE: Record<NonNullable<ToastMessage['variant']>, { bg: string; accent: string }> = {
  default: { bg: '#1f2937', accent: '#93c5fd' },
  success: { bg: '#14532d', accent: '#86efac' },
  destructive: { bg: '#7f1d1d', accent: '#fca5a5' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (msg: Omit<ToastMessage, 'id'>) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { ...msg, id }]);
      // One timer per toast, owned by the toast, so adding a second toast
      // no longer resets the countdown of the first (the previous effect
      // re-armed every timer on each state change).
      const duration = msg.durationMs ?? (msg.variant === 'destructive' ? 6000 : 4000);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((handle) => window.clearTimeout(handle));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="caspian-toast-region"
        aria-live="polite"
        aria-relevant="additions"
        style={{
          position: 'fixed',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          right: 16,
          left: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const t = useT();
  const variant = toast.variant ?? 'default';
  const palette = PALETTE[variant];
  const Icon = variant === 'success' ? CheckIcon : InfoIcon;
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className="caspian-toast"
      data-variant={variant}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: 'min(360px, 100%)',
        boxSizing: 'border-box',
        background: palette.bg,
        color: '#fff',
        padding: '12px 12px 12px 14px',
        borderRadius: 'var(--caspian-radius, 6px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
        pointerEvents: 'auto',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          flexShrink: 0,
          marginTop: 1,
          color: palette.accent,
        }}
      >
        <Icon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && <p style={{ margin: 0, fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>{toast.title}</p>}
        {toast.description && (
          <p style={{ margin: toast.title ? '2px 0 0' : 0, fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        className="caspian-toast-dismiss"
        aria-label={t('common.dismiss')}
        onClick={onDismiss}
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 0,
          borderRadius: 999,
          background: 'transparent',
          color: '#fff',
          opacity: 0.7,
          cursor: 'pointer',
          padding: 0,
          marginTop: -2,
          marginRight: -4,
        }}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback: log to console if provider not mounted.
    return {
      toast: (msg: Omit<ToastMessage, 'id'>) =>
        console.log(`[caspian-toast] ${msg.title ?? ''}${msg.description ? ' — ' + msg.description : ''}`),
    };
  }
  return ctx;
}
