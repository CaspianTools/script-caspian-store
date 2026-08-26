import type { MessageDict } from '../messages';

/**
 * Turkish (tr). Same scope as the other built-in overlays: the POS register
 * plus the shared `common.*` / `auth.*` strings a cashier meets. Everything
 * else falls through to English via the merge in `LocaleProvider`.
 */
const tr: MessageDict = {
  // Common
  'common.cancel': 'İptal',
  'common.save': 'Kaydet',
  'common.delete': 'Sil',
  'common.edit': 'Düzenle',
  'common.close': 'Kapat',
  'common.back': 'Geri',
  'common.next': 'İleri',
  'common.search': 'Ara',
  'common.loading': 'Yükleniyor…',
  'common.error': 'Hata',
  'common.retry': 'Tekrar dene',
  'common.confirm': 'Onayla',
  'common.yes': 'Evet',
  'common.no': 'Hayır',

  // Auth
  'auth.login.title': 'Giriş yap',
  'auth.login.subtitle': 'Tekrar hoş geldiniz. Devam etmek için giriş yapın.',
  'auth.logout': 'Çıkış yap',
  'auth.email': 'E-posta',
  'auth.password': 'Parola',
};

export default tr;
