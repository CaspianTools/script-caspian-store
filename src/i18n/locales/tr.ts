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
  'pos.nav.shift': 'Vardiya',
  'pos.nav.settings': 'Ayarlar',
  'pos.nav.exit': 'Kasadan çık',
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
  'pos.done.changeDue': '{amount} para üstü verin',
  'pos.done.print': 'Fişi yazdır',
  'pos.done.newSale': 'Yeni satış',
  'pos.done.failed': 'Satış kaydedilemedi',
  'pos.done.retry': 'Tekrar dene',
  'pos.done.stockWarning':
    'Kaydedildi, ancak {count, plural, one {# satırda} other {# satırda}} stok eksiye düştü. Envanteri kontrol edin.',

  // POS — receipt
  'pos.receipt.title': 'Fiş',
  'pos.receipt.number': 'Fiş no.',
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
};

export default tr;
