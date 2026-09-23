import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Server-side mirror of the storefront shipping calculator
 * (src/services/shipping-calculator.ts + src/shipping/plugins/*). The client
 * picks a rate and sends `shippingCost` + the rate's label as
 * `shippingInfo.shippingMethod`; before v15.1 the callable trusted that number
 * as-is, so a tampered request could ship for free. This recomputes every
 * rate the store currently offers from `shippingPluginInstalls` and refuses a
 * cost that matches none of them.
 *
 * Keep the four `calculate` branches in step with the client plugins — a new
 * shipping plugin lands here in the same PR or its rate is rejected.
 */

export interface ShippingCartLine {
  quantity: number;
  weightKg: number | null;
}

interface OfferedRate {
  label: string;
  price: number;
}

function nonNegative(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function calculate(
  pluginId: string,
  config: Record<string, unknown>,
  subtotal: number,
  lines: ShippingCartLine[],
): number | null {
  switch (pluginId) {
    case 'flat-rate':
      return nonNegative(config.price);
    case 'free-shipping':
      return 0;
    case 'free-over-threshold': {
      const threshold = nonNegative(config.threshold);
      const fallbackPrice = nonNegative(config.fallbackPrice);
      if (threshold === null || fallbackPrice === null) return null;
      return subtotal >= threshold ? 0 : fallbackPrice;
    }
    case 'weight-based': {
      const basePrice = nonNegative(config.basePrice);
      const pricePerKg = nonNegative(config.pricePerKg);
      if (basePrice === null || pricePerKg === null) return null;
      let totalKg = 0;
      let anyWeighted = false;
      for (const line of lines) {
        if (typeof line.weightKg === 'number' && line.weightKg > 0) {
          totalKg += line.weightKg * line.quantity;
          anyWeighted = true;
        }
      }
      return anyWeighted ? basePrice + totalKg * pricePerKg : null;
    }
    default:
      return null;
  }
}

async function listOfferedRates(
  db: FirebaseFirestore.Firestore,
  subtotal: number,
  lines: ShippingCartLine[],
): Promise<OfferedRate[]> {
  const snap = await db.collection('shippingPluginInstalls').where('enabled', '==', true).get();
  const rates: OfferedRate[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const config = (data.config ?? {}) as Record<string, unknown>;
    const price = calculate(String(data.pluginId ?? ''), config, subtotal, lines);
    if (price === null) continue;
    rates.push({ label: String(data.name ?? ''), price });
  }
  return rates;
}

const toCents = (n: number) => Math.round(n * 100);

/**
 * Returns the validated shipping cost, or throws. A store with no enabled
 * shipping install only ever ships for free (the checkout offers no rate to
 * pick, so the client sends 0). When the requested label matches an install,
 * the cost must match that install's rate; otherwise it must match any
 * offered rate — older or custom checkouts may not send the label.
 */
export async function assertShippingCost(
  db: FirebaseFirestore.Firestore,
  requested: unknown,
  methodLabel: string | undefined,
  subtotal: number,
  lines: ShippingCartLine[],
): Promise<number> {
  const cost = requested == null ? 0 : Number(requested);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new HttpsError('invalid-argument', 'shippingCost must be a non-negative number.');
  }

  const rates = await listOfferedRates(db, subtotal, lines);
  const byLabel = methodLabel ? rates.filter((r) => r.label === methodLabel) : [];
  const candidates = byLabel.length > 0 ? byLabel : rates;
  const matches =
    rates.length === 0 ? toCents(cost) === 0 : candidates.some((r) => toCents(r.price) === toCents(cost));

  if (!matches) {
    throw new HttpsError(
      'failed-precondition',
      'The shipping cost does not match a currently offered rate. Refresh the page and try again.',
    );
  }
  return cost;
}
