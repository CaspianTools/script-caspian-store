import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { assertStaff } from './auth';
import { computeDiscount, fromMinor, roundCash, toMinor } from './money';

/** One scanned/keyed ticket line as the register sends it. Prices are NOT trusted. */
interface SaleLineInput {
  productId: string;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  /** Cashier markdown in currency units, applied to the whole line. */
  lineDiscount?: number;
}

interface TenderInput {
  kind: 'cash' | 'card' | 'other';
  amount: number;
  tendered?: number;
  reference?: string;
}

interface CommitSaleInput {
  /**
   * Client-generated, device-scoped id (`deviceId` + a local counter). Doubles
   * as the `orders/{id}` document id, which is what makes replay exactly-once:
   * a duplicate submit collides with an existing document instead of writing a
   * second sale. Never generate this server-side — the whole point is that the
   * device can mint it while offline.
   */
  saleId: string;
  deviceId: string;
  lines: SaleLineInput[];
  tenders: TenderInput[];
  promoCode?: string | null;
  sessionId?: string | null;
  /** Optional linked account. Absent = walk-in. */
  customerId?: string | null;
  customerEmail?: string | null;
  /** Register clock at capture time, for offline sales replayed later. */
  capturedAtMillis?: number;
  /**
   * A number the till already reserved, spent from a block issued by
   * `leasePosReceiptBlock`. Present on any sale captured offline, because the
   * customer was handed a receipt carrying this number before the server ever
   * saw the sale.
   *
   * The client sends `{ leaseId, ordinal }` and NEVER the receipt string — the
   * server derives it from the lease document it wrote itself, so a tampered
   * client can only choose an ordinal inside a block genuinely issued to it.
   */
  receipt?: { leaseId: string; ordinal: number };
  /**
   * Who actually rang the sale, when it is being replayed by somebody else.
   * A backlog drained by a manager the next morning would otherwise record
   * every sale against the manager.
   */
  capturedByUid?: string | null;
  capturedByName?: string | null;
}

const SALE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const MAX_LINES = 400;

function assertShape(data: unknown): CommitSaleInput {
  const d = (data ?? {}) as Partial<CommitSaleInput>;
  if (typeof d.saleId !== 'string' || !SALE_ID_RE.test(d.saleId)) {
    throw new HttpsError('invalid-argument', 'saleId must be 8-128 url-safe characters.');
  }
  if (typeof d.deviceId !== 'string' || d.deviceId.length === 0) {
    throw new HttpsError('invalid-argument', 'deviceId (string) is required.');
  }
  if (!Array.isArray(d.lines) || d.lines.length === 0) {
    throw new HttpsError('invalid-argument', 'A sale needs at least one line.');
  }
  // Firestore allows 500 writes per transaction and this one writes a product
  // update per distinct product, plus the order, plus the receipt-number claim.
  // At the old cap of 500 lines a sale could exceed the ceiling and fail as an
  // opaque `internal` — which a retrying client would read as transient and
  // replay forever. 400 leaves headroom no real counter sale will reach.
  if (d.lines.length > MAX_LINES) {
    throw new HttpsError('invalid-argument', `A sale cannot exceed ${MAX_LINES} lines.`);
  }
  for (const line of d.lines) {
    if (typeof line?.productId !== 'string' || line.productId.length === 0) {
      throw new HttpsError('invalid-argument', 'Every line needs a productId.');
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) {
      throw new HttpsError('invalid-argument', 'Line quantity must be 1-10000.');
    }
    if (line.lineDiscount != null && (!(line.lineDiscount >= 0) || line.lineDiscount > 1e6)) {
      throw new HttpsError('invalid-argument', 'Line discount must be a positive amount.');
    }
  }
  if (!Array.isArray(d.tenders) || d.tenders.length === 0) {
    throw new HttpsError('invalid-argument', 'A sale needs at least one tender.');
  }
  for (const t of d.tenders) {
    if (t?.kind !== 'cash' && t?.kind !== 'card' && t?.kind !== 'other') {
      throw new HttpsError('invalid-argument', 'Tender kind must be cash, card, or other.');
    }
    if (typeof t.amount !== 'number' || !Number.isFinite(t.amount) || t.amount < 0) {
      throw new HttpsError('invalid-argument', 'Tender amount must be a positive number.');
    }
  }
  if (d.receipt != null) {
    const r = d.receipt as { leaseId?: unknown; ordinal?: unknown };
    if (typeof r.leaseId !== 'string' || r.leaseId.length === 0) {
      throw new HttpsError('invalid-argument', 'receipt.leaseId (string) is required.');
    }
    if (!Number.isInteger(r.ordinal) || (r.ordinal as number) < 0) {
      throw new HttpsError('invalid-argument', 'receipt.ordinal must be a non-negative integer.');
    }
  }
  return d as CommitSaleInput;
}

