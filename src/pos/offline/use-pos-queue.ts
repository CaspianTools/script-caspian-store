'use client';

import { useEffect, useState } from 'react';
import type { PosSaleQueue, QueueSnapshot } from './pos-sale-queue';

const EMPTY: QueueSnapshot = {
  counts: { held: 0, blocked: 0, sending: 0 },
  leasedRemaining: 0,
  paused: false,
};

/**
 * Live view of what this till is holding, plus whether it can reach the server.
 *
 * `navigator.onLine` is famously optimistic — it reports a connected wifi
 * adapter, not a reachable Firestore — so it is used only to decide when it is
 * worth *trying*. Whether a sale actually landed is decided by the commit, never
 * by this flag.
 */
export function usePosQueue(queue: PosSaleQueue | null): QueueSnapshot & { online: boolean } {
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(EMPTY);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine !== false);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (!queue) return;
    const unsubscribe = queue.subscribe(setSnapshot);
    queue.start();
    void queue.ensureLease();
    void queue.drain();

    // The moment the network returns is the moment to try, rather than waiting
    // out the timer with a cashier watching a held-sales badge.
    const onOnline = () => {
      void queue.ensureLease();
      void queue.drain();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void queue.drain();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      queue.stop();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queue]);

  return { ...snapshot, online };
}
