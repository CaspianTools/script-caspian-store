'use client';

import { useCallback } from 'react';
import { useFormatCurrency, useFormatNumber } from '@caspian-explorer/script-caspian-store';
import { displayAmount, usableCurrency } from './money';

/**
 * Money, in the register's language.
 *
 * Eight screens each built their own `Intl.NumberFormat(undefined, …)`, seven
 * of them copy-pasted from the eighth. `undefined` means *the browser's*
 * locale, not the register's -- so a till switched to Azerbaijani still printed
 * `$23.00` and grouped its digits the American way, on every screen, because
 * the only thing the language switch reached was the words.
 *
 * Two formatters are built, not one, and both unconditionally -- hooks cannot
 * be called in a branch. Which one is used depends on whether the shop's
 * currency is usable.
 */

const TWO_DP: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * Hoisted rather than inline. `useFormatCurrency` and `useFormatNumber`
 * memoise on `[locale, options]`, and an object literal written at the call
 * site is a new reference every render -- which would rebuild an `Intl`
 * formatter on every paint of the register.
 */
const CURRENCY_OPTIONS: Intl.NumberFormatOptions | undefined = undefined;

export function usePosMoney(currency: string): (amount: number) => string {
  const usable = usableCurrency(currency);
  // `|| 'USD'` only ever feeds a formatter whose output is thrown away when
  // `usable` is empty. It exists because the hook must be called
  // unconditionally and would throw on a malformed code.
  const money = useFormatCurrency(usable || 'USD', CURRENCY_OPTIONS);
  const plain = useFormatNumber(TWO_DP);

  return useCallback(
    (amount: number) => {
      // `displayAmount` first: Intl renders -0 as "-$0.00", which is what an
      // oversold item with no cost price on file used to show.
      const value = displayAmount(amount);
      // A bad code falls back to a locale-aware bare NUMBER, never to USD.
      // Labelling an AZN price with a dollar sign is worse than leaving it
      // unlabelled -- and unlabelled-but-readable is the degradation the
      // formatter this replaces already chose, deliberately.
      return usable ? money.format(value) : plain.format(value);
    },
    [usable, money, plain],
  );
}
