import type { Product } from '../../types';
import {
  commitLocalSale,
  getLocalSale,
  lookupLocalByCode,
  readLocalShopSettings,
  searchLocalProducts,
} from '../standalone/local-db';
import type { PosCommittedSale, PosSaleDraft, PosStorageAdapter } from './types';

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
    const { sale, duplicate } = await commitLocalSale(
      {
        saleId: draft.saleId,
        deviceId: draft.deviceId || this.deviceId,
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
        })),
        tenders: draft.tenders,
        promoCode: draft.promoCode ?? null,
        cashierId: draft.capturedByUid || who.uid,
        cashierName: draft.capturedByName || who.name,
        committedAtMillis: draft.capturedAtMillis ?? Date.now(),
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
    };
  }
}
