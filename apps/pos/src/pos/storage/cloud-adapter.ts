import { httpsCallable, type Functions } from 'firebase/functions';
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { caspianCollections } from '@caspian-explorer/script-caspian-store/firebase';
import { findProductByCode, searchPosProducts } from '../pos-catalog-service';
import { toSoldLines } from './sold-lines';
import type {
  PosCommittedSale,
  PosSaleDraft,
  PosStorageAdapter,
} from './types';

/** What `commitPosSale` resolves with. `items` is the priced ticket. */
type CommitResponse = Omit<PosCommittedSale, 'lines'> & { items?: unknown };

/**
 * Cloud-backed register: Firestore for catalog reads, the `caspian-pos`
 * callables for anything that writes.
 *
 * Note the asymmetry — reads go direct, writes never do. Products are
 * public-read so a direct query is the cheapest path, but a sale moves money
 * and stock and must be priced by the server. Writing the order from the
 * browser (as the storefront's manual-payment plugins do) would let a tampered
 * client set its own totals; `commitPosSale` re-reads every price from
 * Firestore and ignores whatever the till claims a thing costs.
 *
 * The same asymmetry is why the priced lines come BACK from the server rather
 * than being taken from the ticket: the receipt has to show what was charged,
 * and only the server knows that.
 */
export class PosCloudAdapter implements PosStorageAdapter {
  readonly mode = 'cloud' as const;

  constructor(
    private readonly db: Firestore,
    private readonly functions: Functions,
  ) {}

  lookupByCode(code: string) {
    return findProductByCode(this.db, code);
  }

  searchProducts(term: string) {
    return searchPosProducts(this.db, term);
  }

  async commitSale(draft: PosSaleDraft): Promise<PosCommittedSale> {
    const call = httpsCallable<Record<string, unknown>, CommitResponse>(
      this.functions,
      'commitPosSale',
    );
    // Only what was scanned travels — quantities, sizes, cashier markdowns and
    // tenders. Unit prices stay on the client purely to render the ticket.
    const { data } = await call({
      saleId: draft.saleId,
      deviceId: draft.deviceId,
      lines: draft.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        selectedSize: line.selectedSize ?? null,
        selectedColor: line.selectedColor ?? null,
        ...(line.lineDiscount ? { lineDiscount: line.lineDiscount } : {}),
      })),
      tenders: draft.tenders,
      promoCode: draft.promoCode ?? null,
      sessionId: draft.sessionId ?? null,
      customerId: draft.customerId ?? null,
      customerEmail: draft.customerEmail ?? null,
      capturedAtMillis: draft.capturedAtMillis ?? Date.now(),
      ...(draft.receipt ? { receipt: draft.receipt } : {}),
      ...(draft.capturedByUid ? { capturedByUid: draft.capturedByUid } : {}),
      ...(draft.capturedByName ? { capturedByName: draft.capturedByName } : {}),
    });

    const lines = toSoldLines(data.items);
    return {
      orderId: data.orderId,
      receiptNumber: data.receiptNumber,
      total: data.total,
      duplicate: Boolean(data.duplicate),
      stockShortfall: data.stockShortfall ?? [],
      pending: false,
      ...(lines ? { lines } : {}),
    };
  }

  async findCommittedSale(saleId: string): Promise<PosCommittedSale | null> {
    // A direct read rather than a callable: `commitPosSale` writes the order at
    // `orders/{saleId}` and stamps `userId` with the caller's uid for a walk-in
    // sale, and the rules let a signed-in user read back their own order. So the
    // till that made the sale is exactly the client allowed to ask about it.
    const snap = await getDoc(doc(caspianCollections(this.db).orders, saleId));
    if (!snap.exists()) return null;
    const data = snap.data() as { receiptNumber?: string; total?: number; items?: unknown };
    const lines = toSoldLines(data.items);
    return {
      orderId: saleId,
      receiptNumber: typeof data.receiptNumber === 'string' ? data.receiptNumber : '',
      total: typeof data.total === 'number' ? data.total : 0,
      duplicate: true,
      stockShortfall: [],
      pending: false,
      ...(lines ? { lines } : {}),
    };
  }
}
