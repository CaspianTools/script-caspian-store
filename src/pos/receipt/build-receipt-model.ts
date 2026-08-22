import type { PosSaleLine, PosTenderInput } from '../storage/types';

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
  amount: number;
  tendered?: number;
  change?: number;
  reference?: string;
}

export interface PosReceiptModel {
  receiptNumber: string;
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
}

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}
function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** Same rule as the tender screen and `functions-pos/src/money.ts`. */
function roundCash(amount: number, step: number): number {
  if (!step || step <= 0) return fromMinor(toMinor(amount));
  const stepMinor = toMinor(step);
  return fromMinor(Math.round(toMinor(amount) / stepMinor) * stepMinor);
}

/**
 * The one description of what a receipt says.
 *
 * Both output paths render from this: the React component (browser print, any
 * OS printer) and, from v10.3.0, the ESC/POS byte encoder that talks to a
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
    const discountMinor = Math.min(toMinor(line.lineDiscount ?? 0), grossMinor);
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

  const tenders: PosReceiptTender[] = args.tenders.map((tender) => {
    if (tender.kind !== 'cash' || tender.tendered == null) {
      return { kind: tender.kind, amount: tender.amount, reference: tender.reference };
    }
    return {
      kind: tender.kind,
      amount: tender.amount,
      tendered: tender.tendered,
      change: roundCash(
        fromMinor(Math.max(0, toMinor(tender.tendered) - toMinor(tender.amount))),
        args.cashRounding ?? 0,
      ),
      reference: tender.reference,
    };
  });

  return {
    receiptNumber: args.receiptNumber,
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
    changeDue: tenders.reduce((sum, t) => sum + (t.change ?? 0), 0),
  };
}

function splitLines(text?: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
