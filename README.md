# 🗺️ Ürgüp Seyahat Öneri Sistemi

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)](https://flask.palletsprojects.com/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.0+-orange.svg)](https://postgis.net/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Ürgüp Seyahat Öneri Sistemi**, Kapadokya bölgesi (özellikle Ürgüp) için geliştirilmiş, kapsamlı bir seyahat planlama ve öneri platformudur. Sistem, turistlerin bölgedeki ilgi çekici noktaları (POI - Points of Interest) keşfetmelerine, kişiselleştirilmiş rotalar oluşturmalarına ve hazır rotaları keşfetmelerine yardımcı olur.

---

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Sistem Gereksinimleri](#-sistem-gereksinimleri)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [Kurulum](#-kurulum)
- [Yapılandırma](#-yapılandırma)
- [Kullanım](#-kullanım)
- [Proje Yapısı](#-proje-yapısı)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Geliştirme](#-geliştirme)
- [Test](#-test)
- [Dağıtım](#-dağıtım)
- [Sorun Giderme](#-sorun-giderme)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)

---

## 🌟 Özellikler

### 🎯 Temel Özellikler

#### POI (Points of Interest) Yönetimi
- **Kapsamlı POI Veritabanı**: Restoranlar, oteller, tarihi yerler, aktiviteler, doğal güzellikler için detaylı veri yönetimi
- **Kategori Sistemi**: 10+ farklı kategori (Tarihi, Sanat & Kültür, Doğa, Eğlence, Alışveriş, Spor, Macera, Rahatlatıcı, Yemek, Gece Hayatı)
- **Medya Yönetimi**: POI'lar için fotoğraf, video ve 360° panorama desteği
- **Değerlendirme Sistemi**: Çok boyutlu rating sistemi (her kategori için ayrı puanlama)
- **Akıllı Öneriler**: Makine öğrenmesi tabanlı kişiselleştirilmiş POI önerileri

#### Rota Planlama
- **Dinamik Rota Oluşturma**: Kullanıcı tercihlerine göre otomatik rota oluşturma
- **Hazır Rotalar**: Uzmanlar tarafından hazırlanmış önceden tanımlı rotalar
- **Kategori Bazlı Planlama**: Belirli kategorilere odaklanmış rotalar (gastronomik, kültürel, doğa, vb.)
- **Yükseklik Profili**: Rota boyunca yükseklik değişimlerini görselleştirme
- **Çoklu Ulaşım Modu**: Yürüyüş, bisiklet, araç rotaları desteği
- **Rota Optimizasyonu**: Mesafe ve süre bazlı otomatik optimizasyon

#### Harita ve Navigasyon
- **OpenStreetMap Entegrasyonu**: Folium ve Leaflet tabanlı interaktif haritalar
- **Çoklu Harita Katmanları**: OpenStreetMap, OpenTopoMap, CartoDB, Satellite görünümleri
- **Gerçek Zamanlı Rota Çizimi**: OSMnx ve NetworkX ile gerçek yürüyüş yolları üzerinden rota hesaplama
- **GPX/KML Desteği**: Rota import/export işlemleri
- **Marker Clustering**: Çok sayıda POI için performanslı görselleştirme
- **360° Panorama Görüntüleme**: Google Model Viewer ile panorama desteği

#### Veritabanı Desteği
- **Çoklu Veritabanı**: JSON (hızlı başlangıç), MongoDB (esnek şema), PostgreSQL + PostGIS (üretim)
- **Coğrafi Sorgular**: PostGIS ile gelişmiş coğrafi veri işleme
- **Performans Optimizasyonu**: İndeksleme, connection pooling, sorgu optimizasyonu
- **Veri Migrasyonu**: Veritabanları arası kolay geçiş araçları

#### Web Teknolojileri
- **RESTful API**: Tam özellikli REST API ile entegrasyon imkanı
- **WebSocket Desteği**: Gerçek zamanlı veri güncellemeleri (Flask-SocketIO)
- **Admin Paneli**: Gelişmiş POI ve rota yönetim arayüzü
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu modern arayüz
- **Performans Optimizasyonları**: Lazy loading, caching, debouncing

### 🤖 AI ve Öneri Sistemi

- **Akıllı POI Önerileri**: Kullanıcı tercihlerine göre normalize edilmiş ağırlıklandırma
- **Yakınlık Ağırlıklandırması**: Konum bazlı mesafe faktörü
- **Kategori Optimizasyonu**: Otomatik kategori sınıflandırması ve eşleştirme
- **Performans Optimizasyonu**: Veritabanı sorgu optimizasyonları ve caching stratejileri

---

## 💻 Sistem Gereksinimleri

### Minimum Gereksinimler
- **Python**: 3.7 veya üzeri
- **RAM**: 4GB (önerilen 8GB+)
- **Disk**: 2GB boş alan
- **İşletim Sistemi**: Linux, macOS, Windows

### Önerilen Gereksinimler (Üretim)
- **Python**: 3.9+
- **RAM**: 8GB+
- **Disk**: 10GB+ (medya dosyaları için)
- **Veritabanı**: PostgreSQL 14+ with PostGIS 3.0+
- **Sunucu**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+

### Sistem Bağımlılıkları

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-dev python3-venv
sudo apt-get install -y libgeos-dev libproj-dev libgdal-dev
sudo apt-get install -y build-essential libssl-dev libffi-dev
sudo apt-get install -y libspatialindex-dev
```

#### CentOS/RHEL
```bash
sudo yum install -y python3-pip python3-devel
sudo yum install -y geos-devel proj-devel gdal-devel
sudo yum install -y gcc openssl-devel libffi-devel
```

#### macOS
```bash
brew install python3 geos proj gdal spatialindex
```

---

## 🚀 Hızlı Başlangıç

### Otomatik Kurulum (Önerilen)

```bash
# Projeyi klonlayın
git clone <repository-url>
cd seyahat_onerisi

# Kurulum scriptini çalıştırın
chmod +x install.sh
./install.sh
```

Kurulum scripti şunları otomatik olarak yapar:
- Sistem bağımlılıklarını kontrol eder ve kurar
- Python sanal ortamı oluşturur
- Python paketlerini kurar
- Veritabanı seçimi ve kurulumu (JSON/MongoDB/PostgreSQL)
- Temel yapılandırmayı oluşturur
- Kurulum testlerini çalıştırır

### Manuel Kurulum

#### 1. Python Sanal Ortamı Oluşturun

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# veya
venv\Scripts\activate     # Windows
```

#### 2. Bağımlılıkları Kurun

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 3. Veritabanını Yapılandırın

**JSON (Hızlı Başlangıç)**
```bash
python setup_poi_database.py json
```

**MongoDB**
```bash
# MongoDB servisini başlatın
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# Veritabanını kurun
python setup_poi_database.py mongodb "mongodb://localhost:27017/" --db-name poi_cappadocia
```

**PostgreSQL + PostGIS (Önerilen)**
```bash
# PostgreSQL ve PostGIS kurulumu
sudo apt-get install postgresql postgresql-contrib postgis postgresql-14-postgis-3

# Veritabanı ve kullanıcı oluşturma
sudo -u postgres psql << EOF
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
ALTER DATABASE poi_db OWNER TO poi_user;
\c poi_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
\q
EOF

# Veritabanını kurun
python setup_poi_database.py postgresql "postgresql://poi_user:your_password@localhost/poi_db"
```

#### 4. Çevre Değişkenlerini Ayarlayın

`.env` dosyası oluşturun:

```bash
# Veritabanı Yapılandırması
POI_DB_TYPE=postgresql  # json, mongodb, postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=your_password
POI_DB_CONNECTION=postgresql://poi_user:your_password@localhost/poi_db

# Flask Yapılandırması
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your_secret_key_here

# Sunucu Yapılandırması
HOST=0.0.0.0
PORT=5505

# Cache Yapılandırması
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300
```

#### 5. Sistemi Başlatın

```bash
# Geliştirme sunucusu
python poi_api.py

# veya WSGI ile
python wsgi.py

# Üretim için Gunicorn
gunicorn -w 4 -b 0.0.0.0:5505 wsgi:application
```

Tarayıcıda açın: `http://localhost:5505/poi_recommendation_system.html`

---

## ⚙️ Yapılandırma

### Veritabanı Seçenekleri

#### JSON Dosyası (Hızlı Başlangıç)
- **Avantajlar**: Kurulum gerektirmez, hızlı başlangıç, taşınabilir
- **Dezavantajlar**: Sınırlı performans, eşzamanlı erişim yok, büyük veri setleri için uygun değil
- **Kullanım**: Küçük projeler, test ortamları, demo

#### MongoDB
- **Avantajlar**: Esnek şema, JSON benzeri veri yapısı, kolay ölçeklenebilirlik
- **Dezavantajlar**: Coğrafi sorgular için ek kurulum gerekir, ACID garantileri sınırlı
- **Kullanım**: Orta ölçekli projeler, hızlı prototipleme

#### PostgreSQL + PostGIS (Önerilen)
- **Avantajlar**: Güçlü coğrafi sorgular, ACID uyumluluğu, yüksek performans, endüstri standardı
- **Dezavantajlar**: Kurulum karmaşıklığı, daha fazla kaynak gereksinimi
- **Kullanım**: Üretim ortamları, büyük projeler, coğrafi veri yoğun uygulamalar

### Flask Yapılandırması

Ana yapılandırma dosyası: `app/config/settings.py`

```python
# Geliştirme ortamı
FLASK_ENV=development
FLASK_DEBUG=True

# Üretim ortamı
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=strong_random_secret_key
```

### Cache Yapılandırması

```python
# Basit cache (geliştirme)
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300

# Redis cache (üretim)
CACHE_TYPE=redis
CACHE_REDIS_URL=redis://localhost:6379/0
CACHE_DEFAULT_TIMEOUT=600
```

---

## 📖 Kullanım

### Web Arayüzü

#### POI Öneri Sistemi
```
http://localhost:5505/poi_recommendation_system.html
```

Özellikler:
- Kategori bazlı POI filtreleme
- Tercih slider'ları ile kişiselleştirilmiş öneriler
- Harita üzerinde POI görselleştirme
- Dinamik rota oluşturma
- POI detay sayfaları

#### Hazır Rotalar
```
http://localhost:5505/predefined_routes.html
```

Özellikler:
- Önceden hazırlanmış rotaları görüntüleme
- Rota filtreleme (tip, zorluk, süre)
- Rota detayları ve yükseklik profili
- Google Maps entegrasyonu
- GPX/GeoJSON export

#### Admin Paneli
```
http://localhost:5505/poi_manager_ui.html
```

Özellikler:
- POI ekleme/düzenleme/silme
- Medya yönetimi (fotoğraf, video, panorama)
- Rota oluşturma ve düzenleme
- Kategori yönetimi
- Veritabanı yedekleme

### Komut Satırı Araçları

#### Rota Planlayıcı

**Temel Kullanım**
```bash
# Tüm kategorilerde rota oluştur
python category_route_planner.py

# Belirli kategoride rota oluştur
python category_route_planner.py gastronomik
python category_route_planner.py kulturel
python category_route_planner.py dogal

# Başlangıç noktası belirle
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Maksimum mesafe belirle (km)
python category_route_planner.py aktivite --radius 5

# Yükseklik verilerini dahil et
python category_route_planner.py dogal --elevation

# Çıktı formatını belirle
python category_route_planner.py gastronomik -o rota.html
```

**Gelişmiş Seçenekler**
```bash
# Yardım menüsü
python category_route_planner.py --help

# Detaylı çıktı
python category_route_planner.py --verbose

# Belirli saat aralığında planla
python category_route_planner.py --time-start "09:00" --time-end "18:00"

# Bütçe sınırı ekle
python category_route_planner.py --max-budget 500

# Minimum POI sayısı
python category_route_planner.py --min-pois 5
```

### API Kullanımı

#### POI Endpoints

```bash
# Tüm POI'ları listele
curl http://localhost:5505/api/pois

# Belirli POI detayı
curl http://localhost:5505/api/pois/{poi_id}

# Kategoriye göre filtrele
curl http://localhost:5505/api/pois?category=gastronomik

# Konum bazlı arama
curl "http://localhost:5505/api/pois?lat=38.642&lng=34.831&radius=5"

# POI oluştur (admin)
curl -X POST http://localhost:5505/api/pois \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Yeni Restoran",
    "category": "gastronomik",
    "latitude": 38.642,
    "longitude": 34.831,
    "description": "Açıklama"
  }'

# POI güncelle (admin)
curl -X PUT http://localhost:5505/api/pois/{poi_id} \
  -H "Content-Type: application/json" \
  -d '{"name": "Güncellenmiş İsim"}'

# POI sil (admin)
curl -X DELETE http://localhost:5505/api/pois/{poi_id}
```

#### Rota Endpoints

```bash
# Tüm rotaları listele
curl http://localhost:5505/api/routes

# Belirli rota detayı
curl http://localhost:5505/api/routes/{route_id}

# Dinamik rota oluştur
curl -X POST http://localhost:5505/api/route/smart \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "yemek": 8,
      "tarihi": 6,
      "doga": 4
    },
    "start_location": {"latitude": 38.642, "longitude": 34.831},
    "max_distance": 10
  }'

# Yürüyüş rotası hesapla
curl -X POST http://localhost:5505/api/route/walking \
  -H "Content-Type: application/json" \
  -d '{
    "start": {"lat": 38.642, "lng": 34.831},
    "end": {"lat": 38.650, "lng": 34.840}
  }'
```

#### Öneri Sistemi

```bash
# POI önerileri al
curl -X POST http://localhost:5505/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "tarihi": 9,
      "sanat_kultur": 7,
      "doga": 5,
      "yemek": 8
    },
    "location": {
      "latitude": 38.642,
      "longitude": 34.831
    },
    "limit": 20
  }'
```

#### Medya Yönetimi

```bash
# Fotoğraf yükle
curl -X POST http://localhost:5505/api/pois/{poi_id}/media \
  -F "file=@photo.jpg"

# Çoklu fotoğraf yükle
curl -X POST http://localhost:5505/api/pois/{poi_id}/media \
  -F "files[]=@photo1.jpg" \
  -F "files[]=@photo2.jpg"

# Video yükle
curl -X POST http://localhost:5505/api/pois/{poi_id}/media \
  -F "file=@video.mp4" \
  -F "media_type=video"
```

---

## 📁 Proje Yapısı

```
seyahat_onerisi/
├── 📋 requirements.txt              # Python bağımlılıkları
├── 🐍 poi_api.py                   # Ana Flask uygulaması (legacy routes)
├── 🐍 wsgi.py                      # WSGI entry point
├── 🐍 category_route_planner.py    # Komut satırı rota planlayıcı
├── 🐍 poi_database_adapter.py      # Veritabanı adaptörü
├── 🐍 route_service.py            # Rota servis katmanı
├── 🐍 route_file_parser.py         # GPX/KML dosya işleyici
├── 🐍 poi_media_manager.py        # Medya yönetim sistemi
├── 🐍 elevation_service.py        # Yükseklik servisleri
├── 🐍 auth_middleware.py          # Kimlik doğrulama sistemi
│
├── 📁 app/                         # Modüler uygulama yapısı
│   ├── __init__.py                # Flask app factory
│   ├── 📁 config/                 # Yapılandırma
│   │   ├── __init__.py
│   │   ├── settings.py            # Ana ayarlar
│   │   └── database.py           # Veritabanı yapılandırması
│   ├── 📁 routes/                # API route'ları
│   │   ├── __init__.py
│   │   ├── poi.py                # POI endpoints
│   │   ├── route.py              # Rota endpoints
│   │   └── route_import.py       # Rota import endpoints
│   ├── 📁 services/              # İş mantığı katmanı
│   │   ├── __init__.py
│   │   ├── poi_service.py       # POI iş mantığı
│   │   ├── route_service.py     # Rota iş mantığı
│   │   ├── media_service.py      # Medya iş mantığı
│   │   ├── auth_service.py       # Kimlik doğrulama
│   │   └── route_planning_service.py  # Rota planlama
│   ├── 📁 middleware/           # Middleware'ler
│   │   ├── __init__.py
│   │   └── error_handler.py     # Hata yönetimi
│   └── 📁 utils/                 # Yardımcı fonksiyonlar
│
├── 📁 static/                     # Statik dosyalar
│   ├── 📁 css/                   # Stil dosyaları
│   │   ├── poi_recommendation_system.css
│   │   ├── predefined_routes.css
│   │   └── 📁 poi-tabs/          # Sekme stilleri
│   ├── 📁 js/                    # JavaScript dosyaları
│   │   ├── poi_recommendation_system.js
│   │   ├── predefined_routes.js
│   │   └── 📁 poi-tabs/          # Sekme JavaScript'leri
│   └── 📁 config/                # Yapılandırma dosyaları
│
├── 📁 templates/                  # HTML şablonları (varsa)
│
├── 📁 poi_media/                 # POI medya dosyaları
│   ├── 📁 images/                # Fotoğraflar
│   ├── 📁 videos/                # Videolar
│   └── 📁 by_panorama/           # 360° panoramalar
│
├── 📁 cache/                      # Cache dosyaları
│
├── 📁 tests/                      # Test dosyaları
│   ├── conftest.py               # pytest yapılandırması
│   ├── run_all.py                # Tüm testleri çalıştır
│   └── 📁 api/                   # API testleri
│       ├── test_pois.py
│       ├── test_routes.py
│       └── test_admin.py
│
├── 📁 scripts/                    # Yardımcı scriptler
│   ├── install.sh                # Otomatik kurulum
│   ├── start_poi_api.sh          # Sunucu başlatma
│   └── backup_poi_ratings.py     # Yedekleme scriptleri
│
├── 📁 perf/                       # Performans testleri
│
├── 📁 .env                        # Çevre değişkenleri (gitignore)
├── 📖 README.md                   # Bu dosya
└── 📖 PROJE_DOKUMANTASYONU.md    # Detaylı dokümantasyon
```

### Ana Dosyalar Açıklaması

- **`poi_api.py`**: Ana Flask uygulaması, legacy route'lar ve tüm endpoint'ler
- **`wsgi.py`**: Üretim için WSGI entry point, modüler app factory kullanır
- **`app/__init__.py`**: Flask app factory, modüler yapı için
- **`category_route_planner.py`**: Komut satırı rota planlama aracı
- **`poi_database_adapter.py`**: Çoklu veritabanı desteği için adaptör
- **`route_service.py`**: Rota hesaplama ve optimizasyon servisleri

---

## 📚 API Dokümantasyonu

### Temel Endpoint'ler

#### POI Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/pois` | Tüm POI'ları listele | Hayır |
| GET | `/api/pois/{id}` | POI detayı | Hayır |
| POST | `/api/pois` | Yeni POI oluştur | Evet |
| PUT | `/api/pois/{id}` | POI güncelle | Evet |
| DELETE | `/api/pois/{id}` | POI sil | Evet |
| GET | `/api/pois/{id}/media` | POI medya listesi | Hayır |
| POST | `/api/pois/{id}/media` | Medya yükle | Evet |

#### Rota Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/routes` | Tüm rotaları listele | Hayır |
| GET | `/api/routes/{id}` | Rota detayı | Hayır |
| POST | `/api/route/smart` | Akıllı rota oluştur | Hayır |
| POST | `/api/route/walking` | Yürüyüş rotası hesapla | Hayır |
| GET | `/api/routes/{id}/geometry` | Rota geometrisi | Hayır |

#### Öneri Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| POST | `/api/recommendations` | POI önerileri al | Hayır |

### Detaylı API Dokümantasyonu

Detaylı API dokümantasyonu için:
- **Swagger/OpenAPI**: Sistem içinde otomatik olarak oluşturulur
- **Postman Collection**: `docs/postman_collection.json` (varsa)
- **Detaylı Dokümantasyon**: `PROJE_DOKUMANTASYONU.md` dosyasına bakın

---

## 🛠️ Geliştirme

### Geliştirme Ortamı Kurulumu

```bash
# Projeyi klonlayın
git clone <repository-url>
cd seyahat_onerisi

# Sanal ortam oluşturun
python3 -m venv venv
source venv/bin/activate

# Geliştirme bağımlılıklarını kurun
pip install -r requirements.txt

# Geliştirme modunda çalıştırın
export FLASK_ENV=development
export FLASK_DEBUG=True
python poi_api.py
```

### Kod Standartları

- **Python**: PEP 8 standartlarına uygun
- **JavaScript**: ESLint kurallarına uygun (varsa)
- **CSS**: BEM metodolojisi kullanılır
- **Git**: Conventional Commits formatı

### Yeni Özellik Ekleme

1. **Feature Branch Oluşturun**
```bash
git checkout -b feature/yeni-ozellik
```

2. **Değişiklikleri Yapın**
   - Modüler yapıyı koruyun (`app/` klasörü)
   - Test yazın
   - Dokümantasyonu güncelleyin

3. **Test Edin**
```bash
python -m pytest tests/
```

4. **Commit ve Push**
```bash
git add .
git commit -m "feat: yeni özellik eklendi"
git push origin feature/yeni-ozellik
```

5. **Pull Request Oluşturun**

### Veritabanı Migrasyonları

```bash
# Yeni migrasyon oluştur
python database_migration.py create migration_name

# Migrasyonu uygula
python database_migration.py upgrade

# Migrasyonu geri al
python database_migration.py downgrade
```

---

## 🧪 Test

### Test Çalıştırma

```bash
# Tüm testleri çalıştır
python run_all_tests.py

# veya pytest ile
python -m pytest tests/

# Belirli test dosyası
python -m pytest tests/api/test_pois.py

# Belirli test fonksiyonu
python -m pytest tests/api/test_pois.py::test_get_poi_by_id

# Coverage raporu ile
python -m pytest --cov=app tests/
```

### Test Kapsamı

- **API Testleri**: Endpoint fonksiyonalitesi, request/response doğrulama
- **Entegrasyon Testleri**: Sistem bileşenleri arası etkileşim
- **Performans Testleri**: Yük testleri, sorgu optimizasyonu
- **Frontend Testleri**: Kullanıcı arayüzü testleri (manuel)

### Test Veritabanı

Testler için ayrı bir veritabanı kullanılır:
```bash
export POI_DB_NAME=poi_test_db
export FLASK_ENV=testing
```

---

## 🚀 Dağıtım

### Geliştirme Sunucusu

```bash
python poi_api.py
# veya
python wsgi.py
```

### Üretim Sunucusu (Gunicorn)

```bash
# Gunicorn kurulumu
pip install gunicorn

# Çalıştırma
gunicorn -w 4 -b 0.0.0.0:5505 wsgi:application

# veya systemd service ile
sudo systemctl start poi-api
```

### Docker ile Dağıtım

**Dockerfile** (örnek):
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    libgeos-dev libproj-dev libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Python bağımlılıkları
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyaları
COPY . .

# Port
EXPOSE 5505

# Çalıştırma
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5505", "wsgi:application"]
```

**Docker Compose** (örnek):
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5505:5505"
    environment:
      - POI_DB_TYPE=postgresql
      - POI_DB_CONNECTION=postgresql://poi_user:password@db/poi_db
    depends_on:
      - db

  db:
    image: postgis/postgis:14-3.2
    environment:
      - POSTGRES_DB=poi_db
      - POSTGRES_USER=poi_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5505;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static {
        alias /path/to/seyahat_onerisi/static;
        expires 30d;
    }
}
```

---

## 🐛 Sorun Giderme

### Yaygın Sorunlar

#### 1. Veritabanı Bağlantı Hatası

**Belirtiler**: `Connection refused`, `Authentication failed`

**Çözüm**:
```bash
# Bağlantı bilgilerini kontrol et
python -c "from poi_database_adapter import test_connection; test_connection()"

# PostgreSQL servisini kontrol et
sudo systemctl status postgresql

# MongoDB servisini kontrol et
sudo systemctl status mongod

# Bağlantı string'ini kontrol et
echo $POI_DB_CONNECTION
```

#### 2. Python Bağımlılık Hataları

**Belirtiler**: `ModuleNotFoundError`, `ImportError`

**Çözüm**:
```bash
# Sanal ortamı kontrol et
which python  # venv içinde olmalı

# Sanal ortamı yeniden oluştur
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 3. Port Çakışması

**Belirtiler**: `Address already in use`

**Çözüm**:
```bash
# Kullanılan portları kontrol et
sudo netstat -tulpn | grep :5505
# veya
sudo lsof -i :5505

# Farklı port kullan
export PORT=5506
python poi_api.py
```

#### 4. PostGIS Uzantı Hatası

**Belirtiler**: `Extension postgis does not exist`

**Çözüm**:
```bash
sudo -u postgres psql -d poi_db << EOF
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
\q
EOF
```

#### 5. Medya Yükleme Hatası

**Belirtiler**: `Permission denied`, `File too large`

**Çözüm**:
```bash
# Klasör izinlerini kontrol et
ls -la poi_media/

# İzinleri düzelt
chmod -R 755 poi_media/
chown -R www-data:www-data poi_media/  # web sunucu kullanıcısı
```

### Log Dosyaları

```bash
# Uygulama logları
tail -f api.log

# Flask debug logları (geliştirme modunda)
# Konsol çıktısında görünür

# Sistem logları
journalctl -u poi-api -f  # systemd service için
```

### Performans Sorunları

```bash
# Veritabanı sorgu analizi
python check_db_schema.py

# Performans testleri çalıştır
python -m pytest perf/

# Cache durumunu kontrol et
ls -lh cache/
```

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen şu adımları izleyin:

1. **Projeyi Fork Edin**
2. **Feature Branch Oluşturun** (`git checkout -b feature/AmazingFeature`)
3. **Değişikliklerinizi Commit Edin** (`git commit -m 'feat: Add some AmazingFeature'`)
4. **Branch'inizi Push Edin** (`git push origin feature/AmazingFeature`)
5. **Pull Request Açın**

### Katkı Kuralları

- Kod standartlarına uyun (PEP 8, ESLint)
- Test yazın (yeni özellikler için)
- Dokümantasyonu güncelleyin
- Commit mesajlarını açıklayıcı yazın
- Pull request'lerde değişiklikleri açıklayın

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 👥 Geliştirici Ekibi

- **Ana Geliştirici**: [İsim](mailto:email@example.com)
- **UI/UX Tasarım**: [İsim](mailto:email@example.com)
- **Veritabanı Uzmanı**: [İsim](mailto:email@example.com)

---

## 🙏 Teşekkürler

- [OpenStreetMap](https://www.openstreetmap.org/) - Harita verileri için
- [Folium](https://python-visualization.github.io/folium/) - Harita görselleştirme için
- [PostGIS](https://postgis.net/) - Coğrafi veritabanı desteği için
- [Leaflet](https://leafletjs.com/) - İnteraktif haritalar için
- [OSMnx](https://osmnx.readthedocs.io/) - OpenStreetMap veri işleme için
- [NetworkX](https://networkx.org/) - Graf algoritmaları için

---

## 📞 İletişim ve Destek

- **E-posta**: support@urgup-seyahat.com
- **GitHub**: [Proje Sayfası](https://github.com/username/seyahat_onerisi)
- **Dokümantasyon**: [Wiki](https://github.com/username/seyahat_onerisi/wiki)
- **Issues**: [GitHub Issues](https://github.com/username/seyahat_onerisi/issues)

---

## 📈 Proje Durumu

**Aktif Geliştirme** 🚀

- ✅ Temel POI yönetimi
- ✅ Rota planlama
- ✅ Harita entegrasyonu
- ✅ API endpoints
- 🔄 Performans optimizasyonları
- 🔄 Mobil uygulama entegrasyonu
- 📋 Gelecek özellikler: Çoklu dil desteği, Offline mod, Sosyal özellikler

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!
