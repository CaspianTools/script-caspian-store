'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Product } from '../types';
import type { PosSaleLine } from './storage/types';

/** Cents in, cents out — see the note in `totals` below. */
function toMinor(amount: number): number {
  return Math.round(amount * 100);
}
function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

export interface PosTicketTotals {
  subtotal: number;
  lineDiscounts: number;
  total: number;
  itemCount: number;
}

export interface PosTicket {
  lines: PosSaleLine[];
  totals: PosTicketTotals;
  addProduct: (product: Product, selectedSize?: string | null) => void;
  setQuantity: (index: number, quantity: number) => void;
  setLineDiscount: (index: number, discount: number) => void;
  removeLine: (index: number) => void;
  clear: () => void;
  isEmpty: boolean;
}

/** Two scans of the same thing are one line at qty 2, not two lines. */
function sameLine(line: PosSaleLine, productId: string, size: string | null): boolean {
  return line.productId === productId && (line.selectedSize ?? null) === size;
}

/**
 * The open sale on the register.
 *
 * Totals here are advisory. They exist so the cashier and the customer can
 * watch the number climb as items are scanned — the authoritative figures come
 * back from `commitPosSale`, which re-reads every price from Firestore. Any
 * discrepancy between the two means the catalog changed mid-sale, and the
 * server's answer is the one that gets recorded.
 */
export function usePosTicket(): PosTicket {
  const [lines, setLines] = useState<PosSaleLine[]>([]);

  const addProduct = useCallback((product: Product, selectedSize: string | null = null) => {
    setLines((current) => {
      const size = selectedSize ?? (product.sizes?.length === 1 ? product.sizes[0] : null);
      const index = current.findIndex((l) => sameLine(l, product.id, size));
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], quantity: next[index].quantity + 1 };
        return next;
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
          selectedSize: size,
          selectedColor: null,
          sku: product.sku,
          barcode: product.barcode,
          imageUrl: product.images?.[0]?.url ?? '',
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((index: number, quantity: number) => {
    setLines((current) => {
      if (quantity <= 0) return current.filter((_, i) => i !== index);
      return current.map((line, i) =>
        i === index ? { ...line, quantity: Math.min(Math.floor(quantity), 10000) } : line,
      );
    });
  }, []);

  const setLineDiscount = useCallback((index: number, discount: number) => {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        // A markdown can take a line to zero but never below — a negative line
        // would turn a sale into a partial refund with no audit trail.
        const cap = line.unitPrice * line.quantity;
        return { ...line, lineDiscount: Math.max(0, Math.min(discount, cap)) };
      }),
    );
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((current) => current.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totals = useMemo<PosTicketTotals>(() => {
    // Accumulated in integer minor units. Summing floats across a long ticket
    // drifts by a cent or two, and at a till that is not a rounding curiosity
    // — it is a drawer that will not balance at close.
    let grossMinor = 0;
    let discountMinor = 0;
    let itemCount = 0;
    for (const line of lines) {
      grossMinor += toMinor(line.unitPrice) * line.quantity;
      discountMinor += toMinor(line.lineDiscount ?? 0);
      itemCount += line.quantity;
    }
    return {
      subtotal: fromMinor(grossMinor),
      lineDiscounts: fromMinor(discountMinor),
      total: fromMinor(Math.max(0, grossMinor - discountMinor)),
      itemCount,
    };
  }, [lines]);

  return {
    lines,
    totals,
    addProduct,
    setQuantity,
    setLineDiscount,
    removeLine,
    clear,
    isEmpty: lines.length === 0,
  };
}
