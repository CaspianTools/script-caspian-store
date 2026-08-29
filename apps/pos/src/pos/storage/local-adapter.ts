import type { Product } from '@caspian-explorer/script-caspian-store';
import {
  commitLocalSale,
  getLocalSale,
  lookupLocalByCode,
  readLocalShopSettings,
  searchLocalProducts,
} from '../standalone/local-db';
import { openLocalShift } from '../standalone/local-shifts';
import { claimedLocalTerminal } from '../standalone/local-terminals';
import type { LocalDiscountReason, LocalSale } from '../standalone/types';
import type { PosCommittedSale, PosSaleDraft, PosSoldLine, PosStorageAdapter } from './types';

/** `LocalSaleLine` is already the priced shape; only the optional fields differ. */
function toSoldLines(sale: LocalSale): PosSoldLine[] {
  return sale.lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    selectedSize: line.selectedSize,
    selectedColor: line.selectedColor,
    lineDiscount: line.lineDiscount,
    lineTotal: line.lineTotal,
    ...(line.sku ? { sku: line.sku } : {}),
    ...(line.barcode ? { barcode: line.barcode } : {}),
  }));
}

/**
 * The register when there is no shop behind it.
 *
 * Contacts nothing. Catalogue, prices, stock, receipt numbers and the sales
 * themselves all live in IndexedDB on this machine, which is what lets a
 * physical shop with no website — and no Firebase project — open a till and
 * trade.
 *
 * Note what is absent compared with `PosQueuedCloudAdapter`: no queue, no
 * lease, no fuse, no online check. Those exist to paper over the gap between a
 * sale happening and a server hearing about it. Here there is no gap — the
 * commit IS the record — so `pending` is always false and a sale is never
 * "held". Adding a queue for symmetry would invent a pending state that can
 * never resolve.
 *
 * The trade this makes is stated plainly in the manual: nothing is in the
 * cloud, nothing appears in an online admin, and backups are the shop's own
 * responsibility.
 */
export class PosLocalAdapter implements PosStorageAdapter {
  readonly mode = 'local' as const;

  constructor(
    private readonly deviceId: string,
    private readonly identity: () => { uid: string; name: string },
  ) {}

  async lookupByCode(code: string) {
    return lookupLocalByCode(code);
  }

  async searchProducts(term: string): Promise<Product[]> {
    return searchLocalProducts(term);
  }

  async commitSale(draft: PosSaleDraft): Promise<PosCommittedSale> {
    const who = this.identity();
    const settings = await readLocalShopSettings();
    const deviceId = draft.deviceId || this.deviceId;

    // Read here rather than taken from a React context, because the identity
    // seam above is the only one `pos-adapter-context.tsx` offers and widening
    // it would be a change to a file outside the standalone boundary. Both are
    // absent on a till whose owner has named no counter, which is every till
    // until somebody sets one up -- so neither read can refuse a sale.
    const terminal = await claimedLocalTerminal(deviceId);
    const shift = settings.shiftsEnabled ? await openLocalShift(deviceId) : null;

    const { sale, duplicate } = await commitLocalSale(
      {
        saleId: draft.saleId,
        deviceId,
        lines: draft.lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          barcode: line.barcode,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          selectedSize: line.selectedSize ?? null,
          selectedColor: line.selectedColor ?? null,
          lineDiscount: line.lineDiscount ?? 0,
          ...(line.discountReason
            ? { discountReason: line.discountReason as LocalDiscountReason }
            : {}),
        })),
        tenders: draft.tenders,
        cashierId: draft.capturedByUid || who.uid,
        cashierName: draft.capturedByName || who.name,
        committedAtMillis: draft.capturedAtMillis ?? Date.now(),
        ...(terminal ? { terminalId: terminal.id, terminalName: terminal.name } : {}),
        ...(shift ? { shiftId: shift.id } : {}),
      },
      settings.receiptPrefix,
    );

    return {
      orderId: sale.saleId,
      receiptNumber: sale.receiptNumber,
      total: sale.total,
      duplicate,
      stockShortfall: sale.stockShortfall,
      pending: false,
      lines: toSoldLines(sale),
    };
  }

  /**
   * Locally this question is always answerable, which is the one way standalone
   * is simpler than cloud: there is no lost response to reason about, so the
   * register's cancel path never has to guess.
   */
  async findCommittedSale(saleId: string): Promise<PosCommittedSale | null> {
    const sale = await getLocalSale(saleId);
    if (!sale) return null;
    return {
      orderId: sale.saleId,
      receiptNumber: sale.receiptNumber,
      total: sale.total,
      duplicate: true,
      stockShortfall: sale.stockShortfall,
      pending: false,
      lines: toSoldLines(sale),
    };
  }
}
