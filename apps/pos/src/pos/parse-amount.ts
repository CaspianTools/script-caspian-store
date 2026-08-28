/**
 * Reading an amount a person keyed in.
 *
 * Lived in `pos-tender-dialog.tsx` until the product form needed it too. The
 * form was parsing prices with a bare `Number()`, which gets two things wrong
 * that this parser was written to get right: `Number('12,50')` is `NaN`, so a
 * cashier in Baku or Istanbul typing the separator on their own numpad was told
 * the item needed a price on a form where the price was filled in; and
 * `Number('')` is `0`, so leaving the box empty saved the item at 0.00 and
 * showed a success toast.
 */

/**
 * Parse a keyed amount without fighting the cashier's keyboard.
 *
 * Accepts both `,` and `.` as the decimal separator: a register in Baku or
 * Istanbul has a comma on the numpad, and rejecting it (or worse, silently
 * reading "12,50" as 1250) is how a till ends up 100× out.
 *
 * It must also survive a GROUPING separator, which the previous version did
 * not: `String.replace` with a string argument replaces only the first match,
 * so `1,234.50` became `1.234.50` and `parseFloat` stopped at the second dot
 * and returned **1.234**. On the tendered field that is wrong change handed to
 * a customer, which is the exact failure the note above claims to prevent.
 *
 * The rule: the last separator is the decimal point if one or two digits
 * follow it, and grouping otherwise. `12,50`, `1,234.50` and `1.234,50` all
 * read correctly; `1,234` reads as one thousand two hundred and thirty-four.
 * That last case is genuinely ambiguous between the two conventions, and three
 * trailing digits is grouping far more often than it is a third decimal place
 * in a currency amount.
 *
 * Returns `null` rather than a number when there is nothing usable to read --
 * blank, or text that is not an amount. A caller that wants the old
 * everything-is-zero behaviour uses `parseAmount` below; a caller that has to
 * tell "nothing typed" from "zero typed" uses this one.
 */
export function parseAmountStrict(text: string): number | null {
  const cleaned = text.replace(/\s/g, '');
  if (!cleaned) return null;

  const decimalAt = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const fractionDigits = decimalAt < 0 ? 0 : cleaned.length - decimalAt - 1;
  const normalized =
    decimalAt >= 0 && fractionDigits >= 1 && fractionDigits <= 2
      ? `${cleaned.slice(0, decimalAt).replace(/[.,]/g, '')}.${cleaned.slice(decimalAt + 1)}`
      : cleaned.replace(/[.,]/g, '');

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * The same parser, reading anything unusable as zero.
 *
 * This is what the tender screen wants: a half-typed amount box is a zero that
 * leaves the sale short, not an error to interrupt somebody mid-payment with.
 */
export function parseAmount(text: string): number {
  return parseAmountStrict(text) ?? 0;
}
