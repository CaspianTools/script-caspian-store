'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useCaspianStandalone } from '../../provider/caspian-store-provider';
import {
  clearLocalSession,
  createLocalUser,
  isCommissioned,
  readLocalSignInId,
  restoreLocalSession,
  signInLocal,
  writeLocalSessionId,
  writeLocalSignInId,
} from './local-auth';
import { newLocalId } from './local-db';
import type { LocalUser, PosLocalRole } from './types';

export interface PosLocalSessionValue {
  /** The signed-in local account, or `null`. Always `null` outside standalone mode. */
  user: LocalUser | null;
  /**
   * Identifies the current sign-in, for records that must not carry over into
   * the next one — the opening-cash gate compares it by equality. Null when
   * nobody is signed in.
   */
  signInId: string | null;
  /** True until the stored session has been resolved against the account list. */
  loading: boolean;
  /**
   * Whether this machine has any accounts yet. False means Technical Support
   * has not commissioned it, and the only thing it can offer is that setup.
   */
  commissioned: boolean;
  /** True when the tree was mounted standalone. Everything else is inert otherwise. */
  standalone: boolean;
  signIn: (username: string, password: string) => Promise<boolean>;
  signOut: () => void;
  /** Create the first account — the Technical Support one. Refuses once any account exists. */
  commission: (input: {
    username: string;
    displayName: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  refresh: () => Promise<void>;
}

const PosLocalSessionContext = createContext<PosLocalSessionValue | null>(null);

const INERT: PosLocalSessionValue = {
  user: null,
  signInId: null,
  loading: false,
  commissioned: false,
  standalone: false,
  signIn: async () => false,
  signOut: () => undefined,
  commission: async () => ({ ok: false, reason: 'not-standalone' }),
  refresh: async () => undefined,
};

/**
 * The sign-in id for a session that was restored rather than freshly entered.
 *
 * Load-bearing, not tidying. React state is the authority for this tab and
 * localStorage only lets it survive a reload, so a till with blocked site data
 * must still end up holding an id: without the minting branch it would stamp a
 * confirmation with an id that `readLocalSignInId()` then reports as null, and
 * the cashier could never satisfy the opening-cash gate — the drawer screen
 * would come back after every confirmation. Minting and holding it regardless
 * degrades that to "declare the drawer once per tab", which is the same bargain
 * `writeLocalSessionId` already strikes when storage is blocked.
 */
function adoptSignInId(): string {
  const stored = readLocalSignInId();
  if (stored) return stored;
  const minted = newLocalId();
  writeLocalSignInId(minted);
  return minted;
}

/**
 * Who is at the till, when there is no Firebase Auth to ask.
 *
 * Mounted unconditionally around the register so the guard below it can be
 * written once, but it does no work at all outside standalone mode — a cloud
 * store must not have this reaching into IndexedDB for accounts it will never
 * have, and `user` staying null there is what keeps the two identity models
 * from ever being live at the same time.
 */
export function PosLocalSessionProvider({ children }: { children: ReactNode }) {
  const standalone = useCaspianStandalone();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [signInId, setSignInId] = useState<string | null>(null);
  const [commissioned, setCommissioned] = useState(false);
  const [loading, setLoading] = useState(standalone);

  const refresh = useCallback(async () => {
    if (!standalone) return;
    const [restored, hasAccounts] = await Promise.all([restoreLocalSession(), isCommissioned()]);
    setUser(restored);
    setSignInId(restored ? adoptSignInId() : null);
    setCommissioned(hasAccounts);
    setLoading(false);
  }, [standalone]);

  useEffect(() => {
    if (!standalone) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [restored, hasAccounts] = await Promise.all([
          restoreLocalSession(),
          isCommissioned(),
        ]);
        if (!alive) return;
        setUser(restored);
        setSignInId(restored ? adoptSignInId() : null);
        setCommissioned(hasAccounts);
      } catch {
        // Blocked or unavailable storage. Treat as "not commissioned" so the
        // screen tells someone to fix it, rather than looping on a sign-in
        // form that can never succeed.
        if (alive) {
          setUser(null);
          setSignInId(null);
          setCommissioned(false);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [standalone]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const found = await signInLocal(username, password);
      if (!found) return false;
      const minted = newLocalId();
      writeLocalSessionId(found.id);
      writeLocalSignInId(minted);
      setUser(found);
      setSignInId(minted);
      return true;
    },
    [],
  );

  const signOut = useCallback(() => {
    clearLocalSession();
    setUser(null);
    setSignInId(null);
  }, []);

  const commission = useCallback(
    async (input: { username: string; displayName: string; password: string }) => {
      if (await isCommissioned()) return { ok: false as const, reason: 'already-commissioned' };
      const role: PosLocalRole = 'superadmin';
      const created = await createLocalUser({ ...input, role });
      if (!created.ok) return { ok: false as const, reason: created.reason };
      const minted = newLocalId();
      writeLocalSessionId(created.user.id);
      writeLocalSignInId(minted);
      setUser(created.user);
      setSignInId(minted);
      setCommissioned(true);
      return { ok: true as const };
    },
    [],
  );

  const value = useMemo<PosLocalSessionValue>(
    () =>
      standalone
        ? { user, signInId, loading, commissioned, standalone, signIn, signOut, commission, refresh }
        : INERT,
    [standalone, user, signInId, loading, commissioned, signIn, signOut, commission, refresh],
  );

  return (
    <PosLocalSessionContext.Provider value={value}>{children}</PosLocalSessionContext.Provider>
  );
}

/**
 * Returns the inert value rather than throwing when no provider is above.
 *
 * A cloud store that never mounts the provider still renders `PosGuard`, and
 * making that throw would turn a standalone-only concern into a crash on every
 * existing till.
 */
export function usePosLocalSession(): PosLocalSessionValue {
  return useContext(PosLocalSessionContext) ?? INERT;
}
