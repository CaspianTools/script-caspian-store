/**
 * Pure, dependency-free validation for the admin product editor.
 *
 * Returns a map of field path → i18n message key (resolve with `useT()`), so
 * the same rules can run in the editor, in a consumer's own form, or in a
 * script without pulling in React or a schema library. An empty object means
 * the draft is valid.
 *
 * Field paths: top-level fields use their own name (`name`, `price`, …);
 * list entries are addressed by position — `images.<i>`, `stock.<size>`,
 * `colorVariants.<i>.name`, `colorVariants.<i>.imageUrl`.
 */

export interface ProductDraft {
  name: string;
  brand: string;
  /** Raw input value — a string straight from an `<input>` or a number. */
  price: string | number;
  /** Optional weight in kg; blank means unset. */
  weightKg?: string | number;
  description?: string;
  category?: string;
  images?: readonly { url: string }[];
  /** Per-size stock as raw input values; blank means untracked. */
  stock?: Readonly<Record<string, string | number>>;
  colorVariants?: readonly { name: string; imageUrl: string }[];
}

export interface ProductValidationOptions {
  /**
   * Require a description of at least 10 characters. Off by default — the
   * library has always saved products without one, so turning it on is an
   * opt-in for stores that want it.
   */
  requireDescription?: boolean;
  /** Require a category. Off by default ("Uncategorised" is a valid choice). */
  requireCategory?: boolean;
}

export type ProductDraftErrors = Record<string, string>;

export const PRODUCT_NAME_MIN_LENGTH = 2;
export const PRODUCT_DESCRIPTION_MIN_LENGTH = 10;

/**
 * An image URL the storefront can render: absolute `http(s)://` (Firebase
 * Storage download URLs included) or a root-relative `/path` served by the
 * consumer site, which seeded/demo products use.
 */
export function isValidImageUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function isBlank(v: string | number | undefined): boolean {
  return v === undefined || String(v).trim() === '';
}

export function validateProductDraft(
  draft: ProductDraft,
  options: ProductValidationOptions = {},
): ProductDraftErrors {
  const errors: ProductDraftErrors = {};
  const v = 'admin.products.validation.';

  if (draft.name.trim().length < PRODUCT_NAME_MIN_LENGTH) errors.name = `${v}nameMin`;
  if (!draft.brand.trim()) errors.brand = `${v}brandRequired`;

  const price = isBlank(draft.price) ? NaN : Number(draft.price);
  // 0 stays valid: stores list free samples, and rejecting it would block
  // re-saving every product that was already priced at 0.
  if (!Number.isFinite(price) || price < 0) errors.price = `${v}pricePositive`;

  if (!isBlank(draft.weightKg)) {
    const weight = Number(draft.weightKg);
    if (!Number.isFinite(weight) || weight < 0) errors.weightKg = `${v}weightInvalid`;
  }

  if (options.requireCategory && !(draft.category ?? '').trim()) {
    errors.category = `${v}categoryRequired`;
  }
  if (
    options.requireDescription &&
    (draft.description ?? '').trim().length < PRODUCT_DESCRIPTION_MIN_LENGTH
  ) {
    errors.description = `${v}descriptionMin`;
  }

  (draft.images ?? []).forEach((img, i) => {
    if (!isValidImageUrl(img.url)) errors[`images.${i}`] = `${v}imageUrlInvalid`;
  });

  for (const [size, raw] of Object.entries(draft.stock ?? {})) {
    if (isBlank(raw)) continue;
    const qty = Number(String(raw).trim());
    if (!Number.isInteger(qty) || qty < 0) errors[`stock.${size}`] = `${v}stockInvalid`;
  }

  const seen = new Set<string>();
  (draft.colorVariants ?? []).forEach((variant, i) => {
    const name = variant.name.trim();
    if (!name) errors[`colorVariants.${i}.name`] = `${v}colorNameRequired`;
    else if (seen.has(name.toLowerCase())) errors[`colorVariants.${i}.name`] = `${v}colorNameDuplicate`;
    else seen.add(name.toLowerCase());
    if (!variant.imageUrl.trim()) errors[`colorVariants.${i}.imageUrl`] = `${v}colorImageRequired`;
    else if (!isValidImageUrl(variant.imageUrl)) {
      errors[`colorVariants.${i}.imageUrl`] = `${v}imageUrlInvalid`;
    }
  });

  return errors;
}
