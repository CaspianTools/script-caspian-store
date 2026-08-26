import type { MessageDict } from '../messages';

/**
 * Azerbaijani (az). Covers the POS register surface plus the shared
 * `common.*` / `auth.*` strings a cashier meets, which is the scope v10.0.0
 * ships translated. Every other key falls through to English via the merge in
 * `LocaleProvider` — an honest gap beats a machine-translated storefront.
 */
const az: MessageDict = {
  // Common
  'common.cancel': 'Ləğv et',
  'common.clear': 'Təmizlə',
  'common.close': 'Bağla',
  'common.save': 'Yadda saxla',
  'common.delete': 'Sil',
  'common.edit': 'Redaktə et',
  'common.back': 'Geri',
  'common.next': 'İrəli',
  'common.expand': 'Genişlət',
  'common.collapse': 'Yığ',
  'common.search': 'Axtar',
  'common.loading': 'Yüklənir…',
  'common.error': 'Xəta',
  'common.retry': 'Yenidən cəhd et',
  'common.confirm': 'Təsdiqlə',
  'common.yes': 'Bəli',
  'common.no': 'Xeyr',

  // Auth
  'auth.login.title': 'Daxil ol',
  'auth.login.subtitle': 'Xoş gəldiniz. Davam etmək üçün daxil olun.',
  'auth.logout': 'Çıxış',
  'auth.email': 'E-poçt',
  'auth.password': 'Şifrə',
};

export default az;
