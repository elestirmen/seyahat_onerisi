# ⚡ Kapadokya POI Sistemi - Hızlı Başlatma

## 🚀 3 Farklı Kurulum Seçeneği

### 🎯 Seçenek 1: Süper Hızlı Başlangıç (JSON ile - 2 dakika)
```bash
# 1. Temel paketleri kurun
pip install folium osmnx networkx numpy requests

# 2. Hemen çalıştırın
python category_route_planner.py gastronomik

# 3. Sonucu açın: tum_kategoriler_rotasi.html
```

### 💾 Seçenek 2: MongoDB ile POI Yönetimi (5 dakika)

#### Sistem Gereksinimleri
- Python 3.7+
- MongoDB Community Server

#### Kurulum Adımları
```bash
# 1. Tüm bağımlılıkları kurun
pip install -r requirements.txt

# 2. MongoDB'yi kurun ve başlatın
# Ubuntu/Debian:
sudo apt-get install mongodb
sudo systemctl start mongodb

# macOS (Homebrew):
brew install mongodb-community
brew services start mongodb-community

# Windows: MongoDB Community Server'ı indirin ve kurun

# 3. Çevre değişkenlerini ayarlayın
export POI_DB_TYPE=mongodb
export POI_DB_CONNECTION=mongodb://localhost:27017/
export POI_DB_NAME=poi_cappadocia

# 4. Veritabanını hazırlayın
python setup_poi_database.py mongodb "mongodb://localhost:27017/" --db-name poi_cappadocia

# 5. API'yi başlatın
python poi_api.py

# 6. Web arayüzünü açın
# Tarayıcıda: http://localhost:5505/poi_manager_ui.html
```

### 🐘 Seçenek 3: PostgreSQL + PostGIS ile Gelişmiş Özellikler (10 dakika)

#### Sistem Gereksinimleri
- Python 3.7+
- PostgreSQL 12+ 
- PostGIS extension

#### Kurulum Adımları
```bash
# 1. PostgreSQL ve PostGIS kurun
# Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib postgis
sudo systemctl start postgresql

# macOS (Homebrew):
brew install postgresql postgis
brew services start postgresql

# 2. Veritabanı oluşturun
sudo -u postgres psql
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
CREATE EXTENSION postgis;
\q

# 3. Python bağımlılıklarını kurun
pip install -r requirements.txt

# 4. Çevre değişkenlerini ayarlayın
export POI_DB_TYPE=postgresql
export POI_DB_CONNECTION=postgresql://poi_user:your_password@localhost/poi_db

# 5. Veritabanını hazırlayın
python setup_poi_database.py postgresql "postgresql://poi_user:your_password@localhost/poi_db"

# 6. API'yi başlatın
python poi_api.py

# 7. Web arayüzünü açın
# Tarayıcıda: http://localhost:5505/poi_manager_ui.html
```

---

## 🎯 Hızlı Testler

### Rota Planlama Testleri
```bash
# Belirli kategori için rota
python category_route_planner.py gastronomik

# Başlangıç noktası ile
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Optimizasyon olmadan
python category_route_planner.py --no-optimize

# Yükseklik verisi olmadan (hızlı)
python category_route_planner.py --no-elevation

# Küçük yarıçap ile hızlı test
python category_route_planner.py gastronomik --radius 2
```

### POI Yönetimi Testleri (API ile)
```bash
# 1. POI Ekle: Haritaya çift tıklayın → Formu doldurun → Kaydet
# 2. POI Düzenle: Tabloda ✏️ butonuna tıklayın  
# 3. POI Sil: Tabloda 🗑️ butonuna tıklayın
# 4. Arama: Üst taraftaki arama kutusunu kullanın
# 5. Kategori Filtreleme: Sol menüden kategori seçin
```

### API Endpoint Testleri
```bash
# Sağlık kontrolü
curl http://localhost:5505/health

# Tüm POI'leri listele
curl http://localhost:5505/api/pois

# Kategori bazlı POI'ler
curl http://localhost:5505/api/pois?category=gastronomik

# Konum bazlı arama
curl "http://localhost:5505/api/pois/nearby?lat=38.633&lng=34.911&radius=1000"
```

---

## ❌ Hızlı Sorun Çözme

### Yaygın Sorunlar

**🔴 API başlamıyor?**
```bash
# Port kontrolü
netstat -an | grep 5505
lsof -i :5505

# Manuel port değiştirme
export FLASK_PORT=5506
python poi_api.py
```

