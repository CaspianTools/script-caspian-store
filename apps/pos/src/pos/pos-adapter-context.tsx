'use client';

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useAuth, useCaspianFirebaseOptional } from '@caspian-explorer/script-caspian-store';
import { getPosDeviceId } from './pos-device';
import { PosSaleQueue } from './offline/pos-sale-queue';
import { resolvePosStorageMode } from './pos-preferences';
import { usePosLocalSession } from './standalone/local-session-context';
import { PosLocalAdapter } from './storage/local-adapter';
import { PosQueuedCloudAdapter } from './storage/queued-cloud-adapter';
import type { PosStorageAdapter } from './storage/types';

export interface PosAdapterValue {
  adapter: PosStorageAdapter;
  /** `null` on a standalone till, which has no outbox and nothing to send to. */
  queue: PosSaleQueue | null;
}

const PosAdapterContext = createContext<PosAdapterValue | null>(null);

/**
 * Who is at the till, read at call time rather than captured in a closure.
 *
 * A sale held overnight and drained by a different person in the morning must
 * still be attributed to the cashier who actually rang it, so the adapter is
 * handed a getter and never a value.
 */
function usePosIdentity(): () => { uid: string; name: string } {
  const { user, userProfile } = useAuth();
  const local = usePosLocalSession();
  const ref = useRef({ uid: '', name: '' });
  ref.current = local.standalone
    ? { uid: local.user?.id ?? '', name: local.user?.displayName ?? '' }
    : { uid: user?.uid ?? '', name: userProfile?.displayName || user?.email || '' };
  return useCallback(() => ref.current, []);
}

function useBuiltPosAdapter(): PosAdapterValue {
  const firebase = useCaspianFirebaseOptional();
  const identity = usePosIdentity();
  const deviceId = useMemo(() => getPosDeviceId(), []);
  const mode = resolvePosStorageMode(Boolean(firebase));

  return useMemo<PosAdapterValue>(() => {
    if (mode === 'local' || !firebase) {
      return { adapter: new PosLocalAdapter(deviceId, identity), queue: null };
    }
    const queue = new PosSaleQueue(firebase.functions, deviceId);
    return {
      adapter: new PosQueuedCloudAdapter(
        firebase.db,
        firebase.functions,
        deviceId,
        identity,
        queue,
      ),
      queue,
    };
  }, [mode, firebase, deviceId, identity]);
}

/**
 * One adapter, and therefore one outbox, for the whole register.
 *
 * Before this, `PosShell`, `PosRegister` and `PosQueuePage` each constructed
 * their own `PosSaleQueue`. They shared IndexedDB, so no sale was ever lost —
 * but `capture()` and `markSent()` notify listeners on the instance they were
 * called on, and the connection pill was subscribed to a different one. The
 * held-sales badge therefore only moved on the pill's own 30-second timer, and
 * `paused`, which lives in instance memory rather than on disk, could not be
 * observed by the pill at all.
 */
export function PosAdapterProvider({ children }: { children: ReactNode }) {
  const value = useBuiltPosAdapter();
  return <PosAdapterContext.Provider value={value}>{children}</PosAdapterContext.Provider>;
}

/**
 * The register's storage seam.
 *
 * Builds its own when no provider is above it, because `PosRegister` is a
 * public export a consumer may mount outside `PosShell`. Same posture as
 * `usePosLocalSession`: a missing provider is a supported arrangement, not a
 * crash.
 */
export function usePosAdapter(): PosAdapterValue {
  const shared = useContext(PosAdapterContext);
  const own = useBuiltPosAdapter();
  return shared ?? own;
}
