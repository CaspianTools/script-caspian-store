/**
 * The currency a shop trades in, as a list rather than a text box.
 *
 * It used to be a bare `<input>` whose only rule was `.toUpperCase()`. A typo
 * persisted, and everything downstream then quietly dropped the symbol: the
 * money formatter caught the resulting `RangeError` at format time and fell
 * back to a bare `toFixed(2)`, so a shop saw unlabelled numbers on every screen
 * and nothing said why.
 *
 * Worse, that fallback stops being available the moment the till adopts the
 * library's `useFormatCurrency`. That hook passes the same currency into both
 * its `try` and its `catch`, so a malformed code throws in the catch as well,
 * escapes `useMemo`, and unmounts the tree. Which is why this list has to land
 * before the formatter sweep and not alongside it.
 */

/**
 * The till's own markets first, then everything else alphabetically.
 *
 * A shop in Baku should not have to scroll past two hundred codes to find the
 * one it uses every day, and `AZN` sorts nowhere near the top on its own.
 */
const PINNED = ['AZN', 'TRY', 'RUB', 'USD', 'EUR', 'GBP'];

/**
 * Used when `Intl.supportedValuesOf` is missing. Deliberately short: it is a
 * fallback for an old browser, not a second source of truth to maintain.
 */
const FALLBACK = [
  ...PINNED,
  'AED', 'AMD', 'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK',
  'EGP', 'GEL', 'HUF', 'ILS', 'INR', 'IRR', 'JPY', 'KGS', 'KRW', 'KZT',
  'MDL', 'NOK', 'NZD', 'PLN', 'QAR', 'RON', 'RSD', 'SAR', 'SEK', 'SGD',
  'THB', 'TJS', 'TMT', 'UAH', 'UZS', 'ZAR',
];

export interface CurrencyOption {
  value: string;
  label: string;
}

function allCodes(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported !== 'function') return FALLBACK;
  try {
    return supported('currency');
  } catch {
    return FALLBACK;
  }
}

/**
 * Every currency, labelled in the register's own language.
 *
 * `current` is force-included even when it is not a real code, so a shop that
 * already saved a typo can SEE it selected and correct it, rather than finding
 * the picker has silently re-pointed it at something else.
 */
export function currencyOptions(locale: string, current: string): CurrencyOption[] {
  const codes = allCodes();
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'currency' });
  } catch {
    names = null;
  }

  const label = (code: string): string => {
    let name = '';
    try {
      name = names?.of(code) ?? '';
    } catch {
      name = '';
    }
    return name && name !== code ? `${code} — ${name}` : code;
  };

  const pinned = PINNED.filter((code) => codes.includes(code));
  const rest = codes.filter((code) => !pinned.includes(code));

  let collator: Intl.Collator | null = null;
  try {
    collator = new Intl.Collator(locale);
  } catch {
    collator = null;
  }
  const sorted = collator ? [...rest].sort(collator.compare) : [...rest].sort();

  const options = [...pinned, ...sorted].map((code) => ({ value: code, label: label(code) }));

  const trimmed = current.trim().toUpperCase();
  if (trimmed && !options.some((option) => option.value === trimmed)) {
    options.unshift({ value: trimmed, label: trimmed });
  }
  return options;
}
