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
 * The overlays are partial on purpose. An honest gap in English beats a
 * machine-translated one that reads as finished.
 */
export const POS_MESSAGES: Record<string, MessageDict> = {
  en: POS_MESSAGES_EN,
  az: { ...POS_MESSAGES_EN, ...az },
  ru: { ...POS_MESSAGES_EN, ...ru },
  tr: { ...POS_MESSAGES_EN, ...tr },
};

export { POS_MESSAGES_EN };
