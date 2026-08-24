import type { Functions } from 'firebase/functions';
import { httpsCallable } from 'firebase/functions';
import type { PosCommittedSale, PosSaleDraft } from '../storage/types';
import type { QueuedSale, QueueCounts, ReceiptLease } from './types';
import {
  STORE_LEASES,
  STORE_QUEUE,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  posIdbAvailable,
  posTx,
} from './pos-queue-db';
import { backoffMillis, classifyCommitError } from './classify-commit-error';

/** Ask for a fresh block once the current one drops below this many numbers. */
const LEASE_TOPUP_AT = 100;
/** Warn the cashier while they are still online and can do something about it. */
export const LEASE_LOW_AT = 40;

export interface SpentReceipt {
  leaseId: string;
  ordinal: number;
  receiptNumber: string;
}

export interface QueueSnapshot {
  counts: QueueCounts;
  /** Numbers left across all open leases. */
  leasedRemaining: number;
  /**
   * True once a lease request has actually failed.
   *
   * Distinct from `leasedRemaining === 0`, which is also what a healthy till
   * looks like in the moment before its first lease resolves. Without the
   * distinction a store that never deployed `functions-pos` shows a
   * "running low on receipt numbers" warning forever, with no way to clear it
   * and no hint that the cause is a missing deployment.
   */
  leaseUnavailable: boolean;
  paused: boolean;
  pauseReasonKey?: string;
}

type Listener = (snapshot: QueueSnapshot) => void;

/**
 * The register's hold-and-forward queue.
 *
 * One invariant matters more than everything else here, and it is the reason
 * for the ordering in `capture()`: **the sale is on disk, committed, before any
 * network call is attempted.** A commit that times out and a commit that was
 * rejected are indistinguishable from the client, so the queue never tries to
 * decide after the fact whether a sale survived — it decides before acting.
 */
export class PosSaleQueue {
  private listeners = new Set<Listener>();
  private draining = false;
  private paused = false;
  private pauseReasonKey: string | undefined;
  private timer: ReturnType<typeof setInterval> | null = null;
  private watchers = 0;
  private leaseFailed = false;
  private recovered = false;

  constructor(
    /**
     * `null` on a standalone till, which has no callables to reach. The queue
     * still reads and lists — a till switched from cloud to local with sales
     * already held must not lose sight of them — but it can no longer send.
     */
    private readonly functions: Functions | null,
    private readonly deviceId: string,
  ) {}

