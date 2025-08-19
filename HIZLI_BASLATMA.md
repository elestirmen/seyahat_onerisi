# 🚀 Kapadokya POI Sistemi - Hızlı Başlangıç Rehberi

Bu rehber, Kapadokya POI Sistemini 5 dakikada çalışır hale getirmenizi sağlar.

## ⚡ 5 Dakikada Kurulum

### 1️⃣ Gereksinimleri Kontrol Edin
```bash
# Python versiyonunu kontrol edin
python3 --version  # 3.7+ olmalı

# Git'in kurulu olduğunu kontrol edin
git --version
```

### 2️⃣ Projeyi İndirin
```bash
# Projeyi klonlayın
git clone <repository-url>
cd kapadokya-poi-sistemi

# Kurulum scriptini çalıştırın
chmod +x install.sh
./install.sh
```

### 3️⃣ Sistemi Başlatın
```bash
# Sanal ortamı aktifleştirin
source venv/bin/activate

# Rota planlayıcıyı çalıştırın
python category_route_planner.py gastronomik
```

### 4️⃣ Tarayıcıda Açın
```
http://localhost:5000
```

## 🎯 Hızlı Test

### Basit Rota Oluşturma
```bash
# Gastronomik rota
python category_route_planner.py gastronomik --radius 3

# Kültürel rota
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Doğa rota
python category_route_planner.py doga --elevation
```

### POI API Testi
```bash
# API'yi başlat
python poi_api.py

# Test endpoint'i
curl http://localhost:5505/health
```

## 🔧 Temel Yapılandırma

### .env Dosyası (Opsiyonel)
```bash
# .env dosyası oluşturun
cat > .env << EOF
POI_DB_TYPE=json
FLASK_DEBUG=True
EOF
```

### Veritabanı Seçimi
```bash
# JSON (hızlı başlangıç)
python setup_poi_database.py json

# PostgreSQL (üretim için)
python setup_poi_database.py postgresql "postgresql://user:pass@localhost/db"
```

## 📱 Hızlı Kullanım

### Web Arayüzü
- **Ana Sayfa**: `http://localhost:5000`
- **POI Yöneticisi**: `http://localhost:5505/poi_manager_ui.html`
- **Rota Yöneticisi**: `http://localhost:5505/route_manager_ui.html`

### Komut Satırı
```bash
# Yardım
python category_route_planner.py --help

# Tüm kategoriler
python category_route_planner.py

# Belirli kategori
python category_route_planner.py gastronomik

# Özel parametreler
python category_route_planner.py kulturel --start "Ürgüp" --radius 5
```

## 🚨 Sorun Giderme

### Yaygın Hatalar
```bash
# Port çakışması
python poi_api.py --port 5001

# Bağımlılık hatası
pip install -r requirements.txt --force-reinstall

# Veritabanı hatası
python setup_poi_database.py json
```

### Log Kontrolü
```bash
# Hata logları
tail -f logs/error.log

# Debug logları
tail -f logs/debug.log
```

## 📚 Sonraki Adımlar

1. **Detaylı README**: `README.md` dosyasını okuyun
2. **API Dokümantasyonu**: `openapi.yaml` dosyasını inceleyin
3. **Test Çalıştırma**: `python run_all_tests.py`
4. **Özelleştirme**: Kendi POI verilerinizi ekleyin

## 🆘 Yardım

- **GitHub Issues**: [Proje Issues](https://github.com/username/kapadokya-poi-sistemi/issues)
- **Dokümantasyon**: `README.md` dosyası
- **E-posta**: support@kapadokya-poi.com

---

**Not**: Bu hızlı başlangıç rehberi temel kurulum içindir. Detaylı bilgi için ana README.md dosyasını inceleyin.