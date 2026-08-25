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

  // POS — shell / navigation
  'pos.title': 'Kasa',
  'pos.nav.register': 'Kasa',
  'pos.nav.returns': 'İadeler',
  'pos.nav.settings': 'Ayarlar',
  'pos.nav.exit': 'Kasadan çık',
  'pos.nav.queue': 'Bekleyen satışlar',
  'pos.done.heldTitle': 'Bu kasada kaydedildi',
  'pos.queue.title': 'Bekleyen satışlar',
  'pos.queue.subtitle': 'Bu kasada yapılan ama mağazaya henüz ulaşmamış satışlar. İnternet döndüğünde kendiliğinden gönderilir.',
  'pos.queue.sendNow': 'Şimdi gönder',
  'pos.queue.retry': 'Yeniden dene',
  'pos.queue.heldTitle': 'Gönderilmeyi bekliyor',
  'pos.queue.heldEmpty': 'Bekleyen bir şey yok. Bu kasadaki her satış mağazaya ulaştı.',
  'pos.queue.blockedTitle': 'İlgi bekliyor',
  'pos.queue.blockedEmpty': 'Takılan bir şey yok.',
  'pos.queue.sentTitle': 'Gönderildi',
  'pos.queue.stateHeld': 'Bekliyor',
  'pos.queue.stateSent': 'Gönderildi',
  'pos.queue.offline': 'İnternet yok',
  'pos.queue.offlineHolding': 'İnternet yok — {count} bekliyor',
  'pos.queue.sending': '{count} gönderiliyor',
  'pos.queue.blockedCount': '{count} ilgi bekliyor',
  'pos.queue.lowNumbers': '{count} fiş numarası kaldı',
  'pos.queue.noNumbers': 'Fiş numarası ayrılamıyor',
  'pos.queue.paused': 'Gönderim duraklatıldı',
  'pos.queue.pausedBody': 'Bu hesabın artık satış kaydetme izni yok, bu yüzden hiçbir şey gönderilmiyor. Personel rolü olan bir hesapla giriş yapın; bekleyen satışlar geçecektir.',
  'pos.queue.reason.network': 'Mağazayla bağlantı yok',
  'pos.queue.reason.signedOut': 'Çıkış yapıldı — yeniden giriliyor',
  'pos.queue.reason.notAllowed': 'Bu hesap artık satış kaydedemez',
  'pos.queue.reason.productGone': 'Satıştaki bir ürün katalogdan silindi',
  'pos.queue.reason.rejected': 'Mağaza bu satışı reddetti',
  'pos.queue.reason.repeatedFailure': 'Çok kez başarısız oldu — bir kişi bakmalı',
  'pos.install.action': 'Yükle',
  'pos.install.help': 'Kasayı bu bilgisayara uygulama olarak yükleyin; böylece kendi penceresinde açılır.',
  'pos.install.iosHint': 'Paylaş düğmesine dokunun, sonra "Ana Ekrana Ekle" seçeneğini seçin.',
  'pos.update.available': 'Kasanın yeni sürümü hazır.',
  'pos.update.apply': 'Şimdi güncelle',
  'pos.update.later': 'Sonra',
  'pos.nav.admin': 'Yönetim paneli',

  // POS — access
  'pos.guard.signInTitle': 'Giriş gerekli',
  'pos.guard.signInBody': 'Kasa için personel veya yönetici hesabı gerekir.',
  'pos.guard.signInCta': 'Giriş yap',
  'pos.guard.deniedTitle': 'Bu hesap kasa hesabı değil',
  'pos.guard.deniedBody':
    'Bu hesapta personel rolü yok. Bir yönetici bunu Kullanıcılar bölümünden verebilir.',
  'pos.guard.deniedUid': 'Hesap kimliğiniz',
  'pos.guard.copyUid': 'Kimliği kopyala',
  'pos.guard.copied': 'Kopyalandı',
  'pos.guard.disabledTitle': 'Kasa kapalı',
  'pos.guard.disabledBody':
    'Bu mağaza için satış noktası devre dışı. Bir yönetici Ayarlar’dan etkinleştirebilir.',

  // POS — bağımsız kasa: giriş, kurulum ve hesaplar
  'pos.local.signInTitle': 'Giriş',
  'pos.local.signInBody': 'Bu kasa kurulurken size verilen kullanıcı adını ve parolayı girin.',
  'pos.local.username': 'Kullanıcı adı',
  'pos.local.usernameHelp': 'Giriş yaparken yazdığınız ad. Büyük küçük harf fark etmez.',
  'pos.local.password': 'Parola',
  'pos.local.confirmPassword': 'Parola tekrar',
  'pos.local.displayName': 'Tam ad',
  'pos.local.displayNameHelp': 'Bu hesabın kaydettiği satışların yanında görünen ad.',
  'pos.local.signIn': 'Giriş yap',
  'pos.local.signingIn': 'Giriş yapılıyor…',
  'pos.local.badCredentials': 'Bu kullanıcı adı ve parola bu kasadaki hiçbir hesapla eşleşmiyor.',
  'pos.local.showPassword': 'Parolayı göster',
  'pos.local.hidePassword': 'Parolayı gizle',
  'pos.local.capsLock': 'Caps Lock açık.',
  'pos.local.passwordSpaces':
    'Bu parola boşlukla başlıyor veya bitiyor. Buna izin var, ama her seferinde aynı şekilde yazılması gerekir.',
  'pos.local.language': 'Dil',
  'pos.local.storageBlocked':
    'Bu kasa kendi deposuna erişemiyor, bu yüzden kimseyi içeri alamıyor. Tarayıcı ayarlarında site verileri engellenmiş olabilir.',
  'pos.local.storageFailedTitle': 'Bu kasa kendi kayıtlarını açamıyor',
  'pos.local.storageFailedBody':
    'Hesaplar, katalog ve satışlar hâlâ bu bilgisayarda, ama tarayıcı kasanın bunları okumasına izin vermiyor. Hiçbir şey kaybolmadı. Bunun nedeni genellikle engellenmiş site verileri ya da gizli penceredir. Bu bilgisayarı kuran kişiye danışın — kasayı yeniden kurmayın.',
  'pos.local.insecureContextTitle': 'Bu kasa güvenli bir adreste değil',
  'pos.local.insecureContextBody':
    'Düz http adresinde parola doğrulanamaz. Kasanın https adresine ya da localhost üzerinden açılmaya ihtiyacı var. Bu bilgisayarı kuran kişiden adresi düzeltmesini isteyin — burada değiştirilecek bir şey yok.',
  'pos.local.commissionTitle': 'Bu kasayı kur',
  'pos.local.commissionBody':
    'Destek hesabını oluşturun. Sonrasında dükkânın kendi personelini o ekleyebilir ve bunu yapana kadar bu kasadaki tek hesaptır.',
  'pos.local.commissionCta': 'Hesabı oluştur',
  'pos.local.commissioning': 'Oluşturuluyor…',
  'pos.local.commissionFailed': 'Hesap oluşturulamadı.',
  'pos.local.roleUnavailable': 'Bu kasada Destek rolü kapalı, bu yüzden hesap oluşturulamıyor.',
  'pos.local.usernameEmpty': 'Bir kullanıcı adı yazın.',
  'pos.local.passwordHelp': 'En az {min} karakter.',
  'pos.local.passwordTooShort': 'En az {min} karakter kullanın.',
  'pos.local.passwordMismatch': 'İki parola aynı değil.',
  'pos.local.passwordsMatch': 'İki parola aynı.',
  'pos.local.usernameTaken': 'Bu kullanıcı adı bu kasada zaten kullanılıyor.',
  'pos.local.noAccessTitle': 'Kasaya erişim yok',
  'pos.local.noAccessBody':
    'Bu hesabın kasayı açma izni yok. Bu bilgisayarı kuran kişiden değiştirmesini isteyin.',
  'pos.admin.people.addTitle': 'Birini ekle',
  'pos.admin.people.add': 'Ekle',
  'pos.admin.people.added': 'Hesap oluşturuldu',
  'pos.admin.people.addFailed': 'Bu hesap oluşturulamadı.',
  'pos.admin.people.invalidRole': 'Bu rol etkin değil.',
  'pos.admin.people.roleLabel': 'Kullanabilir',
  'pos.admin.people.role.superadmin': 'Destek',
  'pos.admin.people.role.admin': 'Sahip',
  'pos.admin.people.role.staff': 'Kasiyer',
  'pos.admin.people.roleHelp.superadmin':
    'Her şey, başka destek hesapları eklemek dahil. Bu kasayı kuran ve bakımını yapan kişi için.',
  'pos.admin.people.roleHelp.admin': 'Kasa ve bu arka ofis. Dükkân sahibi ve müdürler için.',
  'pos.admin.people.roleHelp.staff': 'Sadece kasa. Fiyatları, ürünleri ve kişileri değiştiremez.',
  'pos.admin.people.roleHelp.default': 'Bu rol için seçilen alanlara göre erişim.',
  'pos.admin.people.listTitle': 'Bu kasadaki kişiler',
  'pos.admin.people.resetPassword': 'Yeni parola',
  'pos.admin.people.newPasswordPrompt': '{name} için yeni parola',
  'pos.admin.people.passwordChanged': 'Parola değiştirildi',
  'pos.admin.people.enable': 'İçeri al',
  'pos.admin.people.disable': 'Engelle',
  'pos.admin.people.disabled': 'engelli',
  'pos.admin.people.you': 'siz',
  'pos.admin.people.confirmDelete': '{name} hesabı silinsin mi?',
  'pos.admin.people.deleteNote':
    'Birini engellemek, kaydettiği satışlarda adını korur. Silmek de korur, ama hesabı yeniden oluşturmadan onu geri alamazsınız.',

  // POS — scanning
  'pos.scan.placeholder': 'Barkod veya stok kodu okutun ya da yazın',
  'pos.scan.hint': 'USB veya Bluetooth okuyucu kurulum gerektirmeden çalışır — sadece okutun.',
  'pos.scan.submit': 'Satışa ekle',
  'pos.scan.camera': 'Kamerayı kullan',
  'pos.scan.cameraStop': 'Kamerayı durdur',
  'pos.scan.cameraUnsupported':
    'Kamerayla okutma için Chrome veya Edge gerekir. USB okuyucu kullanın ya da kodu yukarıya yazın.',
  'pos.scan.cameraDenied': 'Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.',
  'pos.scan.notFound': '{code} ile eşleşen bir şey yok',
  'pos.scan.matchedBySku': 'Stok koduyla eşleşti',
  'pos.scan.matchedByBarcode': 'Barkodla eşleşti',
  'pos.scan.matchedById': 'Ürün kimliğiyle eşleşti',
  'pos.scan.multipleMatches': '{count, plural, one {# ürün eşleşiyor} other {# ürün eşleşiyor}}',
  'pos.scan.chooseMatch': 'Hangisi?',

  // POS — ticket
  'pos.ticket.title': 'Mevcut satış',
  'pos.ticket.empty': 'Satışa başlamak için bir ürün okutun.',
  'pos.ticket.item': 'Ürün',
  'pos.ticket.qty': 'Adet',
  'pos.ticket.price': 'Fiyat',
  'pos.ticket.lineTotal': 'Tutar',
  'pos.ticket.remove': 'Satırı kaldır',
  'pos.ticket.increase': 'Bir ekle',
  'pos.ticket.decrease': 'Bir çıkar',
  'pos.ticket.discount': 'Satır indirimi',
  'pos.ticket.discountPlaceholder': 'İndirim tutarı',
  'pos.ticket.discountApply': 'Uygula',
  'pos.ticket.discountClear': 'Temizle',
  'pos.ticket.clear': 'Satışı temizle',
  'pos.ticket.clearConfirm': 'Satışın tamamı silinsin mi?',
  'pos.ticket.subtotal': 'Ara toplam',
  'pos.ticket.discountTotal': 'İndirim',
  'pos.ticket.tax': 'Vergi',
  'pos.ticket.total': 'Toplam',
  'pos.ticket.itemCount': '{count, plural, =0 {Ürün yok} one {# ürün} other {# ürün}}',
  'pos.ticket.outOfStock': 'Stokta yok',
  'pos.ticket.lowStock': '{count} kaldı',

  // POS — promo
  'pos.promo.label': 'Promosyon kodu',
  'pos.promo.apply': 'Uygula',
  'pos.promo.remove': 'Kaldır',
  'pos.promo.applied': '{code} promosyon kodu uygulandı',
  'pos.promo.invalid': 'Bu promosyon kodu geçerli değil',

  // POS — customer
  'pos.customer.walkIn': 'Gelen müşteri',
  'pos.customer.attach': 'Müşteri ekle',
  'pos.customer.search': 'İsim veya e-posta ile ara',
  'pos.customer.clear': 'Müşteriyi kaldır',

  // POS — tender
  'pos.tender.title': 'Ödemeyi al',
  'pos.tender.due': 'Ödenecek tutar',
  'pos.tender.cash': 'Nakit',
  'pos.tender.card': 'Kart',
  'pos.tender.other': 'Diğer',
  'pos.tender.tendered': 'Alınan nakit',
  'pos.tender.change': 'Para üstü',
  'pos.tender.exact': 'Tam tutar',
  'pos.tender.split': 'Bölünmüş ödeme',
  'pos.tender.addTender': 'Başka ödeme ekle',
  'pos.tender.removeTender': 'Kaldır',
  'pos.tender.remaining': 'Kalan ödeme',
  'pos.tender.reference': 'Referans',
  'pos.tender.referenceHint': 'Kart onay kodu, kupon numarası, havale referansı.',
  'pos.tender.confirm': 'Satışı tamamla',
  'pos.tender.cancel': 'Satışa dön',
  'pos.tender.shortfall': 'Ödeme henüz toplamı karşılamıyor.',
  'pos.tender.cardPrompt': 'Ödemeyi POS cihazından alın, sonra burada onaylayın.',

  // POS — completion
  'pos.done.title': 'Satış tamamlandı',
  'pos.done.receiptNumber': 'Fiş {number}',
  'pos.done.provisionalReceipt':
    'Bu kasada fiş numarası kalmadı, bu yüzden satışa bu bilgisayardan bir referans verildi. Satış mağazaya ulaştığında gerçek fiş numarasını alacak.',
  'pos.done.changeDue': '{amount} para üstü verin',
  'pos.done.print': 'Fişi yazdır',
  'pos.done.newSale': 'Yeni satış',
  'pos.done.failed': 'Satış kaydedilemedi',
  'pos.done.outcomeUnknown':
    'Son satış denetlenemedi. Bu satışı değiştirmeyin - bitirmek için yeniden Ödeme al düğmesine basın.',
  'pos.settings.languagePinned':
    'Bu site dili kendi yönlendirmesinden belirler; bu yüzden seçiminiz saklanır ama burada gördüğünüzü değiştirmez.',
  'pos.settings.deviceLabelPlaceholder': 'Ön tezgâh',
  'pos.done.retry': 'Tekrar dene',
  'pos.done.stockWarning':
    'Kaydedildi, ancak {count, plural, one {# satırda} other {# satırda}} stok eksiye düştü. Envanteri kontrol edin.',

  // POS — receipt
  'pos.receipt.title': 'Fiş',
  'pos.receipt.number': 'Fiş no.',
  'pos.receipt.provisional': 'Yalnızca referans — henüz mağaza fiş numarası değil',
  'pos.receipt.date': 'Tarih',
  'pos.receipt.cashier': 'Hizmet veren',
  'pos.receipt.register': 'Kasa',
  'pos.receipt.thanks': 'Teşekkür ederiz',
  'pos.receipt.paidWith': 'Ödeme yöntemi',

  // POS — settings
  'pos.settings.title': 'Kasa ayarları',
  'pos.settings.subtitle': 'Bunlar yalnızca bu bilgisayar için geçerlidir.',
  'pos.settings.deviceLabel': 'Kasa adı',
  'pos.settings.deviceLabelHelp': 'Satışı hangi kasanın aldığını görebilmek için fişe basılır. Örn. “Ön kasa”.',
  'pos.settings.deviceId': 'Cihaz kimliği',
  'pos.settings.language': 'Dil',
  'pos.settings.languageHelp': 'Kasa arayüzünü yalnızca bu bilgisayarda değiştirir.',
  'pos.settings.printer': 'Fiş yazıcısı',
  'pos.settings.printerBrowser': 'Tarayıcı yazdırma penceresi',
  'pos.settings.printerBrowserHelp': 'Bilgisayarınızda kurulu herhangi bir yazıcıyla çalışır.',
  'pos.settings.scannerGap': 'Okuyucu hızı',
  'pos.settings.scannerGapHelp':
    'Okutma sayılan tuş vuruşları arasındaki en fazla milisaniye. Okutmalar bölünüyorsa artırın; hızlı yazma okutma sanılıyorsa azaltın.',
  'pos.settings.save': 'Kaydet',
  'pos.settings.saved': 'Ayarlar kaydedildi',
  // Storage health and the recovered sale (v13.2)
  'pos.settings.storage.healthTitle': 'Bu bilgisayar verilerinizi saklıyor mu?',
  'pos.settings.storage.persisted': 'Korumalı depolama',
  'pos.settings.storage.persistedYes': 'Açık — bu tarayıcı verilerinizi silmeyecek',
  'pos.settings.storage.persistedNo': 'Kapalı — bu tarayıcı verilerinizi silebilir',
  'pos.settings.storage.persistedUnknown': 'Bu tarayıcı yanıt vermiyor',
  'pos.settings.storage.persistHelp':
    'Korumalı depolama olmadan disk dolduğunda tarayıcının bu kasayı temizlemesine izin verilir. Kasayı kurmak (başlıktaki Kur düğmesi) genellikle bunu açar. Ayrıca otomatik yedekleme klasörü de ayarlayın — her şeye rağmen ayakta kalan kopya odur.',
  'pos.settings.storage.persistAsk': 'Korumalı depolamayı aç',
  'pos.settings.storage.recheck': 'Yeniden denetle',
  'pos.settings.storage.database': 'Kasa veritabanı',
  'pos.settings.storage.databaseOk': 'Çalışıyor',
  'pos.settings.storage.databaseBlocked':
    'Kasa başka bir sekmede açık ve onu tutuyor. Diğer sekmeleri kapatıp yeniden denetleyin.',
  'pos.settings.storage.used': 'Kullanılan alan',
  'pos.settings.storage.usedOf': '{total} içinden {used}',
  'pos.openSale.found':
    '{when} saatinde {count} ürünlük yarım kalmış bir satış var. Devam edin ya da temizleyin.',
  'pos.openSale.foundOther':
    '{name}, {when} saatinde {count} ürünlük bir satışı yarım bıraktı. Devam edin ya da temizleyin.',
  'pos.openSale.resume': 'Satışa devam et',
  'pos.openSale.discard': 'Temizle',
  'pos.openSale.dismiss': 'Tamam',
  'pos.openSale.settled':
    'Burada açık kalan satış zaten {receipt} numaralı fiş olarak kaydedilmişti, bu yüzden temizlendi. Kimseden iki kez tahsilat yapılmadı.',

  // POS — storage mode
  'pos.storage.title': 'Satışlar nerede saklanır',
  'pos.storage.cloud': 'Bulut',
  'pos.storage.cloudHelp':
    'Satışlar çevrimiçi mağazanızla eşitlenir. Raporlar, stok ve yönetim paneli uyumlu kalır.',
  'pos.storage.local': 'Yalnızca bu bilgisayar',
  'pos.storage.localHelp':
    'Satışlar bu bilgisayarda kalır ve hiçbir yere gönderilmez. İnternet gerekmez, ancak çevrimiçi yönetim panelinde hiçbir şey görünmez ve yedekleme sizin sorumluluğunuzdadır.',

  // POS — licence
  'pos.license.title': 'Lisans',
  'pos.license.key': 'Lisans anahtarı',
  'pos.license.activate': 'Etkinleştir',
  'pos.license.active': '{name} adına lisanslı',
  'pos.license.expires': 'Bitiş {date}',
  'pos.license.missing': 'Bu kasa lisanslı değil',
  'pos.license.invalid': 'Bu lisans anahtarı geçerli değil',
  'pos.license.expired': 'Bu lisansın süresi {date} tarihinde doldu',
  'pos.license.seatTaken': 'Bu lisans başka bir bilgisayarda kullanılıyor',
  'pos.license.bannerUnlicensed': 'Lisanssız kasa — Ayarlar’dan etkinleştirin.',
  'pos.license.bannerExpired': 'Lisans süresi doldu — Ayarlar’dan yenileyin.',
  'pos.license.dismiss': 'Kapat',
  'pos.license.remove': 'Anahtarı kaldır',
  'pos.license.activated': 'Lisans etkinleştirildi',
  'pos.license.keyHelp':
    'Bu kasayı satın aldığınızda size gönderilen anahtarı yapıştırın. Yalnızca bu bilgisayara bağlıdır.',
  'pos.license.unverifiable':
    'Anahtar kaydedildi, ancak bu tarayıcı onu doğrulayamıyor. Kasa çevrimiçi olduğunda onaylanacak.',
  'pos.license.offline':
    'Bu bilgisayara kaydedildi. Bir sonraki çevrimiçi olduğunuzda lisans sunucusunda onaylanacak.',
};

export default tr;
