import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { Product } from '@caspian-explorer/script-caspian-store';
import { PosCloudAdapter } from './cloud-adapter';
import type { PosCommittedSale, PosSaleDraft, PosStorageAdapter } from './types';
import type { PosSaleQueue } from '../offline/pos-sale-queue';
import { lookupCachedByCode, searchCachedProducts } from '../offline/pos-catalog-cache';

/** How long to wait for a commit before deciding the network is not going to answer. */
const COMMIT_FUSE_MS = 3000;

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * The register's adapter when offline selling is on.
 *
 * Wraps `PosCloudAdapter` rather than replacing it, so `PosRegister` never
 * learns whether the network is up — it asks for a sale to be committed and
 * gets a `PosCommittedSale` back either way. The only difference the UI sees is
 * `pending: true`, which the sale-complete screen and the receipt both read.
 *
 * Order of operations in `commitSale` is the whole design:
 *
 *   1. write the sale to IndexedDB and **await the commit** — including
 *      spending the receipt ordinal in the same transaction;
 *   2. only then attempt the network, raced against a short fuse;
 *   3. on success mark it sent and return the server's answer;
 *   4. otherwise return the leased number with `pending: true`.
 *
 * Step 1 comes first because a request that timed out and a request that was
 * rejected are indistinguishable from here. Deciding before acting sidesteps a
 * question that cannot be answered after the fact.
 *
 * The fuse is 3 seconds rather than the SDK's default 70. Seventy seconds of a
 * frozen till with a queue forming is not a thing anyone would choose; and
 * leaving the call running costs nothing, because the leased receipt number is
 * identical on both paths, so a late landing reconciles through the idempotency
 * gate with no visible consequence.
 *
 * The queue is INJECTED rather than constructed here. It used to be built in
 * the constructor, which meant the register and the connection pill each held
 * their own instance: they shared IndexedDB so no sale was lost, but `capture`
 * and `markSent` emitted to an instance nobody was listening to, so the
 * held-sales badge only moved on the other instance's 30-second timer, and the
 * two could never agree about `paused` at all.
 */
export class PosQueuedCloudAdapter implements PosStorageAdapter {
  readonly mode = 'cloud' as const;
  private readonly inner: PosCloudAdapter;

  constructor(
    db: Firestore,
    functions: Functions,
    private readonly deviceId: string,
    private readonly identity: () => { uid: string; name: string },
    readonly queue: PosSaleQueue,
  ) {
    this.inner = new PosCloudAdapter(db, functions);
  }

  async lookupByCode(code: string) {
    if (isOnline()) {
      try {
        return await this.inner.lookupByCode(code);
      } catch (error) {
        // Fall through to the cache: a lookup that failed because the network
        // died is exactly when the cache earns its keep.
        const cached = await lookupCachedByCode(code);
        if (cached) return cached;
        throw error;
      }
    }
    return lookupCachedByCode(code);
  }

  async searchProducts(term: string): Promise<Product[]> {
    if (isOnline()) {
      try {
        return await this.inner.searchProducts(term);
      } catch {
        return searchCachedProducts(term);
      }
    }
    return searchCachedProducts(term);
  }

  findCommittedSale(saleId: string) {
    return this.inner.findCommittedSale(saleId);
  }

  async commitSale(draft: PosSaleDraft): Promise<PosCommittedSale> {
    const who = this.identity();
    const captured = draft.capturedTotal ?? 0;

    const held = await this.queue.capture({
      draft: { ...draft, deviceId: draft.deviceId || this.deviceId },
      capturedTotal: captured,
      capturedSubtotal: draft.capturedSubtotal ?? captured,
      capturedByUid: who.uid,
      capturedByName: who.name,
      localRef: draft.saleId.slice(-6).toUpperCase(),
    });

    if (isOnline()) {
      const attempt = this.inner.commitSale({
        ...draft,
        ...(held.receipt
          ? { receipt: { leaseId: held.receipt.leaseId, ordinal: held.receipt.ordinal } }
          : {}),
        capturedByUid: who.uid,
        capturedByName: who.name,
      });
      const raced = await Promise.race([
        attempt.then((sale) => ({ ok: true as const, sale })).catch(() => ({ ok: false as const })),
        new Promise<{ ok: false }>((resolve) =>
          setTimeout(() => resolve({ ok: false as const }), COMMIT_FUSE_MS),
        ),
      ]);
      if (raced.ok) {
        await this.queue.markSent(draft.saleId, raced.sale);
        return raced.sale;
      }
      // Deliberately NOT cancelled. If it lands late it collides with this same
      // sale id and the idempotency gate returns the original order.
      void attempt.catch(() => undefined);
    }

    // Held on this device. The customer already has the receipt.
    //
    // `localRef` is the fallback when the leased block ran dry, and it has to be
    // used: returning the empty string that `capture` hands back in that case
    // printed a receipt with no identifier on it at all, which is worse than the
    // slip the lease design was willing to settle for. Flagged as provisional so
    // the receipt says what the number is rather than passing a device-local
    // reference off as a server-issued one.
    const provisional = !held.receiptNumber;
    return {
      orderId: draft.saleId,
      receiptNumber: held.receiptNumber || held.localRef,
      total: captured,
      duplicate: false,
      stockShortfall: [],
      pending: true,
      ...(provisional ? { provisionalReceipt: true } : {}),
    };
  }
}
