/**
 * What makes a product form saveable.
 *
 * Pure and string-free -- it returns message KEYS, not sentences -- so the
 * rules can be checked in `check-standalone.mjs` without a browser or a
 * translation table, the same posture `price-local-sale.ts` takes.
 *
 * Three things were wrong with the rules this replaces, and all three were
 * silent:
 *
 *   1. The price was read with a bare `Number()`. `Number('')` is `0`, which
 *      passes a `Number.isFinite && >= 0` guard, so an item saved with the
 *      price box empty was written at 0.00 -- and then the form fired its
 *      SUCCESS toast. `Number('12,50')` is `NaN`, so a cashier typing the
 *      separator on their own numpad was told the item needed a price on a
 *      form where the price was filled in.
 *   2. A negative stock count was refused outright. The till oversells into
 *      negative stock on purpose (`LocalSale.stockShortfall` -- recorded, never
 *      blocking), so an oversold item's edit form became permanently
 *      unsaveable: you could not correct its name, let alone its price.
 *   3. Nothing said which field was wrong. The only channel was a toast.
 */

import { parseAmountStrict } from '../../../parse-amount';

export interface ProductDraftFields {
  name: string;
  price: string;
  /** Per stock bucket, held as typed. */
  stock: Record<string, string>;
}

export interface ProductDraftContext {
  /** Buckets the item currently lists. */
  stockKeys: string[];
  /** Buckets holding a count under a size the item no longer lists. */
  unlistedKeys: string[];
  /**
   * The stock the form was seeded from, as typed strings. A negative count that
   * is still exactly as it arrived is left alone rather than refused -- see
   * rule 2 above. Absent when adding a new item, where nothing has arrived yet.
   */
  originalStock?: Record<string, string>;
}

export interface ProductDraftErrors {
  name?: string;
  price?: string;
  /** Keyed by stock bucket. */
  stock?: Record<string, string>;
}

export interface ProductDraftResult {
  errors: ProductDraftErrors;
  ok: boolean;
  /** Parsed values, only when `ok`. Saves the caller re-parsing what was checked. */
  values: { price: number; stock: Record<string, number> } | null;
}

export function validateProductDraft(
  draft: ProductDraftFields,
  context: ProductDraftContext,
): ProductDraftResult {
  const errors: ProductDraftErrors = {};
  const stockErrors: Record<string, string> = {};

  if (!draft.name.trim()) errors.name = 'pos.admin.products.errName';

  const price = parseAmountStrict(draft.price);
  if (price === null) {
    // Blank and unparseable are one message on purpose: from the cashier's
    // side "I did not type a price" and "what I typed is not a price" want the
    // same next action, and two near-identical sentences under one field read
    // as a bug rather than as precision.
    errors.price = 'pos.admin.products.errPrice';
  }

  const stock: Record<string, number> = {};
  for (const key of [...context.stockKeys, ...context.unlistedKeys]) {
    const typed = (draft.stock[key] ?? '').trim();
    const count = typed === '' ? 0 : Number(typed);

    if (!Number.isInteger(count)) {
      stockErrors[key] = 'pos.admin.products.errStockWhole';
      continue;
    }
    if (count < 0) {
      // Unchanged from what the item arrived with? Leave it. Anything else is
      // somebody typing a negative by hand, which is a typo far more often
      // than it is a correction -- Adjust stock is the route for a real one.
      const wasTyped = (context.originalStock?.[key] ?? '').trim();
      if (typed !== wasTyped) {
        stockErrors[key] = 'pos.admin.products.errStockNegative';
        continue;
      }
    }
    // A listed bucket is written even at zero -- "none left" is a fact worth
    // recording. An unlisted one survives only while it still holds something.
    if (count !== 0 || context.stockKeys.includes(key)) stock[key] = count;
  }

  if (Object.keys(stockErrors).length) errors.stock = stockErrors;

  const ok = !errors.name && !errors.price && !errors.stock;
  return { errors, ok, values: ok && price !== null ? { price, stock } : null };
}
