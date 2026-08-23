'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { CaspianFirebase } from '../firebase/client';
import type { UserProfile } from '../types';
import { logError, reportServiceError } from '../services/error-log-service';
import { tryEnsureAdminClaim } from '../services/storage-service';

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  /**
   * Create an account without asking the shopper for a password — the
   * storefront generates a random one, signs the user in, and emails a
   * password-reset link so they can pick a real password on their own. Used
   * when `SiteSettings.accounts.sendPasswordSetupLink` is enabled. Added in v2.10.
   */
  signUpWithSetupLink: (email: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /**
   * Create an anonymous Firebase Auth session. Used to back the "Continue as
   * guest" flow at checkout when `SiteSettings.accounts.allowGuestCheckout`
   * is true. Requires the Anonymous sign-in provider to be enabled in
   * Firebase Authentication. Added in v2.10.
   */
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchOrCreateUserProfile(
  firebase: CaspianFirebase,
  user: User,
): Promise<UserProfile> {
  const userDocRef = doc(firebase.db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    return { uid: user.uid, ...userDoc.data() } as UserProfile;
  }

  const newProfile: Omit<UserProfile, 'uid'> = {
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL,
    role: 'customer',
    addresses: [],
    wishlist: [],
    createdAt: Timestamp.now(),
  };

  await setDoc(userDocRef, newProfile);
  return { uid: user.uid, ...newProfile };
}

export function AuthProvider({
  firebase,
  children,
}: {
  /**
   * `null` on a standalone till, which has no Firebase project. Identity there
   * comes from the local accounts Technical Support created when the machine
   * was commissioned, so this provider resolves to a signed-out state and every
   * cloud sign-in method refuses rather than pretending to work.
   */
  firebase: CaspianFirebase | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // v8.6.0: pre-emptive admin-claim token refresh, gated to once per uid so
  // we don't loop on consumers whose `caspian-admin` Cloud Functions are
  // undeployed (the claim will never arrive — refreshing again won't help).
  const refreshedClaimForUid = useRef<string | null>(null);

  const requireFirebase = useCallback((): CaspianFirebase => {
    if (!firebase) {
      throw new Error(
        'This register runs standalone and has no Firebase project, so there is no cloud account to sign in to. Cashiers sign in with the local accounts created when the till was set up.',
      );
    }
    return firebase;
  }, [firebase]);

  useEffect(() => {
    // Standalone: settle immediately as signed-out. Leaving `loading` true
    // would hang every guard in the tree waiting for an auth state that no
    // one is ever going to publish.
    if (!firebase) {
      setUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(firebase.auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const profile = await fetchOrCreateUserProfile(firebase, firebaseUser);
          setUserProfile(profile);
          // If Firestore says admin but the cached ID token is missing the
          // `role: 'admin'` custom claim, force-refresh once. This pre-empts
          // the most common storage/unauthorized cause: the claim was set
          // (by `claimAdmin`, `onUserCreate`, or `syncAdminClaim`) AFTER
          // the user's last token issuance, so storage.rules' fast path
          // fails until the token rotates ~1h later. Refreshing here makes
          // the next admin write — Storage upload, Firestore write — see
          // the claim immediately. Bounded to once per uid so a consumer
          // who hasn't deployed the admin Functions doesn't loop.
          if (
            profile.role === 'admin' &&
            refreshedClaimForUid.current !== firebaseUser.uid
          ) {
            refreshedClaimForUid.current = firebaseUser.uid;
            try {
              const tokenResult = await firebaseUser.getIdTokenResult();
              if (tokenResult.claims.role !== 'admin') {
                // v8.8.0: try the server-side heal first
                // (`ensureAdminClaim` mirrors users/{uid}.role to the Auth
                // custom claim). Older Functions deployments without that
                // callable fall through to a plain getIdToken(true), which
                // is the v8.6.0 behavior — fine when the claim was already
                // set server-side and just hasn't reached the local token.
                await tryEnsureAdminClaim({ functions: firebase.functions, auth: firebase.auth });
              }
            } catch (error) {
              // Network blip — non-fatal. The retry inside
              // `uploadAdminImage` is a second line of defense.
              reportServiceError(firebase.db, 'auth-context.refreshAdminClaim', error);
            }
          }
        } catch (error) {
          reportServiceError(firebase.db, 'auth-context.fetchProfile', error);
          setUserProfile(null);
        }
      } else {
        refreshedClaimForUid.current = null;
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [firebase]);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      const firebase = requireFirebase();
      await setPersistence(
        firebase.auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );
      await signInWithEmailAndPassword(firebase.auth, email, password);
    },
    [requireFirebase],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const firebase = requireFirebase();
      const credential = await createUserWithEmailAndPassword(
        firebase.auth,
        email,
        password,
      );
      await updateProfile(credential.user, { displayName });
      const userDocRef = doc(firebase.db, 'users', credential.user.uid);
      await setDoc(userDocRef, { displayName }, { merge: true });
    },
    [requireFirebase],
  );

  const signUpWithSetupLink = useCallback(
    async (email: string, displayName: string) => {
      const firebase = requireFirebase();
      // Generate a high-entropy temporary password the shopper never sees —
      // we immediately email them a reset link so they can set a real one.
      const randomPassword = `TempPwd-${crypto.randomUUID()}-${Date.now()}`;
      const credential = await createUserWithEmailAndPassword(
        firebase.auth,
        email,
        randomPassword,
      );
      await updateProfile(credential.user, { displayName });
      const userDocRef = doc(firebase.db, 'users', credential.user.uid);
      await setDoc(userDocRef, { displayName }, { merge: true });
      // Best-effort; if the reset email fails the account still exists and
      // the shopper can use "forgot password" manually.
      try {
        await sendPasswordResetEmail(firebase.auth, email);
      } catch (error) {
        // Keep as warn — non-fatal; account was created successfully.
        // eslint-disable-next-line no-console
        console.warn('[caspian-store] Password setup email failed to send:', error);
        void logError(firebase.db, {
          source: 'service',
          origin: 'auth-context.sendPasswordResetEmail',
          error,
        });
      }
    },
    [requireFirebase],
  );

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(requireFirebase().auth, new GoogleAuthProvider());
  }, [requireFirebase]);

  const signInAsGuest = useCallback(async () => {
    await signInAnonymously(requireFirebase().auth);
  }, [requireFirebase]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(requireFirebase().auth);
  }, [requireFirebase]);

  const resetPassword = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(requireFirebase().auth, email);
    },
    [requireFirebase],
  );

  const refreshProfile = useCallback(async () => {
    if (!user || !firebase) return;
    try {
      const profile = await fetchOrCreateUserProfile(firebase, user);
      setUserProfile(profile);
    } catch (error) {
      reportServiceError(firebase.db, 'auth-context.refreshProfile', error);
    }
  }, [firebase, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signUpWithSetupLink,
        signInWithGoogle,
        signInAsGuest,
        signOut,
        refreshProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be called inside <CaspianStoreProvider>.');
  }
  return ctx;
}
