# Manual Testing Checklist for Authentication System

Bu belge, POI yönetim paneli kimlik doğrulama sisteminin manuel testleri için kapsamlı bir kontrol listesi sağlar.

## 🔐 Temel Kimlik Doğrulama Testleri

### Login Sayfası UI/UX Testleri

- [ ] **Login sayfası yükleme**
  - Login sayfası doğru şekilde yükleniyor
  - Sayfa responsive tasarıma sahip (mobil, tablet, desktop)
  - Tüm form elemanları görünür ve erişilebilir

- [ ] **Form elemanları**
  - Şifre alanı mevcut ve çalışıyor
  - "Beni Hatırla" checkbox'ı mevcut (varsa)
  - Login butonu aktif ve tıklanabilir
  - Form validation mesajları görünüyor

- [ ] **Şifre görünürlük toggle**
  - Şifre göster/gizle butonu çalışıyor
  - Şifre alanı text/password türleri arasında geçiş yapıyor
  - Icon değişimi doğru şekilde çalışıyor

- [ ] **Hata mesajları**
  - Hatalı şifre girişinde uygun hata mesajı gösteriliyor
  - Hata mesajları kullanıcı dostu ve anlaşılır
  - Toast/alert mesajları doğru şekilde görünüyor

### Kimlik Doğrulama İşlevselliği

- [ ] **Başarılı login**
  - Doğru şifre ile giriş başarılı oluyor
  - Giriş sonrası yönetim paneline yönlendiriliyor
  - Session doğru şekilde oluşturuluyor

- [ ] **Başarısız login**
  - Yanlış şifre ile giriş reddediliyor
  - Kalan deneme hakkı gösteriliyor
  - Uygun hata mesajı görüntüleniyor

- [ ] **Boş form gönderimi**
  - Boş şifre alanı ile form gönderilemiyor
  - Uygun validation mesajı gösteriliyor

## 🛡️ Güvenlik Testleri

### Rate Limiting ve Brute Force Koruması

- [ ] **Başarısız deneme sayısı**
  - 5 başarısız denemeden sonra hesap kilitleniyor
  - Kilitlenme süresi doğru şekilde gösteriliyor
  - Kilitlenme sonrası giriş denemesi engellenmiyor

- [ ] **Progressive delay**
  - İlk birkaç başarısız denemeden sonra gecikme uygulanıyor
  - Gecikme süresi artan şekilde uygulanıyor
  - Gecikme sırasında uygun mesaj gösteriliyor

- [ ] **IP bazlı kısıtlama**
  - Farklı IP'lerden giriş denemeleri bağımsız olarak değerlendiriliyor
  - Bir IP'nin kilitlenmesi diğerlerini etkilemiyor

### Session Yönetimi

- [ ] **Session oluşturma**
  - Başarılı giriş sonrası session oluşturuluyor
  - Session bilgileri doğru şekilde saklanıyor
  - CSRF token oluşturuluyor

- [ ] **Session timeout**
  - Belirlenen süre sonunda session otomatik olarak sonlanıyor
  - Timeout sonrası login sayfasına yönlendiriliyor
  - Timeout uyarısı gösteriliyor (varsa)

- [ ] **Remember Me işlevselliği**
  - "Beni Hatırla" seçeneği session süresini uzatıyor
  - Uzatılmış session doğru süre boyunca geçerli kalıyor
  - Tarayıcı kapatılıp açıldığında session devam ediyor

### CSRF Koruması

- [ ] **CSRF token oluşturma**
  - Her session için benzersiz CSRF token oluşturuluyor
  - Token form ve AJAX isteklerinde kullanılıyor

- [ ] **CSRF token doğrulama**
  - Geçersiz token ile istekler reddediliyor
  - Token olmadan kritik işlemler yapılamıyor
  - Logout işlemi CSRF token gerektiriyor

## 🔄 Session ve Logout Testleri

### Logout İşlevselliği

- [ ] **Manuel logout**
  - Logout butonu çalışıyor
  - Logout sonrası session temizleniyor
  - Login sayfasına yönlendiriliyor

- [ ] **Logout sonrası erişim**
  - Logout sonrası korumalı sayfalara erişim engellenmiyor
  - Browser back butonu ile korumalı sayfalara dönüş engellenmiyor

### Session Persistence

- [ ] **Sayfa yenileme**
  - Sayfa yenilendiğinde session korunuyor
  - Kullanıcı giriş yapmış olarak kalıyor

- [ ] **Yeni tab/pencere**
  - Yeni tab'da session paylaşılıyor
  - Aynı session bilgileri kullanılıyor

- [ ] **Tarayıcı kapatma**
  - Tarayıcı kapatıldığında session davranışı doğru
  - "Beni Hatırla" seçeneğine göre session korunuyor/temizleniyor

