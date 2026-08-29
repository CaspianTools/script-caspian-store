import type { MessageDict } from '@caspian-explorer/script-caspian-store';
import { POS_MESSAGES_EN } from './pos-messages';
import az from './pos-az';
import ru from './pos-ru';
import tr from './pos-tr';

/**
 * The register's own dictionaries, in the shape `messagesByLocale` wants.
 *
 * Each overlay is composed *onto English here* rather than handed over bare,
 * and that is load-bearing. `LocaleProvider` merges
 * `DEFAULT_MESSAGES → BUILTIN_LOCALES[locale] → messagesByLocale[locale]`, and
 * since the till moved out of the library there is no `pos.*` layer in either
 * of the first two. A bare `az` overlay would therefore leave every key it has
 * not translated with nothing underneath it, and `t()` renders a missing key as
 * the key -- a cashier switching to Azerbaijani would meet `pos.tender.due` on
 * the tender screen. Composing here restores the fallback the library used to
 * provide.
 *
 * The overlays used to be partial on purpose, on the argument that an honest
 * gap in English beats a machine-translated one that reads as finished. As of
 * v1.10.0 there are no gaps: all four dictionaries carry every key, and
 * `check-standalone.mjs` fails the build if that stops being true. The
 * composition above stays anyway -- it is what makes a key added tomorrow
 * render in English rather than as `pos.tender.due`.
 */
export const POS_MESSAGES: Record<string, MessageDict> = {
  en: POS_MESSAGES_EN,
  az: { ...POS_MESSAGES_EN, ...az },
  ru: { ...POS_MESSAGES_EN, ...ru },
  tr: { ...POS_MESSAGES_EN, ...tr },
};

/**
 * The RAW overlays, uncomposed. Only the guard wants these: `POS_MESSAGES`
 * above is composed over English, so it always shows full parity and can never
 * reveal a missing translation.
 */
export const POS_OVERLAYS: Record<string, MessageDict> = { az, ru, tr };

export { POS_MESSAGES_EN };
