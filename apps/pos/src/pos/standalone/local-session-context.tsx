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
import { useCaspianStandalone } from '@caspian-explorer/script-caspian-store';
import {
  attemptLocalSignIn,
  type LocalPinUnlockResult,
  attemptLocalPinUnlock,
  clearPinFailures,
  clearLocalSession,
  createLocalUser,
  isCommissioned,
  readLocalSignInId,
  restoreLocalSession,
  startLocalSession,
  touchLocalSession,
  writeLocalSignInId,
  type LocalSignInResult,
} from './local-auth';
import { newLocalId, writeLocalShopSettings } from './local-db';
import { recoveryPatchFor } from './local-recovery';
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
  /**
   * True when this machine's own records could not be opened at all.
   *
   * Distinct from `commissioned: false`, and the distinction is the point. A
   * failed read used to collapse into "no accounts", which put a shop with a
   * year of trading history in front of a screen inviting it to set the till up
   * from scratch. Nothing was lost -- the write would have failed too -- but a
   * setup screen is the wrong thing to show somebody whose data is still there
   * and merely unreachable.
   */
  storageFailed: boolean;
  /**
   * True when the till has locked itself after sitting idle.
   *
   * Not the same as signed out, and the difference is load-bearing. The account
   * stays, `signInId` stays, and the open ticket stays; only the screen is
   * covered until the password is typed again. A lock that signed the cashier
   * out would send them back through the drawer-count gate every time they
   * turned round to serve somebody.
   */
  locked: boolean;
  signIn: (username: string, password: string) => Promise<boolean>;
  /** Like `signIn`, but says why it refused — including how long to wait. */
  attemptSignIn: (username: string, password: string) => Promise<LocalSignInResult>;
  /** Cover the screen without ending the session. */
  lock: () => void;
  /** Uncover it. Same password, same delay ladder, same `signInId`. */
  unlock: (password: string) => Promise<LocalSignInResult>;
  /** The lock screen's short way back in. See the PIN note in `local-auth.ts`. */
  unlockWithPin: (pin: string) => Promise<LocalPinUnlockResult>;
  signOut: () => void;
  /**
   * Create the first account — the Technical Support one. Refuses once any
   * account exists.
   *
   * `recoveryCode` is optional so the shape stays the one consumers already
   * call. Pass one and its hash is stored against the account this creates;
   * omit it and the till is commissioned without a way back in, which is the
   * state every till from before v1.1.0 starts in.
   */
  commission: (input: {
    username: string;
    displayName: string;
    password: string;
    recoveryCode?: string;
    /**
     * What the setup step collected: shop name and currency. Merged into the
     * same write that stores the recovery hash, so a fresh till is commissioned
     * in one transaction rather than two.
     */
    shop?: { shopName: string; currency: string };
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
  storageFailed: false,
  locked: false,
  signIn: async () => false,
  attemptSignIn: async () => ({ ok: false, reason: 'bad-credentials' }),
  lock: () => undefined,
  unlock: async () => ({ ok: false, reason: 'bad-credentials' }),
  unlockWithPin: async () => ({ ok: false, reason: 'no-pin' }),
  signOut: () => undefined,
  commission: async () => ({ ok: false, reason: 'not-standalone' }),
  refresh: async () => undefined,
};

/**
 * How often the provider re-checks that the signed-in account still applies.
 *
 * Blocking somebody used to take effect only when the page happened to reload,
 * which on a till that stays open all day meant "not today". A minute is slow
 * enough that this is a rounding error against IndexedDB and fast enough that an
 * owner who has just blocked a leaver can watch it happen.
 */
const LIVENESS_INTERVAL_MS = 60_000;

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
  const [storageFailed, setStorageFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(standalone);

  const refresh = useCallback(async () => {
    if (!standalone) return;
    try {
      const [restored, hasAccounts] = await Promise.all([restoreLocalSession(), isCommissioned()]);
      setUser(restored);
      setSignInId(restored ? adoptSignInId() : null);
      setCommissioned(hasAccounts);
      setStorageFailed(false);
      if (!restored) setLocked(false);
    } catch {
      setStorageFailed(true);
    } finally {
      setLoading(false);
    }
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
        setStorageFailed(false);
      } catch {
        // Blocked or unavailable storage. Say so, rather than reporting "no
        // accounts" -- which is indistinguishable from a brand-new machine and
        // put a trading shop in front of the setup form.
        if (alive) {
          setUser(null);
          setSignInId(null);
          setCommissioned(false);
          setStorageFailed(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [standalone]);

  /**
   * Re-check the stored session while the till is open.
   *
   * `restoreLocalSession` is what notices a blocked account or a password that
   * has been reset, and nothing was calling it after mount. On a timer *and* on
   * visibilitychange, because a till that has been in the background all
   * afternoon should catch up the moment somebody looks at it rather than up to
   * a minute later.
   */
  useEffect(() => {
    if (!standalone || !user) return;
    let alive = true;
    const check = () => {
      restoreLocalSession()
        .then((live) => {
          if (!alive) return;
          if (!live) {
            setUser(null);
            setSignInId(null);
            setLocked(false);
          }
        })
        .catch(() => {
          // A failed read here is not evidence the account is gone, and signing
          // a working cashier out on a transient error is the worse mistake.
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const timer = window.setInterval(check, LIVENESS_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [standalone, user]);

  const attemptSignIn = useCallback(async (username: string, password: string) => {
    const result = await attemptLocalSignIn(username, password);
    if (!result.ok) return result;
    const minted = newLocalId();
    startLocalSession(result.user);
    writeLocalSignInId(minted);
    setUser(result.user);
    setSignInId(minted);
    setLocked(false);
    return result;
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => (await attemptSignIn(username, password)).ok,
    [attemptSignIn],
  );

  const lock = useCallback(() => setLocked(true), []);

  /**
   * Same password and the same delay ladder as the front door, but the session
   * is not re-minted: `signInId` survives, so the opening-cash gate does not ask
   * again. Signing in as somebody else is a separate button that does sign out.
   */
  const unlock = useCallback(
    async (password: string): Promise<LocalSignInResult> => {
      if (!user) return { ok: false, reason: 'bad-credentials' };
      const result = await attemptLocalSignIn(user.username, password);
      if (result.ok) {
        setUser(result.user);
        touchLocalSession();
        setLocked(false);
        // The password proving itself is the ONLY thing that re-arms a PIN
        // that five bad guesses shut off.
        clearPinFailures(result.user.id);
      }
      return result;
    },
    [user],
  );

  const unlockWithPin = useCallback(
    async (pin: string): Promise<LocalPinUnlockResult> => {
      if (!user) return { ok: false, reason: 'no-pin' };
      const result = await attemptLocalPinUnlock(user.id, pin);
      if (result.ok) {
        setUser(result.user);
        touchLocalSession();
        setLocked(false);
      }
      return result;
    },
    [user],
  );

  const signOut = useCallback(() => {
    clearLocalSession();
    setUser(null);
    setSignInId(null);
    setLocked(false);
  }, []);

  const commission = useCallback(
    async (input: {
      username: string;
      displayName: string;
      password: string;
      recoveryCode?: string;
      shop?: { shopName: string; currency: string };
    }) => {
      if (await isCommissioned()) return { ok: false as const, reason: 'already-commissioned' };
      const role: PosLocalRole = 'superadmin';
      const { recoveryCode, shop, ...account } = input;
      const created = await createLocalUser({ ...account, role });
      if (!created.ok) return { ok: false as const, reason: created.reason };
      // Stored after the account exists, because the code names the account it
      // resets and there is nothing to name until now. A failure here must not
      // take the account with it: a till with an account and no recovery code
      // is the state every till commissioned before this release is in, and it
      // is recoverable from the App admin screen. A till with neither is not.
      if (recoveryCode || shop) {
        try {
          // One write, not two. `writeLocalShopSettings` is a read-merge-write
          // in a single IndexedDB transaction, so folding the setup answers in
          // here adds no new failure mode to the one already reasoned about.
          await writeLocalShopSettings({
            ...(recoveryCode ? await recoveryPatchFor(recoveryCode, created.user.id) : {}),
            ...(shop
              ? {
                  shopName: shop.shopName,
                  currency: shop.currency,
                  // The moment the till was actually commissioned. It used to be
                  // stamped by the unrelated act of saving the Shop panel, so a
                  // till that never opened that screen reported never having
                  // been set up.
                  commissionedAtMillis: Date.now(),
                }
              : {}),
          });
        } catch {
          // Left without a code. The App admin screen says so and offers one.
        }
      }
      const minted = newLocalId();
      startLocalSession(created.user);
      writeLocalSignInId(minted);
      setUser(created.user);
      setSignInId(minted);
      setCommissioned(true);
      setLocked(false);
      return { ok: true as const };
    },
    [],
  );

  const value = useMemo<PosLocalSessionValue>(
    () =>
      standalone
        ? {
            user,
            signInId,
            loading,
            commissioned,
            standalone,
            storageFailed,
            locked,
            signIn,
            attemptSignIn,
            lock,
            unlock,
      unlockWithPin,
            signOut,
            commission,
            refresh,
          }
        : INERT,
    [
      standalone,
      user,
      signInId,
      loading,
      commissioned,
      storageFailed,
      locked,
      signIn,
      attemptSignIn,
      lock,
      unlock,
      unlockWithPin,
      signOut,
      commission,
      refresh,
    ],
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