## 🔑 Şifre Değiştirme Testleri

### Şifre Değiştirme Formu

- [ ] **Form erişimi**
  - Şifre değiştirme formu sadece giriş yapmış kullanıcılara açık
  - Form elemanları doğru şekilde görünüyor

- [ ] **Form validation**
  - Mevcut şifre doğrulaması çalışıyor
  - Yeni şifre güçlülük kontrolü yapılıyor
  - Şifre onayı eşleşme kontrolü çalışıyor

- [ ] **Başarılı şifre değiştirme**
  - Şifre başarıyla değiştiriliyor
  - Tüm aktif sessionlar sonlandırılıyor
  - Yeni şifre ile giriş yapılabiliyor

### Şifre Güçlülük Kontrolü

- [ ] **Minimum gereksinimler**
  - En az 8 karakter kontrolü
  - Büyük harf gerekliliği
  - Küçük harf gerekliliği
  - Rakam gerekliliği
  - Özel karakter gerekliliği

- [ ] **Zayıf şifre reddi**
  - Yaygın şifreler reddediliyor
  - Çok basit şifreler reddediliyor
  - Uygun hata mesajları gösteriliyor

## 🌐 Tarayıcı Uyumluluğu Testleri

### Desktop Tarayıcılar

- [ ] **Chrome**
  - Tüm işlevler çalışıyor
  - UI doğru görünüyor
  - Session yönetimi çalışıyor

- [ ] **Firefox**
  - Tüm işlevler çalışıyor
  - UI doğru görünüyor
  - Session yönetimi çalışıyor

- [ ] **Safari**
  - Tüm işlevler çalışıyor
  - UI doğru görünüyor
  - Session yönetimi çalışıyor

- [ ] **Edge**
  - Tüm işlevler çalışıyor
  - UI doğru görünüyor
  - Session yönetimi çalışıyor

### Mobil Tarayıcılar

- [ ] **Chrome Mobile**
  - Login formu mobilde kullanılabilir
  - Touch etkileşimleri çalışıyor
  - Responsive tasarım doğru

- [ ] **Safari Mobile**
  - Login formu mobilde kullanılabilir
  - Touch etkileşimleri çalışıyor
  - Responsive tasarım doğru

- [ ] **Samsung Internet**
  - Temel işlevsellik çalışıyor
  - UI uyumlu görünüyor

## 📱 Cihaz Uyumluluğu Testleri

### Masaüstü Cihazlar

- [ ] **Windows PC**
  - Tüm tarayıcılarda çalışıyor
  - Klavye kısayolları çalışıyor
  - Session yönetimi doğru

- [ ] **Mac**
  - Tüm tarayıcılarda çalışıyor
  - Klavye kısayolları çalışıyor
  - Session yönetimi doğru

- [ ] **Linux**
  - Temel tarayıcılarda çalışıyor
  - İşlevsellik korunuyor

### Mobil Cihazlar

- [ ] **iPhone**
  - Safari'de doğru çalışıyor
  - Touch etkileşimleri responsive
  - Ekran boyutlarına uyumlu

- [ ] **Android**
  - Chrome'da doğru çalışıyor
  - Touch etkileşimleri responsive
  - Ekran boyutlarına uyumlu

- [ ] **Tablet**
  - Hem portrait hem landscape modda çalışıyor
  - UI elemanları uygun boyutlarda
  - Touch hedefleri yeterince büyük

## 🔍 Erişilebilirlik Testleri

### Klavye Navigasyonu

- [ ] **Tab sırası**
  - Tab ile form elemanları arasında doğru sırayla geçiş
  - Tüm interaktif elemanlar erişilebilir
  - Skip link'ler çalışıyor (varsa)

- [ ] **Enter/Space tuşları**
  - Enter ile form gönderimi çalışıyor
  - Space ile checkbox/button aktivasyonu çalışıyor

### Ekran Okuyucu Uyumluluğu

- [ ] **Label'lar**
  - Tüm form elemanlarının uygun label'ları var
  - Label'lar ekran okuyucu tarafından okunuyor

- [ ] **Hata mesajları**
  - Hata mesajları ekran okuyucu tarafından duyuruluyor
  - aria-live bölgeleri çalışıyor

- [ ] **Focus yönetimi**
  - Focus görünür ve takip edilebilir
  - Modal/popup açıldığında focus doğru yerde

### Görsel Erişilebilirlik

- [ ] **Renk kontrastı**
  - Text ve background arasında yeterli kontrast
  - Hata durumlarında renk dışında gösterge var

- [ ] **Font boyutu**
  - Text %200 zoom'da okunabilir
  - UI elemanları büyütmede bozulmuyor

## 🚀 Performans Testleri

