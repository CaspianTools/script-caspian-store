/**
 * Server-side mirror of the checkout page's tax estimate
 * (src/components/checkout-page.tsx, `taxAmount`). Before v15.2 the checkout
 * showed a tax row and a total that included it, but the Stripe callable
 * never charged it and the webhook never wrote `Order.tax`, so every
 * Stripe order under-collected by exactly the tax shown.
 *
 * Keep this in step with the client formula: the shopper must be charged the
 * total they were shown.
 */

interface SupportedCountryRow {
  code?: string;
  taxRate?: number;
}

function rate(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Tax on `subtotal` per `settings/site`: `flat` uses `flatTaxRate`;
 * `per-country` reads the `taxRate` of the matching `supportedCountries` row,
 * keyed on the shipping country or, under `taxConfig.taxBasedOn: 'store'`,
 * the store's own `country`. `none` / unset charges nothing.
 */
export async function computeTax(
  db: FirebaseFirestore.Firestore,
  subtotal: number,
  shippingCountry: string | undefined,
): Promise<number> {
  const site = (await db.collection('settings').doc('site').get()).data() ?? {};
  const mode = site.taxMode;
  let taxRate = 0;
  if (mode === 'flat') {
    taxRate = rate(site.flatTaxRate);
  } else if (mode === 'per-country') {
    const basedOn = site.taxConfig?.taxBasedOn ?? 'shipping';
    const country = basedOn === 'store' ? (site.country ?? '') : (shippingCountry ?? '');
    const rows = (Array.isArray(site.supportedCountries) ? site.supportedCountries : []) as SupportedCountryRow[];
    taxRate = rate(rows.find((c) => c.code === country)?.taxRate);
  }
  return Math.round(subtotal * taxRate * 100) / 100;
}
