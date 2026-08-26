import type { PosSoldLine } from './types';

/**
 * Read priced lines out of an order's `items` array.
 *
 * `commitPosSale` returns `items` in the shape the storefront's `orders`
 * documents already use — that shape is shared with the admin order views and
 * must not be reshaped to suit the till. So the mapping lives here instead, on
 * the client, and `findCommittedSale` can reuse it when reading an order
 * document back directly.
 *
 * `lineTotal` is derived rather than read: the order document does not carry
 * one, and computing it in integer minor units here keeps it consistent with
 * every other total in the register.
 */
export function toSoldLines(raw: unknown): PosSoldLine[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const lines: PosSoldLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const productId = typeof item.productId === 'string' ? item.productId : '';
    const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
    if (!productId || quantity <= 0) continue;

    const unitPrice = typeof item.price === 'number' ? item.price : 0;
    const lineDiscount = typeof item.lineDiscount === 'number' ? item.lineDiscount : 0;
    const grossMinor = Math.round(unitPrice * 100) * quantity;
    const discountMinor = Math.min(Math.round(lineDiscount * 100), grossMinor);

    lines.push({
      productId,
      name: typeof item.name === 'string' ? item.name : '',
      unitPrice,
      quantity,
      selectedSize: typeof item.selectedSize === 'string' ? item.selectedSize : null,
      selectedColor: typeof item.selectedColor === 'string' ? item.selectedColor : null,
      lineDiscount: Math.round(discountMinor) / 100,
      lineTotal: Math.round(grossMinor - discountMinor) / 100,
      ...(typeof item.sku === 'string' && item.sku ? { sku: item.sku } : {}),
      ...(typeof item.barcode === 'string' && item.barcode ? { barcode: item.barcode } : {}),
    });
  }
  return lines.length ? lines : undefined;
}
