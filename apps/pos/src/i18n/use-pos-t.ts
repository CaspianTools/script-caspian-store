'use client';

import { useCallback } from 'react';
import { useT, useLocale } from '@caspian-explorer/script-caspian-store';
import { POS_MESSAGES_EN } from './pos-messages';
import az from './pos-az';
import ru from './pos-ru';
import tr from './pos-tr';
import { formatPosMessage } from './plural';

/**
 * `useT`, with plural arms the locale's own grammar chooses.
 *
 * Every screen in the till imports this ALIASED AS `useT`, so no call site
 * changes and nothing inside a component has to know it exists:
 *
 *     import { usePosT as useT } from '../../i18n/use-pos-t';
 *
 * Adoption has to be total, which is why `check-standalone.mjs` scans for a
 * direct library `useT` import and fails on one. Partial adoption is the worst
 * outcome available: a translator adds a correct `few` arm, and whether it
 * renders depends on which file the string happens to be on.
 *
 * A key this dictionary does not hold falls through to the library's `useT` --
 * `common.save`, `common.cancel` and the rest live there and are not the till's
 * to translate.
 */

const DICTS: Record<string, Record<string, string>> = { az, ru, tr };

export function usePosT(): (key: string, values?: Record<string, string | number>) => string {
  const locale = useLocale();
  const fallback = useT();

  return useCallback(
    (key, values) => {
      // Same resolution order the provider uses: the locale's overlay, then
      // English underneath it.
      const primary = locale.split('-')[0];
      const template = DICTS[primary]?.[key] ?? POS_MESSAGES_EN[key];
      if (template === undefined) return fallback(key, values);
      return formatPosMessage(locale, template, values);
    },
    [locale, fallback],
  );
}