### Sayfa Yükleme

- [ ] **İlk yükleme**
  - Login sayfası 3 saniye içinde yükleniyor
  - Kritik CSS inline olarak yükleniyor

- [ ] **Sonraki yüklemeler**
  - Cache'lenmiş kaynaklar hızlı yükleniyor
  - Session kontrolü hızlı yapılıyor

### API Yanıt Süreleri

- [ ] **Login API**
  - Login isteği 2 saniye içinde yanıtlanıyor
  - Hata durumlarında da hızlı yanıt

- [ ] **Session kontrolü**
  - Auth status kontrolü 1 saniye içinde
  - CSRF token alımı hızlı

## 🔧 Hata Durumu Testleri

### Ağ Hataları

- [ ] **Bağlantı kesintisi**
  - Ağ kesildiğinde uygun hata mesajı
  - Bağlantı geri geldiğinde otomatik retry

- [ ] **Yavaş bağlantı**
  - Yavaş bağlantıda loading göstergesi
  - Timeout durumunda uygun mesaj

### Sunucu Hataları

- [ ] **500 Internal Server Error**
  - Sunucu hatalarında kullanıcı dostu mesaj
  - Tekrar deneme seçeneği sunuluyor

- [ ] **503 Service Unavailable**
  - Bakım durumunda uygun mesaj
  - Tahmini süre bilgisi (varsa)

## 📋 Test Sonuçları

### Test Ortamı Bilgileri
- **Test Tarihi**: ___________
- **Test Eden**: ___________
- **Tarayıcı**: ___________
- **İşletim Sistemi**: ___________
- **Cihaz**: ___________
- **Test Ortamı URL**: ___________

### Genel Değerlendirme
- **Başarılı Test Sayısı**: _____ / _____
- **Başarısız Test Sayısı**: _____
- **Kritik Hatalar**: _____
- **Küçük Hatalar**: _____
- **Genel Güvenlik Skoru**: _____ / 100

### Test Kategorileri Özeti
- **Temel Kimlik Doğrulama**: _____ / _____
- **Güvenlik Testleri**: _____ / _____
- **Session Yönetimi**: _____ / _____
- **Şifre Değiştirme**: _____ / _____
- **Tarayıcı Uyumluluğu**: _____ / _____
- **Erişilebilirlik**: _____ / _____
- **Performans**: _____ / _____

### Kritik Güvenlik Kontrolleri
- [ ] **HTTPS Kullanımı**: Tüm kimlik doğrulama işlemleri HTTPS üzerinden yapılıyor
- [ ] **Session Güvenliği**: Session cookie'leri Secure ve HttpOnly flag'leri ile korunuyor
- [ ] **CSRF Koruması**: Tüm kritik işlemler CSRF token ile korunuyor
- [ ] **Rate Limiting**: Brute force saldırılarına karşı koruma aktif
- [ ] **Input Validation**: Kötü niyetli girişler doğru şekilde filtreleniyor
- [ ] **Error Handling**: Hata mesajları bilgi sızdırmıyor

### Notlar ve Öneriler
```
[Bu alanda test sırasında karşılaşılan sorunlar, öneriler ve 
ek gözlemler not edilebilir]

Örnek:
- Login sayfası mobilde responsive çalışıyor ancak şifre alanı çok küçük
- Rate limiting 5 denemeden sonra devreye giriyor, beklendiği gibi
- CSRF token'lar her session'da yenileniyor
```

### Güvenlik Açıkları ve Riskler
```
[Tespit edilen güvenlik açıkları ve risk seviyeleri]

Risk Seviyeleri:
- KRITIK: Acil müdahale gerekli
- YÜKSEK: Kısa sürede çözülmeli
- ORTA: Planlı geliştirmede ele alınmalı
- DÜŞÜK: İyileştirme önerisi
```

### Tavsiye Edilen İyileştirmeler
```
[Test sonuçlarına göre önerilen iyileştirmeler]

1. Öncelik sırası ile iyileştirme önerileri
2. Teknik detaylar ve uygulama önerileri
3. Kullanıcı deneyimi iyileştirmeleri
```

---

## 📞 Sorun Bildirimi

Testler sırasında karşılaşılan sorunlar için:

1. **Hata açıklaması**: Sorunun detaylı açıklaması
2. **Tekrar etme adımları**: Sorunu tekrar oluşturmak için gereken adımlar
3. **Beklenen davranış**: Neyin olması gerektiği
4. **Gerçek davranış**: Ne olduğu
5. **Ekran görüntüsü**: Varsa hata ekran görüntüsü
6. **Tarayıcı/cihaz bilgisi**: Test ortamı detayları

Bu bilgiler ile birlikte geliştirici ekibine sorun bildirilebilir.