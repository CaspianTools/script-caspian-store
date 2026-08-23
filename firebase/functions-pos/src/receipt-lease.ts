import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { assertStaff } from './auth';

/**
 * Reserve a block of receipt numbers for one register.
 *
 * This exists so a till can print a **real** receipt number while offline.
 * Without it there are only two options at the counter, and both are bad: hand
 * the customer a slip that is not a receipt, or let the till invent a number
 * with nothing anywhere guaranteeing it is unique. A lease is the third option
 * — the numbers were genuinely issued by the server, in advance, to this device.
 *
 * The block is allocated by bumping `posCounters/receipt` once, here, in a tiny
 * two-write transaction. That is the whole point: `commitPosSale` then derives
 * its number from the lease and never touches the counter, so sales stop
 * serialising on one hot document.
 *
 * A lease is a claim on a range, not a promise that every number is used. Gaps
 * are expected and harmless — a till that leases 200 numbers and sells 3 before
 * the shop closes has burnt 197, and receipt numbers were never contiguous
 * across tills anyway. What matters is that no number is issued twice, and
 * `commitPosSale` enforces that separately via `posReceiptNumbers`.
 */

const MIN_BLOCK = 20;
const MAX_BLOCK = 500;
const DEFAULT_BLOCK = 200;

/** How long a till may keep spending from a block before asking for a fresh one. */
const LEASE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface LeaseInput {
  deviceId: string;
  size?: number;
}

export interface LeaseResult {
  leaseId: string;
  prefix: string;
  from: number;
  to: number;
  size: number;
  expiresAtMillis: number;
}

export const leasePosReceiptBlock = onCall({ cors: true }, async (request: CallableRequest) => {
  const caller = await assertStaff(request);
  const d = (request.data ?? {}) as Partial<LeaseInput>;

  if (typeof d.deviceId !== 'string' || d.deviceId.length === 0) {
    throw new HttpsError('invalid-argument', 'deviceId (string) is required.');
  }
  const requested = typeof d.size === 'number' && Number.isInteger(d.size) ? d.size : DEFAULT_BLOCK;
  const size = Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, requested));

  const db = getFirestore();
  const counterRef = db.collection('posCounters').doc('receipt');
  const leaseRef = db.collection('posReceiptLeases').doc();
  const now = Date.now();

  const result = await db.runTransaction(async (tx): Promise<LeaseResult> => {
    const settingsSnap = await tx.get(db.collection('settings').doc('site'));
    const counterSnap = await tx.get(counterRef);

    const posSettings = (settingsSnap.data()?.pos ?? {}) as Record<string, unknown>;
    const prefix = typeof posSettings.receiptPrefix === 'string' ? posSettings.receiptPrefix : 'R';

    // The counter's value is "highest number issued", not "highest number used"
    // — a leased block is issued the moment it is handed out, whether or not
    // the till ever spends it.
    const highest = (counterSnap.data()?.value as number | undefined) ?? 0;
    const from = highest + 1;
    const to = highest + size;
    const expiresAtMillis = now + LEASE_TTL_MS;

    tx.set(counterRef, { value: to, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(leaseRef, {
      prefix,
      from,
      to,
      size,
      deviceId: d.deviceId,
      cashierId: caller.uid,
      issuedAtMillis: now,
      expiresAtMillis,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    });

    return { leaseId: leaseRef.id, prefix, from, to, size, expiresAtMillis };
  });

  logger.info(
    `[leasePosReceiptBlock] device=${d.deviceId} cashier=${caller.uid} ` +
      `lease=${result.leaseId} range=${result.from}-${result.to}.`,
  );
  return result;
});
