import type { PosSaleLine, PosSoldLine, PosTenderInput } from '../storage/types';
import { fromMinor, toMinor } from '../money';
import { splitTenders, type TenderDraftAmounts } from '../tender-allocation';

export interface PosReceiptLine {
  name: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  sku?: string;
  barcode?: string;
  size?: string | null;
}

export interface PosReceiptTender {
  kind: 'cash' | 'card' | 'other';
  /** What this tender covered of the sale, not the raw figure it was entered as. */
  amount: number;
  tendered?: number;
  reference?: string;
}

export interface PosReceiptModel {
  receiptNumber: string;
  /**
   * True when `receiptNumber` is a device-local reference, not a number issued
   * by the server. The renderer labels it rather than letting it pass for one.
   */
  provisionalReceipt?: boolean;
  /**
   * A copy of a slip already handed over. Marked for the same reason
   * `provisionalReceipt` is: an unmarked reprint is a second original, and a
   * customer can present it as one.
   */
  reprint?: boolean;
  orderId: string;
  /** Epoch millis. Rendered by the view with the active locale's date format. */
  at: number;
  storeHeader: string[];
  storeFooter: string[];
  cashierName: string;
  deviceLabel: string;
  lines: PosReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  tenders: PosReceiptTender[];
  changeDue: number;
}

export interface BuildReceiptArgs {
  receiptNumber: string;
  orderId: string;
  lines: PosSaleLine[];
  tenders: PosTenderInput[];
  subtotal: number;
  discount: number;
  total: number;
  cashierName: string;
  deviceLabel: string;
  receiptHeader?: string;
  receiptFooter?: string;
  at?: number;
  /**
   * `PosSettings.roundCashTo`. Must be the same value the tender screen used,
   * and the same one the server applies — otherwise the change the cashier
   * reads off the screen and the change printed on the customer's receipt can
   * differ by a cent, which is exactly the kind of discrepancy that surfaces
   * as an unexplained drawer variance at close.
   */
  cashRounding?: number;
  provisionalReceipt?: boolean;
  reprint?: boolean;
}

/**
 * Subtotal and discount for a set of lines that have already been priced.
 *
 * Exists so the receipt's three money figures come from ONE source. They used
 * not to: `subtotal` and `discount` were taken from the open ticket while
 * `total` came back from the commit, so a catalogue edit between the scan and
 * the commit printed lines that did not add up to the total on the same slip.
 * Given the priced lines, both are derivable, and derived beats carried.
 *
 * Integer minor units, like every other total in the register.
 */
export function summariseSoldLines(lines: PosSoldLine[]): { subtotal: number; discount: number } {
  let grossMinor = 0;
  let discountMinor = 0;
  for (const line of lines) {
    grossMinor += toMinor(line.unitPrice) * line.quantity;
    discountMinor += toMinor(line.lineDiscount);
  }
  return { subtotal: fromMinor(grossMinor), discount: fromMinor(discountMinor) };
}

/**
 * The one description of what a receipt says.
 *
 * Both output paths render from this: the React component (browser print, any
 * OS printer) and, once it ships, the ESC/POS byte encoder that talks to a
 * thermal printer over WebUSB/WebSerial. Keeping the *content* in one place
 * means the two can never disagree about what a customer was charged, which
 * they inevitably would if each formatted the sale itself.
 *
 * Deliberately holds no formatted strings beyond the free-text header/footer:
 * numbers stay numbers and the timestamp stays epoch millis, so each renderer
 * can format for the active locale and its own column width.
 */
export function buildReceiptModel(args: BuildReceiptArgs): PosReceiptModel {
  const lines: PosReceiptLine[] = args.lines.map((line) => {
    const grossMinor = toMinor(line.unitPrice) * line.quantity;
    // Clamped by MAGNITUDE, not by `Math.min`. On a refund every figure on the
    // line is negative, and `Math.min(-500, -1999)` is -1999 -- so the naive
    // clamp would enlarge the markdown instead of capping it, and the slip's
    // own lines would not add up to its own total.
    const rawDiscountMinor = toMinor(line.lineDiscount ?? 0);
    const discountMinor =
      grossMinor >= 0
        ? Math.min(rawDiscountMinor, grossMinor)
        : Math.max(rawDiscountMinor, grossMinor);
    return {
      name: line.name,
      qty: line.quantity,
      unitPrice: line.unitPrice,
      lineDiscount: fromMinor(discountMinor),
      lineTotal: fromMinor(grossMinor - discountMinor),
      sku: line.sku,
      barcode: line.barcode,
      size: line.selectedSize ?? null,
    };
  });

  // Change is a property of the SALE, not of one tender. Computing it per
  // tender -- `tendered - that tender's own amount` -- is what printed 80.00
  // of change on a 46.00 sale whose first tender box had been left at 20.00.
  // The screen and the slip now read the same function.
  const drafts: TenderDraftAmounts[] = args.tenders.map((tender) => ({
    kind: tender.kind,
    amountMinor: toMinor(tender.amount),
    cashGivenMinor:
      tender.kind === 'cash' && tender.tendered != null ? toMinor(tender.tendered) : null,
  }));
  const split = splitTenders(toMinor(args.total), drafts, toMinor(args.cashRounding ?? 0));

  const tenders: PosReceiptTender[] = args.tenders.map((tender, index) => {
    const entry: PosReceiptTender = {
      kind: tender.kind,
      amount: fromMinor(split.appliedMinor[index] ?? 0),
      reference: tender.reference,
    };
    if (tender.kind === 'cash' && tender.tendered != null) entry.tendered = tender.tendered;
    return entry;
  });

  return {
    receiptNumber: args.receiptNumber,
    ...(args.provisionalReceipt ? { provisionalReceipt: true } : {}),
    ...(args.reprint ? { reprint: true } : {}),
    orderId: args.orderId,
    at: args.at ?? Date.now(),
    storeHeader: splitLines(args.receiptHeader),
    storeFooter: splitLines(args.receiptFooter),
    cashierName: args.cashierName,
    deviceLabel: args.deviceLabel,
    lines,
    subtotal: args.subtotal,
    discount: args.discount,
    total: args.total,
    tenders,
    changeDue: fromMinor(split.changeMinor),
  };
}

function splitLines(text?: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
