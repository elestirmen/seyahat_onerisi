# 🚀 Ürgüp POI Öneri Sistemi - Kurulum Kılavuzu

Bu kılavuz, Ürgüp POI Öneri Sistemi'ni yerel makinenizde çalıştırmak için gerekli adımları detaylı olarak açıklar.

## 📋 Sistem Gereksinimleri

### Minimum Gereksinimler
- **İşletim Sistemi**: Windows 10, macOS 10.14, Ubuntu 18.04 veya üzeri
- **Python**: 3.8 veya üzeri
- **RAM**: 2GB (önerilen 4GB)
- **Disk Alanı**: 500MB
- **İnternet Bağlantısı**: Harita ve CDN kaynakları için gerekli

### Desteklenen Tarayıcılar
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔧 Adım Adım Kurulum

### 1. Python Kurulumu Kontrolü

Terminalinizi açın ve Python sürümünüzü kontrol edin:

```bash
python --version
# veya
python3 --version
```

Eğer Python kurulu değilse:
- **Windows**: [python.org](https://python.org) adresinden indirin
- **macOS**: `brew install python3` (Homebrew ile)
- **Ubuntu/Debian**: `sudo apt update && sudo apt install python3 python3-pip`

### 2. Proje Dosyalarını İndirin

```bash
# Git ile klonlama (önerilen)
git clone <repository-url>
cd urgup-poi-recommendation

# Veya ZIP dosyasını indirip açın
```

### 3. Sanal Ortam Oluşturma

Python sanal ortamı oluşturun (önerilen):

```bash
# Sanal ortam oluştur
python -m venv venv

# Sanal ortamı aktifleştir
# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate
```

Sanal ortam aktif olduğunda terminal prompt'unuzda `(venv)` görmelisiniz.

### 4. Bağımlılıkları Yükleme

```bash
# requirements.txt dosyasından yükle
pip install -r requirements.txt

# Veya manuel yükleme
pip install Flask==2.3.3
```

### 5. Proje Yapısını Doğrulama

Proje klasörünüzde şu dosyaların olduğundan emin olun:

```
urgup-poi-recommendation/
├── poi_api.py                    ✓ Flask sunucu dosyası
├── poi_recommendation_system.html ✓ Ana HTML dosyası
├── requirements.txt              ✓ Python bağımlılıkları
├── README.md                     ✓ Proje dokümantasyonu
├── static/
│   ├── css/
│   │   ├── poi_recommendation_system.css ✓
│   │   ├── components.css        ✓
│   │   ├── design-tokens.css     ✓
│   │   ├── layout-system.css     ✓
│   │   └── ux-enhancements.css   ✓
│   └── js/
│       └── poi_recommendation_system.js ✓
├── poi_data/
│   └── urgup_pois.json          ✓ POI veritabanı
└── poi_media/                   ✓ Medya dosyaları klasörü
```

### 6. POI Verilerini Kontrol Etme

`poi_data/urgup_pois.json` dosyasının var olduğundan emin olun:

```bash
# Dosya boyutunu kontrol et
ls -la poi_data/urgup_pois.json

# İçeriği kontrol et (ilk 10 satır)
head -10 poi_data/urgup_pois.json
```

### 7. Sunucuyu Başlatma

```bash
# Ana dizinde sunucuyu başlat
python poi_api.py
```

Başarılı olursa şu mesajları görmelisiniz:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
 * Restarting with stat
 * Debugger is active!
```

### 8. Uygulamayı Test Etme

Tarayıcınızda şu adresi açın:
```
http://localhost:5000
```

Sayfa yüklenirse kurulum başarılıdır! 🎉

## 🔍 Kurulum Sorunları ve Çözümleri

### Yaygın Hatalar

#### 1. "Python command not found"
```bash
# Çözüm: Python PATH'e eklenmemiş
# Windows: Python installer'ı "Add to PATH" seçeneği ile tekrar çalıştırın
# macOS/Linux: .bashrc veya .zshrc dosyasına Python path'i ekleyin
```

#### 2. "pip command not found"
```bash
# Çözüm: pip kurulumu
python -m ensurepip --upgrade
# veya
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python get-pip.py
```

#### 3. "Permission denied" hatası
```bash
# Çözüm: Kullanıcı izinleri ile yükleme
pip install --user -r requirements.txt
```

#### 4. "Port 5000 already in use"
```bash
# Çözüm: Farklı port kullanma
# poi_api.py dosyasında port numarasını değiştirin:
app.run(debug=True, port=5001)
```

#### 5. "POI data not found"
```bash
# Çözüm: POI dosyasını kontrol edin
ls -la poi_data/
# Dosya yoksa örnek veri oluşturun veya projeyi yeniden indirin
```

### Performans Optimizasyonu

#### Geliştirme Ortamı
```bash
# Debug modunu kapatma (production için)
export FLASK_ENV=production
python poi_api.py
```

#### Medya Dosyaları
```bash
# Büyük medya dosyaları için
# poi_media/ klasörünü kontrol edin
du -sh poi_media/
```

## 🌐 Ağ Yapılandırması

### Yerel Ağda Erişim
Diğer cihazlardan erişim için:

```python
# poi_api.py dosyasında
app.run(debug=True, host='0.0.0.0', port=5000)
```

Sonra şu adresi kullanın:
```
http://[YOUR_IP_ADDRESS]:5000
```

### Güvenlik Duvarı Ayarları
- Windows: Windows Defender Firewall'da 5000 portunu açın
- macOS: System Preferences > Security & Privacy > Firewall
- Linux: `sudo ufw allow 5000`

## 📱 Mobil Test

### Yerel Ağda Mobil Test
1. Bilgisayarınızın IP adresini öğrenin:
   ```bash
   # Windows
   ipconfig
   
   # macOS/Linux
   ifconfig
   ```

2. Mobil cihazınızda tarayıcıyı açın:
   ```
   http://[COMPUTER_IP]:5000
   ```

### Responsive Test
Tarayıcıda Developer Tools (F12) açıp mobil görünümü test edin.

## 🔄 Güncelleme

### Proje Güncellemesi
```bash
# Git ile güncelleme
git pull origin main

# Bağımlılıkları güncelleme
pip install -r requirements.txt --upgrade
```

### Veri Güncellemesi
```bash
# POI verilerini yedekleyin
cp poi_data/urgup_pois.json poi_data/urgup_pois_backup.json

# Yeni verileri ekleyin
# poi_data/urgup_pois.json dosyasını düzenleyin
```

## 🚀 Production Deployment

### Gunicorn ile Çalıştırma
```bash
# Gunicorn kurulumu
pip install gunicorn

# Production sunucu
gunicorn -w 4 -b 0.0.0.0:5000 poi_api:app
```

### Nginx Proxy (İsteğe bağlı)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📞 Destek

Kurulum sırasında sorun yaşarsanız:

1. **Log dosyalarını kontrol edin**: Terminal çıktısındaki hata mesajları
2. **GitHub Issues**: Proje sayfasında issue açın
3. **Dokümantasyon**: README.md dosyasını inceleyin

### Debug Bilgileri Toplama
```bash
# Sistem bilgileri
python --version
pip --version
pip list

# Proje durumu
ls -la
cat poi_api.py | head -20
```

---

**Başarılı kurulum sonrası README.md dosyasındaki kullanım kılavuzunu incelemeyi unutmayın!** 🎯