/**
 * Commit an in-person sale.
 *
 * Server-authoritative by construction — the register sends *what was
 * scanned*, never what it costs. Prices, promo validity, and totals are all
 * recomputed here from Firestore, so a tampered client cannot ring up a
 * discounted sale. Same posture as `createStripeCheckoutSession`, and
 * deliberately unlike the storefront's manual-payment plugins, which write the
 * order straight from the browser at client-supplied prices.
 *
 * Everything happens in ONE transaction, so an interrupted commit cannot
 * decrement stock without writing the sale, or burn a receipt number that no
 * order ever claims.
 *
 * Idempotency: `orders/{saleId}` is read first inside the transaction; if it
 * exists the prior order is returned untouched. That one check is what makes a
 * replayed offline sale, a double-tap on the tender button, and a retried
 * network call all safe.
 *
 * Stock is decremented but NOT gated. An in-person sale has already happened —
 * the customer is holding the goods and the money is in the drawer. Refusing
 * the write would lose the sale record, which is strictly worse than recording
 * an oversell, so a shortfall is stamped on `stockShortfall` for the admin to
 * reconcile instead of throwing.
 */
export const commitPosSale = onCall({ cors: true }, async (request: CallableRequest) => {
  const caller = await assertStaff(request);
  const data = assertShape(request.data);
  const db = getFirestore();

  const orderRef = db.collection('orders').doc(data.saleId);
  const uniqueProductIds = [...new Set(data.lines.map((l) => l.productId))];
  const productRefs = uniqueProductIds.map((id) => db.collection('products').doc(id));

  const result = await db.runTransaction(async (tx) => {
    // --- Idempotency gate. Must be the first read in the transaction. ---
    const existing = await tx.get(orderRef);
    if (existing.exists) {
      const prior = existing.data() as Record<string, unknown>;
      return {
        orderId: data.saleId,
        receiptNumber: (prior.receiptNumber as string | undefined) ?? '',
        total: (prior.total as number | undefined) ?? 0,
        duplicate: true,
        stockShortfall: (prior.stockShortfall as unknown[] | undefined) ?? [],
        // The priced lines, so a replay reprints the same receipt as the
        // original rather than falling back to the till's scanned prices.
        items: (prior.items as unknown[] | undefined) ?? [],
      };
    }

    // Firestore requires every read to precede every write in a transaction.
    const productSnaps = await tx.getAll(...productRefs);
    const byId = new Map(productSnaps.map((s) => [s.id, s]));

    const settingsSnap = await tx.get(db.collection('settings').doc('site'));
    const promoSnap = data.promoCode
      ? await tx.get(db.collection('promoCodes').doc(String(data.promoCode).toUpperCase()))
      : null;
    const counterRef = db.collection('posCounters').doc('receipt');

    const posSettings = (settingsSnap.data()?.pos ?? {}) as Record<string, unknown>;
    const receiptPrefix =
      typeof posSettings.receiptPrefix === 'string' ? posSettings.receiptPrefix : 'R';
    const cashRounding = typeof posSettings.roundCashTo === 'number' ? posSettings.roundCashTo : 0;

    // --- Price the ticket from Firestore, in integer minor units. ---
    const items: Record<string, unknown>[] = [];
    const shortfall: Record<string, unknown>[] = [];
    const stockDeltas = new Map<string, Record<string, number>>();
    let subtotalMinor = 0;

    for (const line of data.lines) {
      const snap = byId.get(line.productId);
      if (!snap || !snap.exists) {
        throw new HttpsError('not-found', `Product ${line.productId} no longer exists.`);
      }
      const product = snap.data() as Record<string, any>;
      const sizeKey = line.selectedSize || '_default';

      const onHand =
        typeof product.stock?.[sizeKey] === 'number' ? (product.stock[sizeKey] as number) : null;
      if (onHand !== null && onHand < line.quantity) {
        shortfall.push({
          productId: line.productId,
          sizeKey,
          requested: line.quantity,
          available: onHand,
        });
      }

      const perProduct = stockDeltas.get(line.productId) ?? {};
      perProduct[sizeKey] = (perProduct[sizeKey] ?? 0) + line.quantity;
      stockDeltas.set(line.productId, perProduct);

      const unitMinor = toMinor(Number(product.price) || 0);
      const lineDiscountMinor = Math.min(
        toMinor(line.lineDiscount ?? 0),
        unitMinor * line.quantity,
      );
      subtotalMinor += unitMinor * line.quantity - lineDiscountMinor;

      const variant = line.selectedColor
        ? (product.colorVariants as Array<{ name: string; imageUrl: string }> | undefined)?.find(
            (v) => v.name === line.selectedColor,
          )
        : undefined;

      items.push({
        productId: line.productId,
        name: product.name ?? '',
        brand: (product.brand as string | undefined) ?? '',
        price: fromMinor(unitMinor),
        quantity: line.quantity,
        selectedSize: line.selectedSize ?? null,
        selectedColor: line.selectedColor ?? null,
        imageUrl: variant?.imageUrl ?? product.images?.[0]?.url ?? '',
        sku: (product.sku as string | undefined) ?? '',
        barcode: (product.barcode as string | undefined) ?? '',
        ...(lineDiscountMinor > 0 ? { lineDiscount: fromMinor(lineDiscountMinor) } : {}),
      });
    }

    // --- Promo, revalidated here. Never trusted from the till. ---
    let discountMinor = 0;
    let appliedPromo: string | null = null;
    if (promoSnap && promoSnap.exists) {
      discountMinor = toMinor(computeDiscount(fromMinor(subtotalMinor), promoSnap.data()!));
      if (discountMinor > 0) appliedPromo = (promoSnap.data()!.code as string) ?? null;
    }

    const totalMinor = Math.max(0, subtotalMinor - discountMinor);

    // --- Tenders must cover the total. Cash overpayment becomes change. ---
    const tenderedMinor = data.tenders.reduce((sum, t) => sum + toMinor(t.amount), 0);
    if (tenderedMinor < totalMinor) {
      throw new HttpsError(
        'failed-precondition',
        `Tendered ${fromMinor(tenderedMinor)} does not cover the ${fromMinor(totalMinor)} total.`,
      );
    }

    const tenders = data.tenders.map((t) => {
      const base = {
        kind: t.kind,
        amount: fromMinor(toMinor(t.amount)),
        ...(t.reference ? { reference: t.reference } : {}),
      };
      if (t.kind !== 'cash' || t.tendered == null) return base;
      const changeRaw = fromMinor(toMinor(t.tendered) - toMinor(t.amount));
      return {
        ...base,
        tendered: fromMinor(toMinor(t.tendered)),
        change: roundCash(Math.max(0, changeRaw), cashRounding),
      };
    });

    const method =
      tenders.length > 1 ? 'pos-split' : tenders[0].kind === 'cash' ? 'cash' : 'card-terminal';

    // --- Receipt number ---
    //
    // Two paths. A sale captured offline arrives carrying an ordinal it already
    // spent from a leased block, and the customer is holding a receipt with that
    // number on it — so the server honours it. An online sale has no lease and
    // allocates from the counter exactly as before.
    //
    // Either way the number is claimed in `posReceiptNumbers`, which is what
    // makes a duplicate impossible. That matters more than it looks: imaging a
    // Windows till (routine in multi-till rollouts) clones the device id AND the
    // stored lease, so two registers can hold the same block and try to spend
    // the same ordinal. The claim catches it and the second sale falls back to a
    // fresh number rather than handing two customers the same receipt.
    let receiptNumber = '';
    let receiptFromLease = false;

    if (data.receipt) {
      const leaseSnap = await tx.get(
        db.collection('posReceiptLeases').doc(data.receipt.leaseId),
      );
      const lease = leaseSnap.data() as Record<string, unknown> | undefined;
      if (lease && lease.deviceId === data.deviceId) {
        const from = Number(lease.from);
        const size = Number(lease.size);
        const ordinal = data.receipt.ordinal;
        if (Number.isFinite(from) && Number.isFinite(size) && ordinal < size) {
          // The lease's own prefix, not today's setting: the number was reserved
          // under that prefix and is already printed on the customer's receipt.
          const prefix = typeof lease.prefix === 'string' ? lease.prefix : receiptPrefix;
          const candidate = `${prefix}-${String(from + ordinal).padStart(6, '0')}`;
          const claimSnap = await tx.get(db.collection('posReceiptNumbers').doc(candidate));
          const claimedBy = claimSnap.data()?.saleId as string | undefined;
          if (!claimSnap.exists || claimedBy === data.saleId) {
            receiptNumber = candidate;
            receiptFromLease = true;
          } else {
            logger.warn(
              `[commitPosSale] ${candidate} already claimed by ${claimedBy}; ` +
                `sale ${data.saleId} falls back to the counter. Two tills may share a device id.`,
            );
          }
        }
      } else {
        logger.warn(
          `[commitPosSale] lease ${data.receipt.leaseId} missing or not this device; ` +
            `sale ${data.saleId} falls back to the counter.`,
        );
      }
    }

    let allocatedNumber = 0;
    if (!receiptFromLease) {
      // Only read the counter when we actually need it. Reading it on every
      // sale would serialise the whole shop on one document, which is the
      // contention leases exist to remove.
      const counterSnap = await tx.get(counterRef);
      allocatedNumber = ((counterSnap.data()?.value as number | undefined) ?? 0) + 1;
      receiptNumber = `${receiptPrefix}-${String(allocatedNumber).padStart(6, '0')}`;
    }

    // --- Writes ---
    if (!receiptFromLease) {
      tx.set(
        counterRef,
        { value: allocatedNumber, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    tx.set(db.collection('posReceiptNumbers').doc(receiptNumber), {
      saleId: data.saleId,
      deviceId: data.deviceId,
      createdAt: FieldValue.serverTimestamp(),
    });

    for (const [productId, sizes] of stockDeltas) {
      const updates: Record<string, unknown> = {};
      for (const [sizeKey, qty] of Object.entries(sizes)) {
        updates[`stock.${sizeKey}`] = FieldValue.increment(-qty);
      }
      tx.update(db.collection('products').doc(productId), updates);
    }

    // An offline sale is stamped with the register's capture time so the day's
    // reporting reflects when it was rung, not when it happened to sync.
    // Clamped to now — a device with a fast clock must not date an order in
    // the future, which would sort above every real sale forever.
    const capturedAt =
      data.capturedAtMillis && data.capturedAtMillis < Date.now()
        ? Timestamp.fromMillis(data.capturedAtMillis)
        : FieldValue.serverTimestamp();

    tx.set(orderRef, {
      // Walk-in sales have no shopper account, so the cashier owns the record.
      // Firestore rules let a user read their own orders; without this a sale
      // would be readable by admins only, and the cashier could not reprint.
      userId: data.customerId ?? caller.uid,
      userEmail: data.customerEmail ?? '',
      status: 'paid',
      items,
      shippingInfo: {
        name: 'Walk-in customer',
        address: '',
        city: '',
        zip: '',
        country: '',
        shippingMethod: 'pos-pickup',
      },
      payment: {
        stripeSessionId: '',
        last4: '',
        brand: '',
        amount: fromMinor(totalMinor),
        method,
      },
      subtotal: fromMinor(subtotalMinor),
      shippingCost: 0,
      discount: fromMinor(discountMinor),
      promoCode: appliedPromo,
      total: fromMinor(totalMinor),
      channel: 'pos',
      // A backlog drained the next morning is still the evening cashier's work.
      cashierId: data.capturedByUid || caller.uid,
      ...(data.capturedByUid && data.capturedByUid !== caller.uid
        ? { replayedByUid: caller.uid, capturedByName: data.capturedByName ?? '' }
        : {}),
      deviceId: data.deviceId,
      receiptNumber,
      tenders,
      ...(data.sessionId ? { sessionId: data.sessionId } : {}),
      ...(shortfall.length > 0 ? { stockShortfall: shortfall } : {}),
      createdAt: capturedAt,
    });

    return {
      orderId: data.saleId,
      receiptNumber,
      total: fromMinor(totalMinor),
      duplicate: false,
      stockShortfall: shortfall,
      // Returned as well as written, because the receipt in the customer's hand
      // has to show what was CHARGED. The till only knows what it scanned, and
      // a catalogue edit mid-sale makes those two different — printing scanned
      // lines against this total produced a slip that did not add up.
      items,
    };
  });

  if (result.duplicate) {
    logger.info(`[commitPosSale] Replay of ${data.saleId} ignored; order already exists.`);
  } else {
    logger.info(
      `[commitPosSale] cashier=${caller.uid} device=${data.deviceId} sale=${data.saleId} total=${result.total}.`,
    );
  }
  return result;
});
