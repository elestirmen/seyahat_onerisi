# POI Yönetim Sistemi - Admin Şifre Bilgileri

## 🔐 Mevcut Admin Şifresi

**Şifre**: `AdminPass123!`

**Hash**: `$2b$12$HRVDZox699A5NvSfWq8zpOUYYqr9hcJuh3iictQ/FuESOqoVH7uO6`

## 📋 Şifre Özellikleri

- ✅ **Uzunluk**: 12 karakter (minimum 8 karakter gereksinimi karşılanıyor)
- ✅ **Büyük harf**: A (Admin)
- ✅ **Küçük harf**: dmin, ass
- ✅ **Rakam**: 123
- ✅ **Özel karakter**: ! (ünlem işareti)
- ✅ **Güvenlik**: Bcrypt ile 12 round hash'lenmiş

## 🔧 Yapılandırma Dosyaları

### Geliştirme Ortamı (.env)
```bash
POI_ADMIN_PASSWORD_HASH=$2b$12$HRVDZox699A5NvSfWq8zpOUYYqr9hcJuh3iictQ/FuESOqoVH7uO6
POI_SESSION_SECURE=False
DEBUG=True
```

### Üretim Ortamı (.env.production)
```bash
POI_ADMIN_PASSWORD_HASH=$2b$12$HRVDZox699A5NvSfWq8zpOUYYqr9hcJuh3iictQ/FuESOqoVH7uO6
POI_SESSION_SECURE=True
DEBUG=False
```

## 🚀 Kullanım

### Web Arayüzü ile Giriş
1. Tarayıcıda `/auth/login` sayfasına git
2. Şifre alanına `AdminPass123!` yaz
3. "Giriş Yap" butonuna tıkla

### API ile Giriş
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "AdminPass123!", "remember_me": false}'
```

### Python ile Test
```python
import requests
import json

response = requests.post('http://localhost:8000/auth/login', 
                        json={'password': 'AdminPass123!', 'remember_me': False})
print(response.json())
```

## 🔄 Şifre Değiştirme

### Yeni Şifre Oluşturma
```bash
# İnteraktif şifre girişi
python generate_password_hash.py

# Rastgele güvenli şifre
python generate_password_hash.py --random
```

### Manuel Hash Oluşturma
```python
import bcrypt

password = "YeniSifre123!"
hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
print(f"New hash: {hash.decode('utf-8')}")
```

## ⚠️ Güvenlik Notları

### Güvenli Saklama
- Bu dosyayı güvenli bir yerde sakla
- Şifreyi başkalarıyla paylaşma
- Üretim ortamında farklı bir şifre kullan

### Şifre Değiştirme Önerileri
- Düzenli olarak şifre değiştir (3-6 ayda bir)
- Daha karmaşık şifreler kullan
- Şifre yöneticisi kullanmayı düşün

### Güvenlik Kontrolleri
- ✅ Brute force koruması aktif (5 deneme sonrası kilitleme)
- ✅ Session timeout aktif (2 saat)
- ✅ CSRF koruması aktif
- ✅ Güvenli cookie ayarları (üretimde)

## 🆘 Sorun Giderme

### "Invalid password" Hatası
1. Şifrenin doğru yazıldığından emin ol: `AdminPass123!`
2. Caps Lock'un kapalı olduğunu kontrol et
3. Özel karakterin doğru olduğunu kontrol et (ünlem işareti: !)

### "Account locked" Hatası
1. 15 dakika bekle (lockout süresi)
2. Veya sunucuyu yeniden başlat
3. Veya failed_attempts cache'ini temizle

### Hash Doğrulama
```python
import bcrypt
password = "AdminPass123!"
hash = "$2b$12$HRVDZox699A5NvSfWq8zpOUYYqr9hcJuh3iictQ/FuESOqoVH7uO6"
result = bcrypt.checkpw(password.encode('utf-8'), hash.encode('utf-8'))
print(f"Verification: {result}")  # Should be True
```

---

**Son Güncelleme**: 26 Temmuz 2025
**Oluşturan**: Kiro AI Assistant
**Durum**: ✅ Aktif ve Test Edildi