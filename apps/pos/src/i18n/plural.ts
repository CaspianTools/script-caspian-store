/**
 * Plural arms that match the language, not English.
 *
 * The library's `interpolate` parses `few` and `many` into its arm table and
 * then never selects them: its rule is `count === 1 ? one : other`. So every
 * Russian plural in this till carries `few` and `many` arms that can never be
 * reached, and a Russian cashier reads `2 товара` as `2 товаров` — the grammar
 * is in the translation file and the code throws it away.
 *
 * The library is a separate product on a separate release cycle, so the till
 * selects the arm itself. `Intl.PluralRules` is the browser's own answer and
 * needs no table.
 *
 * **This file is a shim with an exit.** Once `interpolate` learns
 * `Intl.PluralRules`, delete `plural.ts` and `use-pos-t.ts`, drop the aliased
 * imports, and the till goes back to the library's `useT` unchanged.
 */

/** `{count, plural, one {# item} other {# items}}` — the same subset the library parses. */
const PLURAL = /\{(\w+),\s*plural,\s*([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
const ARM = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
const SIMPLE = /\{(\w+)\}/g;

type Values = Record<string, string | number> | undefined;

function selectArm(locale: string, count: number, arms: Record<string, string>): string {
  const exact = arms[`=${count}`];
  if (exact !== undefined) return exact;

  let category = '';
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    // An unknown locale, or an engine without PluralRules. Fall back to the
    // library's English rule rather than to nothing.
    category = count === 1 ? 'one' : 'other';
  }
  return arms[category] ?? arms.other ?? arms.one ?? '';
}

/**
 * Expand `{placeholder}` substitutions and the ICU-plural subset, choosing the
 * arm the locale's own grammar calls for.
 */
export function formatPosMessage(locale: string, template: string, values?: Values): string {
  if (!values) return template;

  const withPlurals = template.replace(PLURAL, (whole, key: string, body: string) => {
    const raw = values[key];
    const count = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(count)) return whole;

    const arms: Record<string, string> = {};
    let match: RegExpExecArray | null;
    ARM.lastIndex = 0;
    while ((match = ARM.exec(body)) !== null) arms[match[1]] = match[2];

    return selectArm(locale, count, arms).replace(/#/g, String(count));
  });

  return withPlurals.replace(SIMPLE, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}