**🔴 MongoDB bağlantı hatası?**
```bash
# Servis kontrolü
sudo systemctl status mongodb
# veya macOS için:
brew services list | grep mongo

# Bağlantı testi
mongo --eval "db.runCommand('ping')"
python -c "from pymongo import MongoClient; print(MongoClient().admin.command('ping'))"
```

**🔴 PostgreSQL bağlantı hatası?**
```bash
# Servis kontrolü
sudo systemctl status postgresql

# Bağlantı testi
psql -h localhost -U poi_user -d poi_db -c "SELECT version();"
```

**🔴 OSMnx/Folium kurulum hatası?**
```bash
# Sistem paketlerini kurun
# Ubuntu/Debian:
sudo apt-get install libgeos-dev libproj-dev libgdal-dev

# macOS:
brew install geos proj gdal

# Sonra Python paketlerini tekrar kurun
pip install --force-reinstall osmnx folium
```

**🔴 Harita görünmüyor?**
```bash
# İnternet bağlantısı kontrolü
ping openstreetmap.org

# Tarayıcı konsolu kontrolü (F12)
# JavaScript hatalarını kontrol edin

# Cache temizleme
rm -rf cache/*
```

**🔴 Bellek hatası (büyük veri setleri)?**
```bash
# Küçük yarıçap ile test
python category_route_planner.py --radius 1

# Yükseklik verilerini devre dışı bırak
python category_route_planner.py --no-elevation

# Cache temizle
rm -rf cache/*
```

### Performans İpuçları

**⚡ Hızlandırma:**
```bash
# Cache klasörünü saklayın (tekrar kullanım için)
ls cache/  # Bu dosyalar offline çalışmayı hızlandırır

# Küçük yarıçap kullanın
python category_route_planner.py --radius 3

# Optimizasyonu devre dışı bırakın (hızlı test için)
python category_route_planner.py --no-optimize

# Yükseklik verilerini atlayın
python category_route_planner.py --no-elevation
```

### Log Kontrolü

```bash
# Python hata logları
python category_route_planner.py 2>&1 | tee logs.txt

# API logları
python poi_api.py 2>&1 | tee api_logs.txt

# Veritabanı bağlantı logları
export POI_DB_DEBUG=1
python poi_api.py
```

---

## 🔧 Geliştirici Modları

### Debug Modu
```bash
# API debug modu
export FLASK_DEBUG=1
python poi_api.py

# Verbose logging
export POI_LOG_LEVEL=DEBUG
python category_route_planner.py
```

### Test Verileri ile Çalışma
```bash
# Test verileri ile API başlatma
export POI_USE_TEST_DATA=1
python poi_api.py

# Örnek veri yükleme
python setup_poi_database.py --load-sample-data
```

### Cache Yönetimi
```bash
# Cache istatistikleri
ls -la cache/ | wc -l
du -sh cache/

# Cache temizleme
rm -rf cache/*

# Belirli cache temizleme
rm cache/elevation_*.json
```

---

## 📋 Sistem Gereksinimleri Kontrolü

```bash
# Python versiyonu
python3 --version  # 3.7+ gerekli

# Paket kontrolü
pip list | grep -E "(folium|osmnx|flask|pymongo|psycopg2)"

# Sistem paketleri (Ubuntu/Debian)
dpkg -l | grep -E "(libgeos|libproj|libgdal)"

# Bellek kontrolü
free -h  # En az 4GB RAM önerilir

# Disk alanı kontrolü
df -h  # En az 2GB boş alan gerekli
```

---

## 🚀 Önerilen Kurulum Sırası

### Yeni Kullanıcılar İçin:
1. **JSON ile başlayın** (Seçenek 1) - En hızlı
2. **MongoDB** ile devam edin (Seçenek 2) - Orta seviye
3. **PostgreSQL** ile ilerleyin (Seçenek 3) - Gelişmiş

### Geliştiriciler İçin:
1. **Sanal ortam** oluşturun
2. **Tüm bağımlılıkları** kurun
3. **PostgreSQL** ile başlayın
4. **Git hooks** ve **linting** araçları ekleyin

---

**Detaylı rehber için:** `README.md` dosyasını okuyun.

**Sorun yaşarsanız:** GitHub Issues bölümünden destek alabilirsiniz.

**Hemen başlayın! 🎉**