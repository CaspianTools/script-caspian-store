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
  'pos.queue.noNumbers': 'Не удаётся зарезервировать номера чеков',
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

  // POS — автономная касса: вход, настройка и учётные записи
  'pos.local.signInTitle': 'Вход',
  'pos.local.signInBody':
    'Введите имя пользователя и пароль, которые вам выдали при настройке этой кассы.',
  'pos.local.username': 'Имя пользователя',
  'pos.local.usernameHelp': 'То, что вы вводите для входа. Регистр не важен.',
  'pos.local.password': 'Пароль',
  'pos.local.confirmPassword': 'Пароль ещё раз',
  'pos.local.displayName': 'Полное имя',
  'pos.local.displayNameHelp': 'Имя, которое показывается рядом с продажами этой учётной записи.',
  'pos.local.signIn': 'Войти',
  'pos.local.signingIn': 'Выполняется вход…',
  'pos.local.badCredentials':
    'Такое имя пользователя и пароль не подходят ни к одной учётной записи на этой кассе.',
  'pos.local.showPassword': 'Показать пароль',
  'pos.local.hidePassword': 'Скрыть пароль',
  'pos.local.capsLock': 'Включён Caps Lock.',
  'pos.local.passwordSpaces':
    'Этот пароль начинается или заканчивается пробелом. Так можно, но вводить его придётся каждый раз одинаково.',
  'pos.local.language': 'Язык',
  'pos.local.storageBlocked':
    'Касса не может обратиться к своему хранилищу, поэтому никого не может впустить. Возможно, в настройках браузера заблокированы данные сайта.',
  'pos.local.storageFailedTitle': 'Касса не может открыть свои записи',
  'pos.local.storageFailedBody':
    'Учётные записи, каталог и продажи по-прежнему на этом компьютере, но браузер не даёт кассе их прочитать. Ничего не потеряно. Обычно это заблокированные данные сайта или окно в режиме инкогнито. Обратитесь к тому, кто настраивал этот компьютер, — не настраивайте кассу заново.',
  'pos.local.insecureContextTitle': 'Касса открыта по небезопасному адресу',
  'pos.local.insecureContextBody':
    'По обычному адресу http пароль проверить нельзя. Кассе нужен https или адрес localhost. Попросите того, кто настраивал этот компьютер, исправить адрес — здесь менять нечего.',
  'pos.local.commissionTitle': 'Настройка этой кассы',
  'pos.local.commissionBody':
    'Создайте учётную запись поддержки. Потом она сможет добавить сотрудников магазина, а до этого остаётся единственной записью на этой кассе.',
  'pos.local.commissionCta': 'Создать учётную запись',
  'pos.local.commissioning': 'Создаётся…',
  'pos.local.commissionFailed': 'Учётную запись не удалось создать.',
  'pos.local.roleUnavailable':
    'Роль «Поддержка» на этой кассе отключена, поэтому учётную запись создать нельзя.',
  'pos.local.usernameEmpty': 'Введите имя пользователя.',
  'pos.local.passwordHelp': 'Не менее {min} символов.',
  'pos.local.passwordTooShort': 'Введите не менее {min} символов.',
  'pos.local.passwordMismatch': 'Пароли не совпадают.',
  'pos.local.passwordsMatch': 'Пароли совпадают.',
  'pos.local.usernameTaken': 'Такое имя пользователя на этой кассе уже занято.',
  'pos.local.noAccessTitle': 'Нет доступа к кассе',
  'pos.local.noAccessBody':
    'Этой учётной записи не разрешено открывать кассу. Попросите изменить это того, кто настраивал компьютер.',
  'pos.admin.people.addTitle': 'Добавить человека',
  'pos.admin.people.add': 'Добавить',
  'pos.admin.people.added': 'Учётная запись создана',
  'pos.admin.people.addFailed': 'Эту учётную запись создать не удалось.',
  'pos.admin.people.invalidRole': 'Эта роль не включена.',
  'pos.admin.people.roleLabel': 'Может пользоваться',
  'pos.admin.people.role.superadmin': 'Поддержка',
  'pos.admin.people.role.admin': 'Владелец',
  'pos.admin.people.role.staff': 'Кассир',
  'pos.admin.people.roleHelp.superadmin':
    'Всё, включая добавление других учётных записей поддержки. Для того, кто устанавливает и обслуживает эту кассу.',
  'pos.admin.people.roleHelp.admin':
    'Касса и этот внутренний раздел. Для владельца магазина и менеджеров.',
  'pos.admin.people.roleHelp.staff': 'Только касса. Не может менять цены, товары и людей.',
  'pos.admin.people.roleHelp.default': 'Доступ по областям, выбранным для этой роли.',
  'pos.admin.people.listTitle': 'Люди на этой кассе',
  'pos.admin.people.resetPassword': 'Новый пароль',
  'pos.admin.people.newPasswordPrompt': 'Новый пароль для {name}',
  'pos.admin.people.passwordChanged': 'Пароль изменён',
  'pos.admin.people.enable': 'Впустить',
  'pos.admin.people.disable': 'Заблокировать',
  'pos.admin.people.disabled': 'заблокирован',
  'pos.admin.people.you': 'вы',
  'pos.admin.people.confirmDelete': 'Удалить учётную запись {name}?',
  'pos.admin.people.deleteNote':
    'Блокировка оставляет имя человека на продажах, которые он пробил. Удаление тоже, но впустить его обратно без создания новой записи не получится.',

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
  'pos.ticket.discountPlaceholder': 'Сумма скидки',
  'pos.ticket.discountApply': 'Применить',
  'pos.ticket.discountClear': 'Очистить',
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
  'pos.done.provisionalReceipt':
    'На этой кассе закончились номера чеков, поэтому продаже присвоена ссылка с этого компьютера. Настоящий номер чека будет присвоен, когда продажа дойдёт до магазина.',
  'pos.done.changeDue': 'Выдайте сдачу {amount}',
  'pos.done.print': 'Печать чека',
  'pos.done.newSale': 'Новая продажа',
  'pos.done.failed': 'Не удалось сохранить продажу',
  'pos.done.outcomeUnknown':
    'Не удалось проверить последнюю продажу. Не меняйте эту продажу - нажмите «Принять оплату» ещё раз, чтобы её завершить.',
  'pos.settings.languagePinned':
    'Этот сайт задаёт язык своей собственной маршрутизацией, поэтому ваш выбор сохраняется, но не изменит то, что вы здесь видите.',
  'pos.settings.deviceLabelPlaceholder': 'Передний прилавок',
  'pos.done.retry': 'Повторить',
  'pos.done.stockWarning':
    'Записано, но остаток ушёл в минус по {count, plural, one {# строке} other {# строкам}}. Проверьте склад.',

  // POS — receipt
  'pos.receipt.title': 'Чек',
  'pos.receipt.number': 'Номер чека',
  'pos.receipt.provisional': 'Только ссылка — ещё не номер чека магазина',
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
  // Storage health and the recovered sale (v13.2)
  'pos.settings.storage.healthTitle': 'Сохраняет ли этот компьютер ваши данные?',
  'pos.settings.storage.persisted': 'Защищённое хранилище',
  'pos.settings.storage.persistedYes': 'Включено — браузер не удалит ваши данные',
  'pos.settings.storage.persistedNo': 'Выключено — браузер может удалить ваши данные',
  'pos.settings.storage.persistedUnknown': 'Браузер не отвечает на этот вопрос',
  'pos.settings.storage.persistHelp':
    'Без защищённого хранилища браузеру разрешено очистить эту кассу, когда закончится место на диске. Установка кассы (кнопка «Установить» в шапке) обычно включает его. Настройте также папку для автоматических резервных копий — именно эта копия переживёт всё.',
  'pos.settings.storage.persistAsk': 'Включить защищённое хранилище',
  'pos.settings.storage.recheck': 'Проверить снова',
  'pos.settings.storage.database': 'База данных кассы',
  'pos.settings.storage.databaseOk': 'Работает',
  'pos.settings.storage.databaseBlocked':
    'Касса открыта в другой вкладке и заблокирована ею. Закройте другие вкладки и проверьте снова.',
  'pos.settings.storage.used': 'Занято места',
  'pos.settings.storage.usedOf': '{used} из {total}',
  'pos.openSale.found':
    'В {when} осталась незавершённая продажа на {count} товаров. Продолжите её или очистите.',
  'pos.openSale.foundOther':
    '{name} оставил(а) незавершённую продажу на {count} товаров в {when}. Продолжите её или очистите.',
  'pos.openSale.resume': 'Продолжить продажу',
  'pos.openSale.discard': 'Очистить',
  'pos.openSale.dismiss': 'Понятно',
  'pos.openSale.settled':
    'Продажа, остававшаяся здесь открытой, уже была записана как чек {receipt}, поэтому она очищена. Никто не был списан дважды.',

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
