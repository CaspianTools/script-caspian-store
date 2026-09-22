import { logger } from 'firebase-functions';

/**
 * Presentment currencies Stripe accepts on Checkout Sessions and coupons
 * (https://docs.stripe.com/currencies). Kept as a static set so a typo in
 * the admin Settings page degrades to a logged `usd` fallback instead of a
 * Stripe API error at the moment a shopper clicks "Pay".
 */
const STRIPE_CURRENCIES = new Set([
  'usd', 'aed', 'afn', 'all', 'amd', 'ang', 'aoa', 'ars', 'aud', 'awg', 'azn', 'bam', 'bbd',
  'bdt', 'bgn', 'bhd', 'bif', 'bmd', 'bnd', 'bob', 'brl', 'bsd', 'bwp', 'byn', 'bzd', 'cad',
  'cdf', 'chf', 'clp', 'cny', 'cop', 'crc', 'cve', 'czk', 'djf', 'dkk', 'dop', 'dzd', 'egp',
  'etb', 'eur', 'fjd', 'fkp', 'gbp', 'gel', 'gip', 'gmd', 'gnf', 'gtq', 'gyd', 'hkd', 'hnl',
  'htg', 'huf', 'idr', 'ils', 'inr', 'isk', 'jmd', 'jod', 'jpy', 'kes', 'kgs', 'khr', 'kmf',
  'krw', 'kwd', 'kyd', 'kzt', 'lak', 'lbp', 'lkr', 'lrd', 'lsl', 'mad', 'mdl', 'mga', 'mkd',
  'mmk', 'mnt', 'mop', 'mur', 'mvr', 'mwk', 'mxn', 'myr', 'mzn', 'nad', 'ngn', 'nio', 'nok',
  'npr', 'nzd', 'omr', 'pab', 'pen', 'pgk', 'php', 'pkr', 'pln', 'pyg', 'qar', 'ron', 'rsd',
  'rub', 'rwf', 'sar', 'sbd', 'scr', 'sek', 'sgd', 'shp', 'sle', 'sos', 'srd', 'std', 'szl',
  'thb', 'tjs', 'tnd', 'top', 'try', 'ttd', 'twd', 'tzs', 'uah', 'ugx', 'uyu', 'uzs', 'vnd',
  'vuv', 'wst', 'xaf', 'xcd', 'xof', 'xpf', 'yer', 'zar', 'zmw',
]);

/** Stripe charges these in whole units — `unit_amount` is NOT scaled by 100. */
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv',
  'xaf', 'xof', 'xpf',
]);

/** Three-decimal currencies; Stripe requires the last digit to be zero. */
const THREE_DECIMAL = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);

/**
 * The store currency for Stripe, lowercased. `settings/site.currency` is the
 * admin Settings → Store field; `scriptSettings/site.defaultCurrency` is the
 * older Script Settings field the storefront formatters read. Whichever is
 * set first wins; anything Stripe does not support falls back to `usd` with
 * a warning so the cause is visible in Cloud Logging.
 */
export async function resolveStoreCurrency(db: FirebaseFirestore.Firestore): Promise<string> {
  const [siteSnap, scriptSnap] = await Promise.all([
    db.collection('settings').doc('site').get(),
    db.collection('scriptSettings').doc('site').get(),
  ]);
  const candidates = [siteSnap.data()?.currency, scriptSnap.data()?.defaultCurrency];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const code = raw.trim().toLowerCase();
    if (STRIPE_CURRENCIES.has(code)) return code;
    logger.warn(`[caspian-stripe] Store currency "${raw}" is not a Stripe currency; using usd.`);
    return 'usd';
  }
  return 'usd';
}

/** Convert a major-unit amount (e.g. 12.5) to Stripe's integer minor units for `currency`. */
export function toStripeAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return Math.round(amount);
  if (THREE_DECIMAL.has(currency)) return Math.round(amount * 100) * 10;
  return Math.round(amount * 100);
}
