import type { CurrencyDisplay } from '../types';

const FALLBACK_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  HKD: 'HK$',
  SGD: 'S$',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  TRY: '₺',
  ZAR: 'R',
  AED: 'د.إ',
  SAR: 'ر.س',
  KRW: '₩',
  THB: '฿',
  MYR: 'RM',
  IDR: 'Rp',
  PHP: '₱',
  CHF: 'CHF',
  ILS: '₪',
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'IDR',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD',
  'IQD',
  'JOD',
  'KWD',
  'LYD',
  'OMR',
  'TND',
]);

/** Minor-unit count to use when no merchant override is set. ISO 4217 default for the code, falling back to 2. */
function decimalsForCurrency(code: string): number {
  const c = code.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(c)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(c)) return 3;
  return 2;
}

export interface FormatCurrencyOptions {
  /** Explicit override for the active currency display. Skips `siteSettings` lookup when provided. */
  display?: CurrencyDisplay;
  /** Locale passed to `Intl.NumberFormat` when `display` is absent. Default `en-US`. */
  locale?: string;
}

/**
 * Resolve a best-guess currency symbol for an ISO 4217 code. Prefers the
 * built-in `Intl.NumberFormat` output for the active locale when available;
 * falls back to an opinionated table, then to the raw code.
 */
export function currencySymbol(currency: string, locale = 'en-US'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    const sym = parts.find((p) => p.type === 'currency');
    if (sym?.value) return sym.value;
  } catch {
    /* ignore — will fall through */
  }
  return FALLBACK_SYMBOLS[currency] ?? currency;
}

/**
 * Format a numeric amount as a currency string, honoring a merchant-supplied
 * `CurrencyDisplay` override when present (symbol position, separators,
 * decimals). When `display` is absent, falls back to `Intl.NumberFormat` with
 * the active locale and currency — matching the library's pre-v2.7 behavior.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options: FormatCurrencyOptions = {},
): string {
  const safeCurrency = (currency || 'USD').toUpperCase();
  const { display, locale = 'en-US' } = options;

  if (display) {
    const decimals = Math.max(0, Math.min(6, Math.floor(display.decimals)));
    const negative = amount < 0;
    const magnitude = Math.abs(amount);
    const fixed = magnitude.toFixed(decimals);
    const [intPart, decPart = ''] = fixed.split('.');
    // Insert thousand separators every 3 digits from the right.
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, display.thousandSep);
    const numeric = decimals > 0 ? `${intWithSep}${display.decimalSep}${decPart}` : intWithSep;

    const symbol = currencySymbol(safeCurrency, locale);
    let rendered: string;
    switch (display.position) {
      case 'right':
        rendered = `${numeric}${symbol}`;
        break;
      case 'left_space':
        rendered = `${symbol} ${numeric}`;
        break;
      case 'right_space':
        rendered = `${numeric} ${symbol}`;
        break;
      case 'left':
      default:
        rendered = `${symbol}${numeric}`;
        break;
    }
    return negative ? `-${rendered}` : rendered;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: safeCurrency,
    }).format(amount);
  } catch {
    return `${currencySymbol(safeCurrency, locale)}${amount.toFixed(
      decimalsForCurrency(safeCurrency),
    )}`;
  }
}

/** Default `CurrencyDisplay` for a given currency — used as a starting point when the merchant opens the admin editor. */
export function defaultCurrencyDisplay(currency: string): CurrencyDisplay {
  const c = (currency || 'USD').toUpperCase();
  return {
    position: 'left',
    thousandSep: ',',
    decimalSep: '.',
    decimals: decimalsForCurrency(c),
  };
}
