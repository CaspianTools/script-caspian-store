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

  // POS — shell / navigation
  'pos.title': 'Касса',
  'pos.nav.register': 'Касса',
  'pos.nav.returns': 'Возвраты',
  'pos.nav.shift': 'Смена',
  'pos.nav.settings': 'Настройки',
  'pos.nav.exit': 'Выйти из кассы',
  'pos.nav.queue': 'Отложенные продажи',
  'pos.done.heldTitle': 'Сохранено на этой кассе',
  'pos.queue.title': 'Отложенные продажи',
  'pos.queue.subtitle': 'Продажи, сделанные на этой кассе, но ещё не полученные магазином. Они отправятся автоматически, когда вернётся интернет.',
  'pos.queue.sendNow': 'Отправить сейчас',
  'pos.queue.retry': 'Попробовать снова',
  'pos.queue.heldTitle': 'Ожидают отправки',
  'pos.queue.heldEmpty': 'Ничего не ждёт. Все продажи с этой кассы дошли до магазина.',
  'pos.queue.blockedTitle': 'Требуют внимания',
  'pos.queue.blockedEmpty': 'Ничего не застряло.',
  'pos.queue.sentTitle': 'Отправлено',
  'pos.queue.stateHeld': 'Ожидает',
  'pos.queue.stateSent': 'Отправлено',
  'pos.queue.offline': 'Нет интернета',
  'pos.queue.offlineHolding': 'Нет интернета — {count} в ожидании',
  'pos.queue.sending': 'Отправка: {count}',
  'pos.queue.blockedCount': '{count} требуют внимания',
  'pos.queue.lowNumbers': 'Осталось номеров чеков: {count}',
  'pos.queue.paused': 'Отправка приостановлена',
  'pos.queue.pausedBody': 'Этой учётной записи больше не разрешено записывать продажи, поэтому ничего не отправляется. Войдите под учётной записью с ролью «Сотрудник», и отложенные продажи пройдут.',
  'pos.queue.reason.network': 'Нет связи с магазином',
  'pos.queue.reason.signedOut': 'Выполнен выход — выполняется повторный вход',
  'pos.queue.reason.notAllowed': 'Этой учётной записи больше нельзя записывать продажи',
  'pos.queue.reason.productGone': 'Товар из продажи удалён из каталога',
  'pos.queue.reason.rejected': 'Магазин отклонил эту продажу',
  'pos.queue.reason.repeatedFailure': 'Слишком много неудачных попыток — нужен человек',
  'pos.install.action': 'Установить',
  'pos.install.help': 'Установите кассу на этот компьютер как приложение, чтобы она открывалась в своём окне.',
  'pos.install.iosHint': 'Нажмите кнопку «Поделиться», затем выберите «На экран «Домой»».',
  'pos.update.available': 'Готова новая версия кассы.',
  'pos.update.apply': 'Обновить',
  'pos.update.later': 'Позже',
  'pos.nav.admin': 'Панель администратора',

  // POS — access
  'pos.guard.signInTitle': 'Требуется вход',
  'pos.guard.signInBody': 'Для кассы нужна учётная запись сотрудника или администратора.',
  'pos.guard.signInCta': 'Войти',
  'pos.guard.deniedTitle': 'Учётная запись не кассовая',
  'pos.guard.deniedBody':
    'У этой учётной записи нет роли сотрудника. Администратор может выдать её в разделе «Пользователи».',
  'pos.guard.deniedUid': 'Идентификатор вашей учётной записи',
  'pos.guard.copyUid': 'Копировать',
  'pos.guard.copied': 'Скопировано',
  'pos.guard.disabledTitle': 'Касса отключена',
  'pos.guard.disabledBody':
    'Точка продаж отключена для этого магазина. Администратор может включить её в настройках.',

  // POS — scanning
  'pos.scan.placeholder': 'Отсканируйте или введите штрихкод / артикул',
  'pos.scan.hint': 'USB- или Bluetooth-сканер работает без настройки — просто сканируйте.',
  'pos.scan.submit': 'Добавить в продажу',
  'pos.scan.camera': 'Использовать камеру',
  'pos.scan.cameraStop': 'Остановить камеру',
  'pos.scan.cameraUnsupported':
    'Для сканирования камерой нужен Chrome или Edge. Используйте USB-сканер или введите код выше.',
  'pos.scan.cameraDenied': 'Доступ к камере запрещён. Разрешите его в настройках браузера.',
  'pos.scan.notFound': 'Ничего не найдено по «{code}»',
  'pos.scan.matchedBySku': 'Найдено по артикулу',
  'pos.scan.matchedByBarcode': 'Найдено по штрихкоду',
  'pos.scan.matchedById': 'Найдено по идентификатору товара',
  'pos.scan.multipleMatches':
    '{count, plural, one {# товар подходит} other {# товаров подходит}}',
  'pos.scan.chooseMatch': 'Какой именно?',

  // POS — ticket
  'pos.ticket.title': 'Текущая продажа',
  'pos.ticket.empty': 'Отсканируйте товар, чтобы начать продажу.',
  'pos.ticket.item': 'Товар',
  'pos.ticket.qty': 'Кол-во',
  'pos.ticket.price': 'Цена',
  'pos.ticket.lineTotal': 'Сумма',
  'pos.ticket.remove': 'Удалить строку',
  'pos.ticket.increase': 'Добавить один',
  'pos.ticket.decrease': 'Убрать один',
  'pos.ticket.discount': 'Скидка на строку',
  'pos.ticket.clear': 'Очистить продажу',
  'pos.ticket.clearConfirm': 'Очистить всю продажу?',
  'pos.ticket.subtotal': 'Промежуточный итог',
  'pos.ticket.discountTotal': 'Скидка',
  'pos.ticket.tax': 'Налог',
  'pos.ticket.total': 'Итого',
  'pos.ticket.itemCount': '{count, plural, =0 {Нет товаров} one {# товар} other {# товаров}}',
  'pos.ticket.outOfStock': 'Нет в наличии',
  'pos.ticket.lowStock': 'Осталось {count}',

  // POS — promo
  'pos.promo.label': 'Промокод',
  'pos.promo.apply': 'Применить',
  'pos.promo.remove': 'Убрать',
  'pos.promo.applied': 'Промокод {code} применён',
  'pos.promo.invalid': 'Этот промокод недействителен',

  // POS — customer
  'pos.customer.walkIn': 'Случайный покупатель',
  'pos.customer.attach': 'Привязать покупателя',
  'pos.customer.search': 'Поиск по имени или эл. почте',
  'pos.customer.clear': 'Убрать покупателя',

  // POS — tender
  'pos.tender.title': 'Принять оплату',
  'pos.tender.due': 'К оплате',
  'pos.tender.cash': 'Наличные',
  'pos.tender.card': 'Карта',
  'pos.tender.other': 'Другое',
  'pos.tender.tendered': 'Получено наличными',
  'pos.tender.change': 'Сдача',
  'pos.tender.exact': 'Точная сумма',
  'pos.tender.split': 'Разделить оплату',
  'pos.tender.addTender': 'Добавить ещё оплату',
  'pos.tender.removeTender': 'Убрать',
  'pos.tender.remaining': 'Осталось оплатить',
  'pos.tender.reference': 'Ссылка',
  'pos.tender.referenceHint': 'Код авторизации карты, номер ваучера, ссылка перевода.',
  'pos.tender.confirm': 'Завершить продажу',
  'pos.tender.cancel': 'Вернуться к продаже',
  'pos.tender.shortfall': 'Оплата пока не покрывает итог.',
  'pos.tender.cardPrompt': 'Примите оплату на терминале, затем подтвердите здесь.',

  // POS — completion
  'pos.done.title': 'Продажа завершена',
  'pos.done.receiptNumber': 'Чек {number}',
  'pos.done.changeDue': 'Выдайте сдачу {amount}',
  'pos.done.print': 'Печать чека',
  'pos.done.newSale': 'Новая продажа',
  'pos.done.failed': 'Не удалось сохранить продажу',
  'pos.done.outcomeUnknown':
    'Не удалось проверить последнюю продажу. Не меняйте эту продажу - нажмите «Принять оплату» ещё раз, чтобы её завершить.',
  'pos.storage.comingSoon': 'Появится в одном из следующих выпусков.',
  'pos.settings.languagePinned':
    'Этот сайт задаёт язык своей собственной маршрутизацией, поэтому ваш выбор сохраняется, но не изменит то, что вы здесь видите.',
  'pos.settings.deviceLabelPlaceholder': 'Передний прилавок',
  'pos.done.retry': 'Повторить',
  'pos.done.stockWarning':
    'Записано, но остаток ушёл в минус по {count, plural, one {# строке} other {# строкам}}. Проверьте склад.',

  // POS — receipt
  'pos.receipt.title': 'Чек',
  'pos.receipt.number': 'Номер чека',
  'pos.receipt.date': 'Дата',
  'pos.receipt.cashier': 'Обслужил',
  'pos.receipt.register': 'Касса',
  'pos.receipt.thanks': 'Спасибо',
  'pos.receipt.paidWith': 'Способ оплаты',

  // POS — settings
  'pos.settings.title': 'Настройки кассы',
  'pos.settings.subtitle': 'Применяются только к этому компьютеру.',
  'pos.settings.deviceLabel': 'Название кассы',
  'pos.settings.deviceLabelHelp': 'Печатается на чеке, чтобы было видно, какая касса приняла продажу. Например «Передняя стойка».',
  'pos.settings.deviceId': 'Идентификатор устройства',
  'pos.settings.language': 'Язык',
  'pos.settings.languageHelp': 'Меняет интерфейс кассы только на этом компьютере.',
  'pos.settings.printer': 'Принтер чеков',
  'pos.settings.printerBrowser': 'Диалог печати браузера',
  'pos.settings.printerBrowserHelp': 'Работает с любым принтером, уже установленным на компьютере.',
  'pos.settings.scannerGap': 'Скорость сканера',
  'pos.settings.scannerGapHelp':
    'Максимум миллисекунд между нажатиями, которые считаются сканированием. Увеличьте, если сканы приходят разбитыми; уменьшите, если быстрый набор принимается за скан.',
  'pos.settings.save': 'Сохранить',
  'pos.settings.saved': 'Настройки сохранены',

  // POS — storage mode
  'pos.storage.title': 'Где хранятся продажи',
  'pos.storage.cloud': 'Облако',
  'pos.storage.cloudHelp':
    'Продажи синхронизируются с онлайн-магазином. Отчёты, остатки и панель администратора остаются согласованными.',
  'pos.storage.local': 'Только этот компьютер',
  'pos.storage.localHelp':
    'Продажи остаются на этом компьютере и никуда не отправляются. Интернет не нужен, но в онлайн-панели ничего не появится, и резервные копии — на вас.',

  // POS — licence
  'pos.license.title': 'Лицензия',
  'pos.license.key': 'Лицензионный ключ',
  'pos.license.activate': 'Активировать',
  'pos.license.active': 'Лицензия на {name}',
  'pos.license.expires': 'Действует до {date}',
  'pos.license.missing': 'Эта касса не лицензирована',
  'pos.license.invalid': 'Этот лицензионный ключ недействителен',
  'pos.license.expired': 'Срок лицензии истёк {date}',
  'pos.license.seatTaken': 'Эта лицензия уже используется на другом компьютере',
  'pos.license.bannerUnlicensed': 'Касса без лицензии — активируйте её в настройках.',
  'pos.license.bannerExpired': 'Срок лицензии истёк — продлите её в настройках.',
  'pos.license.dismiss': 'Скрыть',
  'pos.license.remove': 'Удалить ключ',
  'pos.license.activated': 'Лицензия активирована',
  'pos.license.keyHelp':
    'Вставьте ключ, который вы получили при покупке этой кассы. Он привязан к одному компьютеру.',
  'pos.license.unverifiable':
    'Ключ сохранён, но этот браузер не может его проверить. Он будет подтверждён, когда касса выйдет в сеть.',
  'pos.license.offline':
    'Сохранено на этом компьютере. Подтвердится на сервере лицензий при следующем выходе в сеть.',
};

export default ru;
