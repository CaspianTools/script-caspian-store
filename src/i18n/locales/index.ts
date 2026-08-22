import type { MessageDict } from '../messages';
import az from './az';
import ru from './ru';
import tr from './tr';

/**
 * Translations that ship with the library.
 *
 * English is not listed: it lives in `DEFAULT_MESSAGES` and is the base every
 * other locale merges on top of, so an untranslated key renders in English
 * rather than as a raw `pos.tender.due` identifier.
 *
 * Scope, stated plainly: these overlays cover the POS register and the shared
 * `common.*` / `auth.*` strings its operator meets — the surface v10.0.0
 * added. The storefront, page builder, setup wizard, and the wider admin have
 * roughly a thousand more keys that still fall through to English. Machine-
 * translating those to look complete would be worse than the visible gap.
 *
 * Consumers extend or override any of this through `messagesByLocale` on the
 * provider, which merges *above* these, so a store can correct a phrase or add
 * a locale without waiting on a release.
 */
export const BUILTIN_LOCALES: Record<string, MessageDict> = { az, ru, tr };

/** Locale codes with a built-in dictionary, English included. */
export const BUILTIN_LOCALE_CODES: readonly string[] = ['en', 'az', 'ru', 'tr'] as const;

/** Endonyms for the language picker — a language is named in its own language. */
export const BUILTIN_LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  az: 'Azərbaycan dili',
  ru: 'Русский',
  tr: 'Türkçe',
};

export { az, ru, tr };
