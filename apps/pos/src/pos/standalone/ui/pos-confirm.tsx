'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useT } from '@caspian-explorer/script-caspian-store';
import { PosDialog } from './pos-dialog';

/**
 * "Are you sure?", in the register's own language and its own theme.
 *
 * Thirteen call sites used `window.confirm`, which has three problems a till
 * cannot live with. It is not translated -- the OK and Cancel buttons follow
 * the BROWSER's language, not the register's, so an Azerbaijani shop got
 * English buttons on the one screen that asks before destroying something. It
 * is unstyled, arriving as a system sheet in the middle of a themed app. And
 * after two or three of them Chrome offers "prevent this page from creating
 * additional dialogs" -- once that is ticked, `window.confirm` returns `false`
 * for the rest of the session, so **Delete silently stops working** with no
 * feedback of any kind. A cashier presses it, nothing happens, and nothing ever
 * will until they reload a page they have no reason to suspect.
 *
 * The API is imperative and promise-returning on purpose. Every one of the
 * thirteen handlers is already `async` and shaped `if (!window.confirm(x))
 * return;`, so each becomes a one-line swap. Threading `useState` for the
 * pending target, a `<PosConfirmDialog>` in JSX and a callback through
 * thirteen sites in eleven files is exactly the "eleven call sites do not each
 * get it slightly wrong" that `PosDialog` exists to prevent. `useToast` is the
 * precedent already in the tree.
 */

export interface PosConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  /** Defaults to `common.cancel`. */
  cancelLabel?: string;
  /** `danger` for anything destructive; `primary` for a re-issue or a re-run. */
  tone?: 'danger' | 'primary';
  /** Extra detail a native confirm could not carry — a count, a warning box. */
  detail?: ReactNode;
  /**
   * Start focus on Cancel rather than the verb. For a destructive action taken
   * often and under pressure, where the safe default matters more than the fast
   * one.
   */
  focus?: 'cancel' | 'confirm';
  /**
   * Require the exact word to be typed before the verb enables. For the two
   * actions with no undo and a whole shop's records behind them.
   */
  typeToConfirm?: { expected: string; hint: string };
}

type Ask = (options: PosConfirmOptions) => Promise<boolean>;

const PosConfirmContext = createContext<Ask | null>(null);

/**
 * Falls back to `window.confirm` rather than throwing when no provider is
 * above — the same posture as the other optional contexts in the till. The one
 * call site outside the mounted tree is the dormant cloud-admin licence screen,
 * which nothing renders; it keeps behaving exactly as it does today rather than
 * crashing if it is ever switched back on.
 */
export function usePosConfirm(): Ask {
  const ask = useContext(PosConfirmContext);
  return (
    ask ??
    ((options) => Promise.resolve(typeof window !== 'undefined' && window.confirm(options.body)))
  );
}

interface Pending extends PosConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function PosConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState('');
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const ask = useCallback<Ask>((options) => {
    return new Promise<boolean>((resolve) => {
      setTyped('');
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    setPending(null);
    setTyped('');
    current?.resolve(ok);
  }, []);

  const gate = pending?.typeToConfirm;
  const unlocked = !gate || typed.trim().toLowerCase() === gate.expected.trim().toLowerCase();

  const value = useMemo(() => ask, [ask]);

  return (
    <PosConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <PosDialog
          open
          size="sm"
          onOpenChange={(open) => {
            // Any dismissal that is not the verb is a "no". A confirm that
            // resolved nothing on Escape would leave its caller awaiting a
            // promise for the life of the page.
            if (!open) settle(false);
          }}
          title={pending.title}
          closeLabel={t('common.close')}
          foot={
            <>
              <button
                type="button"
                className="cpos-btn cpos-btn--outline"
                autoFocus={pending.focus === 'cancel'}
                onClick={() => settle(false)}
              >
                {pending.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                type="button"
                className={
                  pending.tone === 'primary'
                    ? 'cpos-btn cpos-btn--primary'
                    : 'cpos-btn cpos-btn--danger'
                }
                disabled={!unlocked}
                autoFocus={pending.focus !== 'cancel' && !gate}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{pending.body}</p>
          {pending.detail}
          {gate ? (
            <label className="cpos-field">
              <span className="cpos-field__label">{gate.hint}</span>
              <input
                className="cpos-input"
                value={typed}
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
          ) : null}
        </PosDialog>
      ) : null}
    </PosConfirmContext.Provider>
  );
}
