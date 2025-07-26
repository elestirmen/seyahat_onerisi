# POI Yönetim Sistemi - Kimlik Doğrulama Yapılandırması

Bu belge, POI yönetim sisteminin kimlik doğrulama özelliklerini yapılandırmak için gerekli çevre değişkenlerini ve kurulum adımlarını açıklar.

## Çevre Değişkenleri

### Temel Kimlik Doğrulama Ayarları

#### `POI_ADMIN_PASSWORD_HASH` (Zorunlu)
- **Açıklama**: Yönetici şifresinin bcrypt hash'i
- **Varsayılan**: Otomatik oluşturulan rastgele şifre hash'i
- **Örnek**: `$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.F5e`
- **Oluşturma**: `python generate_password_hash.py` komutu ile oluşturulabilir

#### `POI_SESSION_SECRET_KEY` (Zorunlu)
- **Açıklama**: Oturum şifreleme için kullanılan gizli anahtar
- **Varsayılan**: Otomatik oluşturulan 64 karakter hex string
- **Örnek**: `a1b2c3d4e5f6...` (64 karakter)
- **Güvenlik**: Üretim ortamında mutlaka değiştirilmeli

### Oturum Yönetimi Ayarları

#### `POI_SESSION_TIMEOUT` (İsteğe Bağlı)
- **Açıklama**: Normal oturum süresi (saniye)
- **Varsayılan**: `7200` (2 saat)
- **Minimum**: `300` (5 dakika)
- **Maksimum**: `86400` (24 saat)

#### `POI_REMEMBER_TIMEOUT` (İsteğe Bağlı)
- **Açıklama**: "Beni Hatırla" seçeneği ile oturum süresi (saniye)
- **Varsayılan**: `604800` (7 gün)
- **Minimum**: `3600` (1 saat)
- **Maksimum**: `2592000` (30 gün)

#### `POI_SESSION_SECURE` (İsteğe Bağlı)
- **Açıklama**: Güvenli çerezler kullanılsın mı (HTTPS gerektirir)
- **Varsayılan**: `True`
- **Değerler**: `True` veya `False`
- **Not**: Üretim ortamında `True` olmalı

### Güvenlik Ayarları

#### `POI_MAX_LOGIN_ATTEMPTS` (İsteğe Bağlı)
- **Açıklama**: Maksimum başarısız giriş denemesi sayısı
- **Varsayılan**: `5`
- **Minimum**: `3`
- **Maksimum**: `10`

#### `POI_LOCKOUT_DURATION` (İsteğe Bağlı)
- **Açıklama**: Hesap kilitleme süresi (saniye)
- **Varsayılan**: `900` (15 dakika)
- **Minimum**: `300` (5 dakika)
- **Maksimum**: `3600` (1 saat)

#### `POI_BCRYPT_ROUNDS` (İsteğe Bağlı)
- **Açıklama**: Bcrypt hash algoritması için round sayısı
- **Varsayılan**: `12`
- **Minimum**: `10`
- **Maksimum**: `15`
- **Not**: Yüksek değerler daha güvenli ama daha yavaş

## Kurulum Adımları

### 1. Çevre Değişkenleri Dosyası Oluşturma

```bash
# .env.example dosyasını kopyalayın
cp .env.example .env

# Dosyayı düzenleyin
nano .env
```

### 2. Yönetici Şifresi Oluşturma

#### Seçenek A: İnteraktif Şifre Girişi
```bash
python generate_password_hash.py
```

#### Seçenek B: Rastgele Güvenli Şifre Oluşturma
```bash
python generate_password_hash.py --random
```

#### Seçenek C: Özel Ayarlarla Şifre Oluşturma
```bash
# 20 karakter rastgele şifre, 14 round bcrypt
python generate_password_hash.py --random --length 20 --rounds 14
```

### 3. Otomatik Kurulum Scripti Kullanma

```bash
# Tam otomatik kurulum
python setup_authentication.py --auto

# İnteraktif kurulum
python setup_authentication.py --interactive

# Mevcut yapılandırmayı doğrulama
python setup_authentication.py --validate
```

## Güvenlik Önerileri

### Şifre Güvenliği
- Minimum 8 karakter uzunluğunda olmalı
- En az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermeli
- Sözlükte bulunan kelimeler kullanılmamalı
- Kişisel bilgiler (isim, doğum tarihi vb.) içermemeli

### Çevre Değişkenleri Güvenliği
- `.env` dosyası asla version control sistemine eklenmemeli
- Dosya izinleri `600` (sadece sahip okuyabilir) olarak ayarlanmalı
- Üretim ortamında çevre değişkenleri sistem seviyesinde tanımlanmalı

### Oturum Güvenliği
- HTTPS kullanılmalı (`POI_SESSION_SECURE=True`)
- Oturum süreleri ihtiyaca göre ayarlanmalı
- Paylaşılan bilgisayarlarda "Beni Hatırla" seçeneği kullanılmamalı

## Sorun Giderme

### Yaygın Hatalar

#### "Invalid password hash" Hatası
```bash
# Şifre hash'ini yeniden oluşturun
python generate_password_hash.py
# Çıktıyı .env dosyasına ekleyin
```

#### "Session secret key not found" Hatası
```bash
# Gizli anahtar oluşturun
python -c "import secrets; print('POI_SESSION_SECRET_KEY=' + secrets.token_hex(32))"
# Çıktıyı .env dosyasına ekleyin
```

#### "Configuration validation failed" Hatası
```bash
# Yapılandırmayı doğrulayın
python setup_authentication.py --validate
# Hataları düzeltin ve tekrar deneyin
```

### Log Dosyaları
- Kimlik doğrulama hataları `api.log` dosyasında kaydedilir
- Güvenlik olayları sistem log'larında izlenebilir

### Performans Optimizasyonu
- `POI_BCRYPT_ROUNDS` değerini sunucu performansına göre ayarlayın
- Yüksek trafik durumunda oturum süresini kısaltın
- Redis gibi harici oturum depolama kullanmayı düşünün

## Güncelleme ve Bakım

### Şifre Değiştirme
1. Yeni şifre hash'i oluşturun: `python generate_password_hash.py`
2. `.env` dosyasındaki `POI_ADMIN_PASSWORD_HASH` değerini güncelleyin
3. Uygulamayı yeniden başlatın

### Güvenlik Güncellemeleri
- Düzenli olarak bcrypt rounds sayısını artırın
- Oturum sürelerini güvenlik politikalarına göre güncelleyin
- Gizli anahtarları periyodik olarak yenileyin

### Yedekleme
- `.env` dosyasını güvenli bir yerde yedekleyin
- Şifre hash'lerini ayrı bir güvenli konumda saklayın
- Kurtarma prosedürlerini test edin