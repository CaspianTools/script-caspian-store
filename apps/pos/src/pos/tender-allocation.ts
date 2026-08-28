/**
 * How a set of tenders covers a sale, and what the customer gets back.
 *
 * Extracted because the same question was being answered twice, differently,
 * and both answers were wrong. The tender screen measured change as
 * `tendered - that tender's own amount box`; `build-receipt-model.ts` repeated
 * the identical expression. Neither consulted the sale total, so:
 *
 *   - a 46.00 sale with the amount box left at 20 and 100 handed over showed
 *     "Still to pay 26.00" and "Change due 80.00" at the same time. The change
 *     is 54.00, and the number a cashier reads out is the number they hand back.
 *   - a 46.00 sale with the amount box raised to 60 and 60 handed over showed
 *     change 0.00, and **committed**: `covered` was true, so the sale recorded
 *     60.00 of cash taken and the shift closed 14.00 over.
 *
 * The second is the one that costs a shop money quietly, and it is why this
 * file returns `appliedMinor` rather than leaving the caller to write the raw
 * amount boxes onto the sale. `shift-totals.ts` sums a sale's cash tenders as
 * the cash that netted into the drawer; if what is recorded is not what the
 * sale was worth, the drawer cannot balance.
 *
 * Pure, integer minor units throughout, and asserted in `check-standalone.mjs`.
 */

import { roundCashMinor } from './money';

export interface TenderDraftAmounts {
  kind: 'cash' | 'card' | 'other';
  /** What this tender is being asked to cover. */
  amountMinor: number;
  /**
   * Cash physically handed over, for a cash tender whose box was filled in.
   * `null` means "exact" -- the cashier took the amount and no more.
   */
  cashGivenMinor: number | null;
}

export interface TenderSplit {
  /**
   * What each tender actually covered, in input order. Written onto the sale in
   * place of the raw amount boxes, so `Σ appliedMinor === totalMinor` whenever
   * `covered` -- which is the property the drawer arithmetic rests on.
   */
  appliedMinor: number[];
  /** Still owed. Zero whenever `covered`. */
  shortfallMinor: number;
  /** Cash to hand back, already rounded to the shop's smallest coin. */
  changeMinor: number;
  /**
   * How far the non-cash tenders overshoot the sale. Refused rather than
   * absorbed: the till cannot make a card machine give change, so a card typed
   * above the total would otherwise take the difference out of the drawer
   * against a card that really charged the higher figure.
   */
  overNonCashMinor: number;
  covered: boolean;
}

/**
 * Work out what each tender covered, what is still owed, and what comes back.
 *
 * `shortfallMinor` and `changeMinor` are the two sides of one subtraction, so
 * they can never both be non-zero -- which is what stops the screen showing a
 * balance and a change amount at the same time.
 *
 * Cash rounding is applied to the change and to nothing else. Rounding the
 * allocation instead would break `Σ appliedMinor === totalMinor`, and the sale
 * record has no rounding line to book the difference against. The crumb stays
 * in (or comes out of) the drawer, which is what a shop that rounds cash has
 * already accepted by turning the setting on.
 */
export function splitTenders(
  totalMinor: number,
  drafts: readonly TenderDraftAmounts[],
  cashRoundingMinor: number,
): TenderSplit {
  let nonCashMinor = 0;
  let cashReceivedMinor = 0;
  for (const draft of drafts) {
    if (draft.kind === 'cash') {
      cashReceivedMinor += draft.cashGivenMinor ?? draft.amountMinor;
    } else {
      nonCashMinor += draft.amountMinor;
    }
  }

  const cashNeededMinor = Math.max(0, totalMinor - nonCashMinor);
  const overNonCashMinor = Math.max(0, nonCashMinor - totalMinor);

  // Allocate the cash that was needed across the cash tenders in the order the
  // cashier entered them, so a split settles the first tender fully before it
  // draws on the second. Any cash beyond what was needed is change, not cover.
  let rest = cashNeededMinor;
  const appliedMinor = drafts.map((draft) => {
    if (draft.kind !== 'cash') return draft.amountMinor;
    const given = draft.cashGivenMinor ?? draft.amountMinor;
    const applied = Math.min(given, rest);
    rest -= applied;
    return applied;
  });

  const shortfallMinor = rest;
  const changeMinor = roundCashMinor(
    Math.max(0, cashReceivedMinor - cashNeededMinor),
    cashRoundingMinor,
  );

  return {
    appliedMinor,
    shortfallMinor,
    changeMinor,
    overNonCashMinor,
    // Both conditions, not just the shortfall: an over-allocated card leaves
    // `Σ applied` above the total, and committing that is the drawer overage
    // this file exists to stop.
    covered: shortfallMinor === 0 && overNonCashMinor === 0,
  };
}