  // ----------------------------------------------------------------- lifecycle

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    void this.emit();
    return () => this.listeners.delete(fn);
  }

  private async emit(): Promise<void> {
    if (!this.listeners.size) return;
    const snapshot = await this.snapshot();
    for (const fn of this.listeners) fn(snapshot);
  }

  async snapshot(): Promise<QueueSnapshot> {
    if (!posIdbAvailable()) {
      return {
        counts: { held: 0, blocked: 0, sending: 0 },
        leasedRemaining: 0,
        leaseUnavailable: this.leaseFailed,
        paused: false,
      };
    }
    const [sales, leases] = await posTx([STORE_QUEUE, STORE_LEASES], 'readonly', async (tx) => [
      await idbGetAll<QueuedSale>(tx, STORE_QUEUE),
      await idbGetAll<ReceiptLease>(tx, STORE_LEASES),
    ]);
    const counts = { held: 0, blocked: 0, sending: 0 };
    for (const s of sales) {
      if (s.state === 'held') counts.held++;
      else if (s.state === 'blocked') counts.blocked++;
      else if (s.state === 'sending') counts.sending++;
    }
    const leasedRemaining = leases.reduce((n, l) => n + Math.max(0, l.size - l.nextOrdinal), 0);
    return {
      counts,
      leasedRemaining,
      leaseUnavailable: this.leaseFailed,
      paused: this.paused,
      pauseReasonKey: this.pauseReasonKey,
    };
  }

  /**
   * Drain on a timer while there is anything to send. Cheap when the queue is
   * empty.
   *
   * Reference-counted, because more than one screen watches the same queue: the
   * status pill in the chrome, the badge on the held-sales menu item, and the
   * held-sales page itself. Before this counter existed the last of those to
   * unmount stopped the timer for all of them -- so walking from Held sales back
   * to the register left a till that no longer retried on its own, and only
   * looked fine because the next scan happened to drain it.
   */
  start(): void {
    this.watchers++;
    if (this.timer) return;
    this.timer = setInterval(() => void this.drain(), 30_000);
  }

  stop(): void {
    this.watchers = Math.max(0, this.watchers - 1);
    if (this.watchers > 0) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  resume(): void {
    this.paused = false;
    this.pauseReasonKey = undefined;
    void this.drain();
  }

  // -------------------------------------------------------------------- leases

  /**
   * Spend the next receipt number from a leased block, atomically.
   *
   * Returns null when there is nothing left to spend — the caller then falls
   * back to a local reference, and the customer visibly gets a slip rather than
   * a receipt. That is a worse outcome, so `ensureLease` tops up early enough
   * that it should not happen in a normal outage.
   */
  private async spendOrdinal(tx: IDBTransaction): Promise<SpentReceipt | null> {
    const leases = await idbGetAll<ReceiptLease>(tx, STORE_LEASES);
    // Oldest block first, so numbers come out roughly in order.
    leases.sort((a, b) => a.from - b.from);
    for (const lease of leases) {
      if (lease.nextOrdinal < lease.size) {
        const ordinal = lease.nextOrdinal;
        const receiptNumber = `${lease.prefix}-${String(lease.from + ordinal).padStart(6, '0')}`;
        await idbPut(tx, STORE_LEASES, { ...lease, nextOrdinal: ordinal + 1 });
        return { leaseId: lease.leaseId, ordinal, receiptNumber };
      }
    }
    return null;
  }

  /** Top up while online, so an outage starts with numbers in hand. */
  async ensureLease(): Promise<void> {
    if (!posIdbAvailable() || typeof navigator === 'undefined' || !navigator.onLine) return;
    if (!this.functions) return;
    const { leasedRemaining } = await this.snapshot();
    if (leasedRemaining > LEASE_TOPUP_AT) {
      // Numbers in hand is proof enough that leasing works.
      this.leaseFailed = false;
      return;
    }
    try {
      const call = httpsCallable<{ deviceId: string }, ReceiptLease & { to: number }>(
        this.functions,
        'leasePosReceiptBlock',
      );
      const { data } = await call({ deviceId: this.deviceId });
      await posTx(STORE_LEASES, 'readwrite', (tx) =>
        idbPut(tx, STORE_LEASES, {
          leaseId: data.leaseId,
          prefix: data.prefix,
          from: data.from,
          to: data.to,
          size: data.size,
          nextOrdinal: 0,
          expiresAtMillis: data.expiresAtMillis,
        }),
      );
      this.leaseFailed = false;
      await this.emit();
    } catch {
      // Not fatal: the till keeps whatever it already holds. If it holds
      // nothing, offline sales get a reference instead of a receipt number.
      // Recorded rather than swallowed, so the pill can say which of the two
      // reasons it has no numbers.
      this.leaseFailed = true;
      await this.emit();
    }
  }

  // ------------------------------------------------------------------- capture

  /**
   * Persist a sale, then hand back what the receipt should say.
   *
   * The IndexedDB transaction spends the receipt ordinal and writes the queued
   * sale together, so a crash between the two cannot reuse a number or lose a
   * sale — the pair either both happened or neither did.
   */
  async capture(input: {
    draft: PosSaleDraft;
    capturedTotal: number;
    capturedSubtotal: number;
    capturedByUid: string;
    capturedByName: string;
    localRef: string;
  }): Promise<{ receiptNumber: string; localRef: string; receipt?: SpentReceipt }> {
    const spent = await posTx([STORE_QUEUE, STORE_LEASES], 'readwrite', async (tx) => {
      const claim = await this.spendOrdinal(tx);
      const queued: QueuedSale = {
        saleId: input.draft.saleId,
        deviceId: this.deviceId,
        draft: {
          ...input.draft,
          ...(claim ? { receipt: { leaseId: claim.leaseId, ordinal: claim.ordinal } } : {}),
          capturedByUid: input.capturedByUid,
          capturedByName: input.capturedByName,
        },
        receiptNumber: claim?.receiptNumber ?? '',
        localRef: input.localRef,
        capturedTotal: input.capturedTotal,
        capturedSubtotal: input.capturedSubtotal,
        capturedAtMillis: input.draft.capturedAtMillis ?? Date.now(),
        capturedByUid: input.capturedByUid,
        capturedByName: input.capturedByName,
        tenders: input.draft.tenders,
        state: 'held',
        attempts: 0,
        nextAttemptAtMillis: 0,
      };
      await idbPut(tx, STORE_QUEUE, queued);
      return claim;
    });

    await this.emit();
    return {
      receiptNumber: spent?.receiptNumber ?? '',
      localRef: input.localRef,
      ...(spent ? { receipt: spent } : {}),
    };
  }

  async markSent(saleId: string, sale: PosCommittedSale): Promise<void> {
    await posTx(STORE_QUEUE, 'readwrite', async (tx) => {
      const existing = await idbGet<QueuedSale>(tx, STORE_QUEUE, saleId);
      if (!existing) return;
      await idbPut(tx, STORE_QUEUE, {
        ...existing,
        state: 'sent',
        serverTotal: sale.total,
        serverReceiptNumber: sale.receiptNumber,
      });
    });
    await this.emit();
  }

  // --------------------------------------------------------------------- drain

  async list(): Promise<QueuedSale[]> {
    if (!posIdbAvailable()) return [];
    const all = await posTx(STORE_QUEUE, 'readonly', (tx) => idbGetAll<QueuedSale>(tx, STORE_QUEUE));
    return all.sort((a, b) => a.capturedAtMillis - b.capturedAtMillis);
  }

  async forget(saleId: string): Promise<void> {
    await posTx(STORE_QUEUE, 'readwrite', (tx) => idbDelete(tx, STORE_QUEUE, saleId));
    await this.emit();
  }

  /** Put a blocked sale back in the queue after a person has looked at it. */
  async retry(saleId: string): Promise<void> {
    await posTx(STORE_QUEUE, 'readwrite', async (tx) => {
      const existing = await idbGet<QueuedSale>(tx, STORE_QUEUE, saleId);
      if (!existing) return;
      await idbPut(tx, STORE_QUEUE, {
        ...existing,
        state: 'held',
        attempts: 0,
        nextAttemptAtMillis: 0,
      });
    });
    await this.drain();
  }

  /**
   * Send everything held, oldest first, one at a time.
   *
   * Sequential rather than parallel on purpose: `commitPosSale` decrements stock
   * and allocates numbers in a transaction, and firing a backlog at it
   * concurrently would produce contention aborts that look exactly like the
   * transient failures the queue is trying to recover from.
   */
  async drain(): Promise<void> {
    if (this.draining || this.paused) return;
    if (!posIdbAvailable()) return;

    this.draining = true;
    try {
      // Before the online check, deliberately: a sale stranded in `sending` is
      // a real sale, and the count a cashier reads has to be right whether or
      // not the network is back yet.
      await this.recoverStranded();
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const pending = (await this.list()).filter(
        (s) => s.state === 'held' && s.nextAttemptAtMillis <= Date.now(),
      );
      for (const sale of pending) {
        if (this.paused) break;
        const ok = await this.send(sale);
        if (!ok) break; // stop on the first failure; the backoff decides when to try again
      }
      await this.pruneSent();
    } finally {
      this.draining = false;
      await this.emit();
    }
  }

  /**
   * Put sales stranded mid-flight back in the queue. Runs once per session.
   *
   * `send()` marks a sale `sending` before the callable, so a reload, a closed
   * tab or a browser killed mid-call leaves it in that state forever: `drain()`
   * only picks up `held`, `pruneSent()` only removes `sent`, and the queue page
   * offers Retry on `blocked` alone. The sale is real and the money is in the
   * drawer, so the only safe reading of `sending` at startup is "unknown" —
   * and re-sending an unknown is free, because `commitPosSale` is idempotent on
   * the sale id and returns the original order for anything that did land.
   */
  private async recoverStranded(): Promise<void> {
    if (this.recovered) return;
    this.recovered = true;
    await posTx(STORE_QUEUE, 'readwrite', async (tx) => {
      for (const sale of await idbGetAll<QueuedSale>(tx, STORE_QUEUE)) {
        if (sale.state !== 'sending') continue;
        await idbPut(tx, STORE_QUEUE, { ...sale, state: 'held', nextAttemptAtMillis: 0 });
      }
    });
  }

  private async send(sale: QueuedSale): Promise<boolean> {
    // Nothing to send to. Reported as a failed attempt rather than a silent
    // success so the sale stays held and visible instead of being marked sent
    // to a server that was never asked.
    if (!this.functions) return false;
    await posTx(STORE_QUEUE, 'readwrite', (tx) => idbPut(tx, STORE_QUEUE, { ...sale, state: 'sending' }));
    try {
      const call = httpsCallable<Record<string, unknown>, PosCommittedSale>(
        this.functions,
        'commitPosSale',
      );
      const { data } = await call({ ...sale.draft });
      await this.markSent(sale.saleId, data);
      return true;
    } catch (error) {
      const attempts = sale.attempts + 1;
      const verdict = classifyCommitError(error, attempts);

      if (verdict.disposition === 'denied') {
        this.paused = true;
        this.pauseReasonKey = verdict.messageKey;
        await posTx(STORE_QUEUE, 'readwrite', (tx) =>
          idbPut(tx, STORE_QUEUE, { ...sale, state: 'held', lastErrorCode: verdict.code }),
        );
        return false;
      }

      const permanent = verdict.disposition === 'permanent';
      // A re-auth failure is the world's fault, not the sale's, so it must not
      // burn an attempt — otherwise a token that expires overnight would walk
      // a perfectly good backlog into `blocked` by morning.
      const nextAttempts = verdict.disposition === 'reauth' ? sale.attempts : attempts;

      await posTx(STORE_QUEUE, 'readwrite', (tx) =>
        idbPut(tx, STORE_QUEUE, {
          ...sale,
          state: permanent ? 'blocked' : 'held',
          attempts: nextAttempts,
          nextAttemptAtMillis: permanent ? 0 : Date.now() + backoffMillis(nextAttempts),
          lastError: error instanceof Error ? error.message : String(error),
          lastErrorCode: verdict.code,
        }),
      );
      return false;
    }
  }

  /** Keep a short tail of sent sales so a cashier can see the backlog cleared. */
  private async pruneSent(): Promise<void> {
    const cutoff = Date.now() - 10 * 60 * 1000;
    await posTx(STORE_QUEUE, 'readwrite', async (tx) => {
      for (const s of await idbGetAll<QueuedSale>(tx, STORE_QUEUE)) {
        if (s.state === 'sent' && s.capturedAtMillis < cutoff) {
          await idbDelete(tx, STORE_QUEUE, s.saleId);
        }
      }
    });
  }
}
