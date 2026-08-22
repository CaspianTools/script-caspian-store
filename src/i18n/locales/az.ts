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
  'common.save': 'Yadda saxla',
  'common.delete': 'Sil',
  'common.edit': 'Redaktə et',
  'common.close': 'Bağla',
  'common.back': 'Geri',
  'common.next': 'İrəli',
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

  // POS — shell / navigation
  'pos.title': 'Kassa',
  'pos.nav.register': 'Kassa',
  'pos.nav.returns': 'Qaytarmalar',
  'pos.nav.shift': 'Növbə',
  'pos.nav.settings': 'Tənzimləmələr',
  'pos.nav.exit': 'Kassadan çıx',
  'pos.nav.admin': 'İdarə paneli',

  // POS — access
  'pos.guard.signInTitle': 'Daxil olmaq tələb olunur',
  'pos.guard.signInBody': 'Kassa üçün işçi və ya admin hesabı lazımdır.',
  'pos.guard.signInCta': 'Daxil ol',
  'pos.guard.deniedTitle': 'Bu hesab kassa üçün deyil',
  'pos.guard.deniedBody':
    'Bu hesabda işçi rolu yoxdur. Admin bunu İstifadəçilər bölməsindən verə bilər.',
  'pos.guard.deniedUid': 'Hesab identifikatorunuz',
  'pos.guard.copyUid': 'Kopyala',
  'pos.guard.copied': 'Kopyalandı',
  'pos.guard.disabledTitle': 'Kassa söndürülüb',
  'pos.guard.disabledBody':
    'Bu mağaza üçün kassa deaktivdir. Admin onu Tənzimləmələrdən aktiv edə bilər.',

  // POS — scanning
  'pos.scan.placeholder': 'Barkod və ya SKU skan edin ya da yazın',
  'pos.scan.hint': 'USB və ya Bluetooth skaner heç bir quraşdırma olmadan işləyir — sadəcə skan edin.',
  'pos.scan.submit': 'Satışa əlavə et',
  'pos.scan.camera': 'Kameradan istifadə et',
  'pos.scan.cameraStop': 'Kameranı dayandır',
  'pos.scan.cameraUnsupported':
    'Kamera ilə skan üçün Chrome və ya Edge lazımdır. USB skanerdən istifadə edin və ya kodu yuxarıda yazın.',
  'pos.scan.cameraDenied': 'Kameraya icazə verilmədi. Brauzer tənzimləmələrindən icazə verin.',
  'pos.scan.notFound': '{code} üzrə heç nə tapılmadı',
  'pos.scan.matchedBySku': 'SKU üzrə tapıldı',
  'pos.scan.matchedByBarcode': 'Barkod üzrə tapıldı',
  'pos.scan.matchedById': 'Məhsul identifikatoru üzrə tapıldı',
  'pos.scan.multipleMatches': '{count, plural, one {# məhsul uyğun gəlir} other {# məhsul uyğun gəlir}}',
  'pos.scan.chooseMatch': 'Hansı?',

  // POS — ticket
  'pos.ticket.title': 'Cari satış',
  'pos.ticket.empty': 'Satışa başlamaq üçün məhsul skan edin.',
  'pos.ticket.item': 'Məhsul',
  'pos.ticket.qty': 'Say',
  'pos.ticket.price': 'Qiymət',
  'pos.ticket.lineTotal': 'Cəmi',
  'pos.ticket.remove': 'Sətri sil',
  'pos.ticket.increase': 'Bir əlavə et',
  'pos.ticket.decrease': 'Bir çıx',
  'pos.ticket.discount': 'Sətir endirimi',
  'pos.ticket.clear': 'Satışı təmizlə',
  'pos.ticket.clearConfirm': 'Bütün satış silinsin?',
  'pos.ticket.subtotal': 'Ara cəm',
  'pos.ticket.discountTotal': 'Endirim',
  'pos.ticket.tax': 'Vergi',
  'pos.ticket.total': 'Yekun',
  'pos.ticket.itemCount': '{count, plural, =0 {Məhsul yoxdur} one {# məhsul} other {# məhsul}}',
  'pos.ticket.outOfStock': 'Stokda yoxdur',
  'pos.ticket.lowStock': '{count} qalıb',

  // POS — promo
  'pos.promo.label': 'Promo kod',
  'pos.promo.apply': 'Tətbiq et',
  'pos.promo.remove': 'Sil',
  'pos.promo.applied': '{code} promo kodu tətbiq edildi',
  'pos.promo.invalid': 'Bu promo kod etibarlı deyil',

  // POS — customer
  'pos.customer.walkIn': 'Adi müştəri',
  'pos.customer.attach': 'Müştəri əlavə et',
  'pos.customer.search': 'Ad və ya e-poçt üzrə axtar',
  'pos.customer.clear': 'Müştərini sil',

  // POS — tender
  'pos.tender.title': 'Ödənişi qəbul et',
  'pos.tender.due': 'Ödəniləcək məbləğ',
  'pos.tender.cash': 'Nağd',
  'pos.tender.card': 'Kart',
  'pos.tender.other': 'Digər',
  'pos.tender.tendered': 'Alınan nağd',
  'pos.tender.change': 'Qaytarılacaq',
  'pos.tender.exact': 'Dəqiq məbləğ',
  'pos.tender.split': 'Bölünmüş ödəniş',
  'pos.tender.addTender': 'Başqa ödəniş əlavə et',
  'pos.tender.removeTender': 'Sil',
  'pos.tender.remaining': 'Qalıq ödəniş',
  'pos.tender.reference': 'İstinad',
  'pos.tender.referenceHint': 'Kart təsdiq kodu, vauçer nömrəsi, köçürmə istinadı.',
  'pos.tender.confirm': 'Satışı tamamla',
  'pos.tender.cancel': 'Satışa qayıt',
  'pos.tender.shortfall': 'Ödəniş hələ yekunu örtmür.',
  'pos.tender.cardPrompt': 'Ödənişi POS terminalda alın, sonra burada təsdiqləyin.',

  // POS — completion
  'pos.done.title': 'Satış tamamlandı',
  'pos.done.receiptNumber': 'Qəbz {number}',
  'pos.done.changeDue': '{amount} qaytarın',
  'pos.done.print': 'Qəbzi çap et',
  'pos.done.newSale': 'Yeni satış',
  'pos.done.failed': 'Satış yadda saxlanılmadı',
  'pos.done.retry': 'Yenidən cəhd et',
  'pos.done.stockWarning':
    'Qeyd edildi, lakin {count, plural, one {# sətirdə} other {# sətirdə}} stok mənfiyə düşdü. Anbarı yoxlayın.',

  // POS — receipt
  'pos.receipt.title': 'Qəbz',
  'pos.receipt.number': 'Qəbz nömrəsi',
  'pos.receipt.date': 'Tarix',
  'pos.receipt.cashier': 'Xidmət göstərdi',
  'pos.receipt.register': 'Kassa',
  'pos.receipt.thanks': 'Təşəkkür edirik',
  'pos.receipt.paidWith': 'Ödəniş üsulu',

  // POS — settings
  'pos.settings.title': 'Kassa tənzimləmələri',
  'pos.settings.subtitle': 'Bunlar yalnız bu kompüterə aiddir.',
  'pos.settings.deviceLabel': 'Kassa adı',
  'pos.settings.deviceLabelHelp': 'Qəbzdə çap olunur ki, satışın hansı kassadan keçdiyi bilinsin. Məsələn "Ön piştaxta".',
  'pos.settings.deviceId': 'Cihaz identifikatoru',
  'pos.settings.language': 'Dil',
  'pos.settings.languageHelp': 'Kassa interfeysini yalnız bu kompüterdə dəyişir.',
  'pos.settings.printer': 'Qəbz printeri',
  'pos.settings.printerBrowser': 'Brauzerin çap pəncərəsi',
  'pos.settings.printerBrowserHelp': 'Kompüterinizdə artıq quraşdırılmış istənilən printerlə işləyir.',
  'pos.settings.scannerGap': 'Skaner sürəti',
  'pos.settings.scannerGapHelp':
    'Skan sayılan düymələr arasındakı maksimum millisaniyə. Skanlar bölünürsə artırın; sürətli yazı skan kimi qəbul edilirsə azaldın.',
  'pos.settings.save': 'Yadda saxla',
  'pos.settings.saved': 'Tənzimləmələr yadda saxlanıldı',

  // POS — storage mode
  'pos.storage.title': 'Satışlar harada saxlanılır',
  'pos.storage.cloud': 'Bulud',
  'pos.storage.cloudHelp':
    'Satışlar onlayn mağazanıza sinxronlaşır. Hesabatlar, stok və idare paneli uyğun qalır.',
  'pos.storage.local': 'Yalnız bu kompüter',
  'pos.storage.localHelp':
    'Satışlar bu kompüterdə qalır və heç yerə göndərilmir. İnternet lazım deyil, lakin onlayn idarə panelində heç nə görünmür və ehtiyat nüsxə sizin məsuliyyətinizdədir.',

  // POS — licence
  'pos.license.title': 'Lisenziya',
  'pos.license.key': 'Lisenziya açarı',
  'pos.license.activate': 'Aktivləşdir',
  'pos.license.active': '{name} adına lisenziyalıdır',
  'pos.license.expires': 'Bitmə tarixi {date}',
  'pos.license.missing': 'Bu kassa lisenziyalı deyil',
  'pos.license.invalid': 'Bu lisenziya açarı etibarlı deyil',
  'pos.license.expired': 'Bu lisenziyanın müddəti {date} tarixində bitib',
  'pos.license.seatTaken': 'Bu lisenziya artıq başqa kompüterdə istifadə olunur',
  'pos.license.bannerUnlicensed': 'Lisenziyasız kassa — Tənzimləmələrdən aktivləşdirin.',
  'pos.license.bannerExpired': 'Lisenziyanın müddəti bitib — Tənzimləmələrdən yeniləyin.',
  'pos.license.dismiss': 'Bağla',
  'pos.license.remove': 'Açarı sil',
  'pos.license.activated': 'Lisenziya aktivləşdirildi',
  'pos.license.keyHelp':
    'Bu kassanı alanda sizə göndərilən açarı yapışdırın. Açar yalnız bu bir kompüterə bağlıdır.',
  'pos.license.unverifiable':
    'Açar saxlanıldı, lakin bu brauzer onu yoxlaya bilmir. Kassa onlayn olanda təsdiqlənəcək.',
  'pos.license.offline':
    'Bu kompüterdə saxlanıldı. Növbəti dəfə onlayn olanda lisenziya serveri ilə təsdiqlənəcək.',
};

export default az;
