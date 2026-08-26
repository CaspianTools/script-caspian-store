import type { MessageDict } from '../messages';

/**
 * Russian (ru). Same scope as the other built-in overlays: the POS register
 * plus the shared `common.*` / `auth.*` strings a cashier meets. Everything
 * else falls through to English via the merge in `LocaleProvider`.
 */
const ru: MessageDict = {
  // Common
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.delete': 'Удалить',
  'common.edit': 'Изменить',
  'common.close': 'Закрыть',
  'common.back': 'Назад',
  'common.next': 'Далее',
  'common.search': 'Поиск',
  'common.loading': 'Загрузка…',
  'common.error': 'Ошибка',
  'common.retry': 'Повторить',
  'common.confirm': 'Подтвердить',
  'common.yes': 'Да',
  'common.no': 'Нет',

  // Auth
  'auth.login.title': 'Вход',
  'auth.login.subtitle': 'С возвращением. Войдите, чтобы продолжить.',
  'auth.logout': 'Выйти',
  'auth.email': 'Эл. почта',
  'auth.password': 'Пароль',
};

export default ru;
