# 🗺️ Ürgüp Seyahat Öneri Sistemi

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)](https://flask.palletsprojects.com/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.0+-orange.svg)](https://postgis.net/)
[![License](https://img.shields.io/badge/License-TBD-lightgrey.svg)](#lisans)

**Ürgüp Seyahat Öneri Sistemi**, Kapadokya bölgesi (özellikle Ürgüp) için geliştirilmiş kapsamlı bir seyahat planlama ve öneri platformudur. Sistem, turistlerin bölgedeki ilgi çekici noktaları (POI - Points of Interest) keşfetmelerine, kişiselleştirilmiş rotalar oluşturmalarına ve hazır rotaları keşfetmelerine yardımcı olur.

**Versiyon**: 2.2.0  
**Son Güncelleme**: Aralık 2025

---

## 📋 İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Sistem Gereksinimleri](#2-sistem-gereksinimleri)
3. [Kurulum Rehberi](#3-kurulum-rehberi)
4. [Yapılandırma](#4-yapılandırma)
5. [Kullanıcı Kılavuzu](#5-kullanıcı-kılavuzu)
6. [Yazılımcı Dokümantasyonu](#6-yazılımcı-dokümantasyonu)
7. [API Dokümantasyonu](#7-api-dokümantasyonu)
8. [Veritabanı Yapısı](#8-veritabanı-yapısı)
9. [Geliştirme Rehberi](#9-geliştirme-rehberi)
10. [Sorun Giderme](#10-sorun-giderme)
11. [Dağıtım ve Bakım](#11-dağıtım-ve-bakım)

---

## 1. Genel Bakış

### 1.1 Proje Hakkında

**Ürgüp Seyahat Öneri Sistemi**, Kapadokya bölgesi (özellikle Ürgüp) için geliştirilmiş kapsamlı bir seyahat planlama ve öneri platformudur. Sistem, turistlerin bölgedeki ilgi çekici noktaları (POI - Points of Interest) keşfetmelerine, kişiselleştirilmiş rotalar oluşturmalarına ve hazır rotaları keşfetmelerine yardımcı olur.

### 1.2 Ana Özellikler

#### 🎯 POI (Points of Interest) Yönetimi
- **Kapsamlı POI Veritabanı**: Restoranlar, oteller, tarihi yerler, aktiviteler, doğal güzellikler için detaylı veri yönetimi
- **Kategori Sistemi**: 10+ farklı kategori (Tarihi, Sanat & Kültür, Doğa, Eğlence, Alışveriş, Spor, Macera, Rahatlatıcı, Yemek, Gece Hayatı)
- **Medya Yönetimi**: POI'lar için fotoğraf, video ve 360° panorama desteği
- **Değerlendirme Sistemi**: Çok boyutlu rating sistemi (her kategori için ayrı puanlama)
- **Akıllı Öneriler**: Makine öğrenmesi tabanlı kişiselleştirilmiş POI önerileri
- **Gelişmiş Arama**: Türkçe karakter desteği ile tam metin arama

#### 🗺️ Rota Planlama
- **Dinamik Rota Oluşturma**: Kullanıcı tercihlerine göre otomatik rota oluşturma
- **Hazır Rotalar**: Uzmanlar tarafından hazırlanmış önceden tanımlı rotalar
- **Kategori Bazlı Planlama**: Belirli kategorilere odaklanmış rotalar (gastronomik, kültürel, doğa, vb.)
- **Yükseklik Profili**: Rota boyunca yükseklik değişimlerini görselleştirme
- **Çoklu Ulaşım Modu**: Yürüyüş, bisiklet, araç rotaları desteği
- **Rota Optimizasyonu**: Mesafe ve süre bazlı otomatik optimizasyon
- **Rota İçe Aktarma**: GPX, KML, KMZ dosya formatları desteği

#### 🗺️ Harita ve Navigasyon
- **OpenStreetMap Entegrasyonu**: Folium ve Leaflet tabanlı interaktif haritalar
- **Çoklu Harita Katmanları**: OpenStreetMap, OpenTopoMap, CartoDB, Satellite görünümleri
- **Gerçek Zamanlı Rota Çizimi**: OSMnx ve NetworkX ile gerçek yürüyüş yolları üzerinden rota hesaplama
- **GPX/KML Desteği**: Rota import/export işlemleri
- **Marker Clustering**: Çok sayıda POI için performanslı görselleştirme
- **360° Panorama Görüntüleme**: Google Model Viewer ile panorama desteği

#### 🗄️ Veritabanı Desteği
- **PostgreSQL + PostGIS**: Güçlü coğrafi veri işleme ve sorgulama
- **Coğrafi Sorgular**: PostGIS ile gelişmiş coğrafi veri işleme
- **Performans Optimizasyonu**: İndeksleme, connection pooling, sorgu optimizasyonu
- **Veri Migrasyonu**: Veritabanları arası kolay geçiş araçları

#### 🌐 Web Teknolojileri
- **RESTful API**: Tam özellikli REST API ile entegrasyon imkanı
- **WebSocket Desteği**: Gerçek zamanlı veri güncellemeleri (Flask-SocketIO)
- **Admin Paneli**: Gelişmiş POI ve rota yönetim arayüzü
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu modern arayüz
- **Performans Optimizasyonları**: Lazy loading, caching, debouncing
- **Modüler Mimari**: Flask App Factory pattern ile temiz kod yapısı

#### 🤖 AI ve Öneri Sistemi
- **Akıllı POI Önerileri**: Kullanıcı tercihlerine göre normalize edilmiş ağırlıklandırma
- **Yakınlık Ağırlıklandırması**: Konum bazlı mesafe faktörü
- **Kategori Optimizasyonu**: Otomatik kategori sınıflandırması ve eşleştirme
- **Performans Optimizasyonu**: Veritabanı sorgu optimizasyonları ve caching stratejileri

#### 🔐 Güvenlik ve Kimlik Doğrulama
- **Session Yönetimi**: Flask-Session ile güvenli oturum yönetimi
- **Admin Kimlik Doğrulama**: Bcrypt ile şifre hashleme
- **Rate Limiting**: API endpoint'leri için rate limiting koruması
- **CORS Yapılandırması**: Esnek CORS ayarları

### 1.3 Sistem Mimarisi

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Flask Backend │    │   PostgreSQL    │
│   (HTML/CSS/JS) │◄──►│   (Python)      │◄──►│   + PostGIS     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────┴────────┐             │
         │              │                 │             │
         └──────────────┼─────────────────┼─────────────┘
                    ┌───▼───┐      ┌──────▼──────┐
                    │ Media │      │   Cache    │
                    │ Files │      │  (Optional)│
                    └───────┘      └────────────┘
```

### 1.4 Web Arayüzleri

Sistem aşağıdaki web sayfalarını içerir:

- **`poi_recommendation_system.html`**: Ana sayfa - POI önerileri ve rota planlama
- **`personal_routes.html`**: Kişiselleştirilmiş rota oluşturma arayüzü
- **`predefined_routes.html`**: Hazır rotaları görüntüleme ve filtreleme
- **`poi_manager_ui.html`**: POI yönetim paneli (admin)
- **`poi_manager_enhanced.html`**: Gelişmiş POI yönetim paneli
- **`route_manager_enhanced.html`**: Rota yönetim paneli (admin)
- **`file_import_manager.html`**: Rota dosyası içe aktarma arayüzü

---

## 2. Sistem Gereksinimleri

### 2.1 Minimum Gereksinimler
- **İşletim Sistemi**: Linux (Ubuntu 18.04+), macOS (10.14+), Windows 10+
- **Python**: 3.12
- **RAM**: 4GB (önerilen 8GB+)
- **Disk**: 2GB boş alan
- **İnternet**: Kurulum sırasında gerekli

### 2.2 Önerilen Gereksinimler (Üretim)
- **İşletim Sistemi**: Ubuntu 20.04 LTS, macOS 11+, Windows 11
- **Python**: 3.12
- **RAM**: 16GB+
- **Disk**: SSD, 10GB+ boş alan
- **CPU**: 4+ çekirdek
- **Veritabanı**: PostgreSQL 14+ with PostGIS 3.0+
- **Sunucu**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+

### 2.3 Sistem Bağımlılıkları

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-dev python3-venv
sudo apt-get install -y libgeos-dev libproj-dev libgdal-dev
sudo apt-get install -y build-essential libssl-dev libffi-dev
sudo apt-get install -y libspatialindex-dev postgresql postgresql-contrib postgis
```

#### CentOS/RHEL
```bash
sudo yum install -y python3-pip python3-devel
sudo yum install -y geos-devel proj-devel gdal-devel
sudo yum install -y gcc openssl-devel libffi-devel
sudo yum install -y postgresql-server postgresql-contrib postgis
```

#### macOS
```bash
brew install python3 geos proj gdal spatialindex
brew install postgresql postgis
```

#### Windows (WSL)
```bash
# WSL'de Ubuntu kurun
wsl --install Ubuntu
# Sonra Ubuntu komutlarını kullanın
```

### 2.4 Python Bağımlılıkları

Ana bağımlılıklar (`requirements.txt`):
```
Flask==2.3.3
Werkzeug==2.3.7
flask-cors==6.0.1
Flask-Session==0.8.0
Flask-SocketIO==5.5.1
folium==0.20.0
networkx==3.5
numpy==2.3.2
osmnx==2.0.5
Pillow==11.3.0
psycopg2==2.9.10
python-dotenv==1.1.1
bcrypt==4.2.0
requests==2.32.4
scikit-learn==1.7.1
```

---

## 3. Kurulum Rehberi

### 3.1 Otomatik Kurulum (Önerilen)

#### Linux/macOS
```bash
# Projeyi klonlayın
git clone <repository-url>
cd seyahat_onerisi

# Kurulum scriptini çalıştırılabilir yapın
chmod +x install.sh

# Kurulumu başlatın
./install.sh
```

Kurulum scripti şunları otomatik olarak yapar:
- Sistem bağımlılıklarını kontrol eder ve kurar
- Python sanal ortamı oluşturur
- Python paketlerini kurar
- Veritabanı seçimi ve kurulumu (PostgreSQL)
- Temel yapılandırmayı oluşturur
- Kurulum testlerini çalıştırır

### 3.2 Manuel Kurulum

#### Adım 1: Python Sanal Ortamı Oluşturun
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# veya
venv\Scripts\activate     # Windows
```

#### Adım 2: Bağımlılıkları Kurun
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### Adım 3: Veritabanını Yapılandırın

**PostgreSQL + PostGIS Kurulumu**

Ubuntu/Debian:
```bash
# PostgreSQL ve PostGIS kurun
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-14-postgis-3

# Servisi başlatın
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

macOS:
```bash
brew install postgresql postgis
brew services start postgresql
```

Veritabanını yapılandırın:
```bash
# PostgreSQL'e bağlanın
sudo -u postgres psql

# Veritabanı ve kullanıcı oluşturun
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
ALTER DATABASE poi_db OWNER TO poi_user;

# PostGIS uzantısını ekleyin
\c poi_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

# Çıkın
\q
```

Veritabanı şemasını oluşturun:
```bash
python setup_basic_tables.py
```

#### Adım 4: Çevre Değişkenlerini Ayarlayın

`.env` dosyası oluşturun:
```bash
# Veritabanı Yapılandırması
POI_DB_TYPE=postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=your_secure_password
POI_DB_CONNECTION=postgresql://poi_user:your_secure_password@localhost/poi_db

# Flask Yapılandırması
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your_secret_key_here

# Sunucu Yapılandırması
HOST=0.0.0.0
PORT=5560

# Admin Yetkilendirme (tek token)
# Not: Üretimde `POI_ADMIN_TOKEN` zorunludur (min 16 karakter).
POI_ADMIN_TOKEN=your_long_random_token_here

# Cache Yapılandırması
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300

# Medya Yapılandırması
MAX_CONTENT_LENGTH=16777216
UPLOAD_FOLDER=temp_uploads
POI_MEDIA_FOLDER=poi_media
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,mp4,mov,avi
```

Güçlü token oluşturma:
```bash
# Python ile
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### Adım 5: Sistemi Başlatın
```bash
# Makefile ile (önerilen)
make setup

# Legacy web arayüzü + legacy API (poi_api.py) — varsayılan port: 5560
make run-web

# Modüler API (wsgi.py) — varsayılan port: 5000 (5560 için PORT=5560 verin)
PORT=5560 make run-api

# (İsterseniz manuel da çalıştırabilirsiniz)
# Web arayüzü + legacy API (poi_api.py)
python poi_api.py

# Sadece API (modüler yapı / wsgi.py)
PORT=5560 python wsgi.py

# Üretim için Gunicorn (modüler)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5560 wsgi:application
```

Web arayüzü (poi_api.py): `http://localhost:5560/poi_recommendation_system.html`  
Health check (wsgi.py veya poi_api.py): `http://localhost:5560/health`

### 3.3 Kurulum Testi

#### Sistem Testi
```bash
# Python versiyonunu kontrol edin
python3 --version

# Sanal ortamı kontrol edin
which python
which pip

# Bağımlılıkları kontrol edin
pip list
```

#### Veritabanı Testi
```bash
# Bağlantıyı test edin
python -c "from poi_database_adapter import POIDatabaseFactory; db = POIDatabaseFactory.create(); db.connect(); print('✅ Bağlantı başarılı'); db.disconnect()"

# Veritabanı şemasını kontrol edin
python check_db_constraints.py
```

#### Uygulama Testi
```bash
# (Önerilen) Birleştirilmiş test koşucusu
make validate
make test
make contract

# Smoke testleri çalıştırın
python smoke_test.py

# Health check endpoint'i test edin
curl http://localhost:5560/health

# API testi
python -c "from app import create_app; app = create_app(); print('✅ Uygulama yüklenebiliyor')"
```

---

## 4. Yapılandırma

### 4.1 Veritabanı Yapılandırması

Sistem PostgreSQL + PostGIS kullanır. Veritabanı bağlantı bilgileri `.env` dosyasında veya ortam değişkenlerinde tanımlanır.

```bash
POI_DB_TYPE=postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=your_password
POI_DB_CONNECTION=postgresql://poi_user:password@localhost/poi_db
```

### 4.2 Flask Yapılandırması

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

### 4.3 Cache Yapılandırması

```python
# Basit cache (geliştirme)
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300

# Redis cache (üretim)
CACHE_TYPE=redis
CACHE_REDIS_URL=redis://localhost:6379/0
CACHE_DEFAULT_TIMEOUT=600
```

### 4.4 Harita Yapılandırması

```bash
# Harita Yapılandırması
DEFAULT_MAP_CENTER_LAT=38.6322
DEFAULT_MAP_CENTER_LON=34.9115
DEFAULT_MAP_ZOOM=13
```

### 4.5 Güvenlik Ayarları

```bash
# Güvenlik
SESSION_LIFETIME=86400  # 24 saat
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
```

Dosya izinleri:
```bash
# Hassas dosyaları koruyun
chmod 600 .env
chmod 600 app/config/settings.py

# Medya klasörlerini yapılandırın
chmod 755 poi_media/
chmod 755 temp_uploads/
```

---

## 5. Kullanıcı Kılavuzu

### 5.1 Sistem Erişimi

#### Ana Arayüzler
- **Ana Sayfa / POI Öneri Sistemi**: `http://localhost:5560/poi_recommendation_system.html`
- **Keşfedilecek Yerler**: `http://localhost:5560/personal_routes.html`
- **Hazır Rotalar**: `http://localhost:5560/predefined_routes.html`
- **Admin Paneli**: `http://localhost:5560/poi_manager_ui.html`
- **Rota Yönetimi**: `http://localhost:5560/route_manager_enhanced.html`
- **Dosya İçe Aktarma**: `http://localhost:5560/file_import_manager.html`

### 5.2 POI Keşfi ve Önerileri

#### Adım 1: Ana Sayfaya Erişim
1. Tarayıcınızda `http://localhost:5560/poi_recommendation_system.html` adresini açın
2. Sistem otomatik olarak haritayı yükler ve Ürgüp bölgesini gösterir

#### Adım 2: Konum İzinleri
1. Tarayıcınız konum izni isteyecektir
2. "İzin Ver" butonuna tıklayın
3. Sistem mevcut konumunuzu haritada gösterecektir

#### Adım 3: İlgi Alanlarınızı Seçin
1. Sol panelde "Tercihler" bölümünü bulun
2. İlgilendiğiniz kategoriler için slider'ları ayarlayın:
   - **Tarihi**: Tarihi yerler ve müzeler
   - **Sanat & Kültür**: Sanat galerileri ve kültürel etkinlikler
   - **Doğa**: Doğal güzellikler ve parklar
   - **Eğlence**: Eğlence mekanları ve aktiviteler
   - **Alışveriş**: Alışveriş merkezleri ve çarşılar
   - **Spor**: Spor aktiviteleri ve tesisler
   - **Macera**: Macera sporları ve aktiviteler
   - **Rahatlatıcı**: Spa, hamam ve dinlenme yerleri
   - **Yemek**: Restoranlar ve kafeler
   - **Gece Hayatı**: Barlar ve gece kulüpleri

#### Adım 4: POI'leri Keşfedin
1. Slider'ları ayarladıktan sonra sistem otomatik olarak size uygun POI'leri önerecektir
2. Harita üzerinde renkli marker'lar görünecektir
3. Her marker bir POI'yi temsil eder
4. Marker'ın üzerine tıklayarak POI detaylarını görebilirsiniz

#### Adım 5: POI Detaylarını İnceleyin
POI detay penceresinde şunları görebilirsiniz:
- POI adı ve kategorisi
- Kısa açıklama
- Fotoğraflar (varsa)
- Konum bilgisi
- Değerlendirme puanları
- "Haritada Göster" butonu
- "Rotaya Ekle" butonu

### 5.3 Dinamik Rota Oluşturma

#### Adım 1: POI'leri Seçin
1. Harita üzerinde ilginizi çeken POI'leri tıklayın
2. Her POI için "Rotaya Ekle" butonuna tıklayın
3. Seçilen POI'ler sağ panelde listelenecektir

#### Adım 2: Rota Tercihlerini Belirleyin
1. "Rota Oluştur" butonuna tıklayın
2. Rota tercihleri penceresi açılacaktır:
   - **Rota Tipi**: Yürüyüş, Bisiklet, Araç
   - **Maksimum Mesafe**: Rota uzunluğu sınırı (km)
   - **Optimizasyon**: Mesafe veya Süre

#### Adım 3: Rotayı Görüntüleyin
1. "Rota Oluştur" butonuna tıklayın
2. Sistem otomatik olarak en uygun rotayı hesaplayacaktır
3. Harita üzerinde mavi çizgi ile rota gösterilecektir
4. Rota bilgileri:
   - Toplam mesafe (km)
   - Tahmini süre (dakika)
   - Yükseklik profili grafiği
   - Rota üzerindeki POI'ler

#### Adım 4: Rotayı Dışa Aktarın
1. Rota oluşturulduktan sonra "Dışa Aktar" butonuna tıklayın
2. Format seçenekleri:
   - **GPX**: GPS cihazları için
   - **KML**: Google Earth için
   - **GeoJSON**: Harita uygulamaları için

### 5.4 Hazır Rotaları Kullanma

#### Adım 1: Hazır Rotalar Sayfasına Gidin
1. Ana sayfada "Hazır Rotalar" sekmesine tıklayın
2. Veya doğrudan `http://localhost:5560/predefined_routes.html` adresine gidin

#### Adım 2: Rotaları Filtreleyin
Sol panelde filtreleme seçenekleri:
- **Rota Tipi**: Yürüyüş, Doğa Yürüyüşü, Bisiklet, Araç
- **Zorluk Seviyesi**: 1 (Kolay) - 5 (Çok Zor)
- **Süre**: Minimum ve maksimum süre (dakika)
- **Mesafe**: Minimum ve maksimum mesafe (km)
- **Kategori**: Tarihi, Kültürel, Doğa, vb.

#### Adım 3: Rota Detaylarını İnceleyin
1. Bir rota kartına tıklayın
2. Rota detay penceresi açılacaktır:
   - Rota adı ve açıklaması
   - Rota bilgileri (mesafe, süre, zorluk)
   - Yükseklik profili grafiği
   - Rota üzerindeki POI'ler
   - Fotoğraflar
   - Harita görünümü

#### Adım 4: Rotayı Haritada Görüntüleyin
1. Rota detay penceresinde "Haritada Göster" butonuna tıklayın
2. Harita üzerinde rota çizgisi ve POI'ler gösterilecektir
3. Harita kontrolleri:
   - **Yakınlaştır/Uzaklaştır**: Mouse tekerleği veya +/- butonları
   - **Katman Değiştir**: Harita tipini değiştir (Normal, Uydu, Topografik)
   - **Tam Ekran**: Tam ekran moduna geç

#### Adım 5: Rotayı Dışa Aktarın
1. Rota detay penceresinde "Dışa Aktar" butonuna tıklayın
2. Format seçin (GPX, KML, GeoJSON)
3. Dosya otomatik olarak indirilecektir

### 5.5 Admin Paneli Kullanımı

#### Giriş Yapma
1. `http://localhost:5560/auth/login` adresine gidin
2. Admin kullanıcı adı ve şifresi ile giriş yapın
3. Giriş başarılı olduktan sonra admin paneline yönlendirileceksiniz

#### POI Yönetimi
1. `http://localhost:5560/poi_manager_ui.html` veya `poi_manager_enhanced.html` adresine gidin
2. POI ekleme, düzenleme, silme işlemlerini yapabilirsiniz
3. POI'lere medya dosyaları (fotoğraf, video) yükleyebilirsiniz
4. POI rating'lerini yönetebilirsiniz

#### Rota Yönetimi
1. `http://localhost:5560/route_manager_enhanced.html` adresine gidin
2. Yeni rota oluşturabilir, mevcut rotaları düzenleyebilirsiniz
3. Rota dosyalarını (GPX, KML) içe aktarabilirsiniz
4. Rota medya dosyalarını yönetebilirsiniz

### 5.6 Mobil Kullanım

Sistem responsive tasarımla mobil cihazlarda da tam fonksiyonel çalışır:

#### Mobil Özellikler
- **Dokunmatik Optimizasyonları**: Tüm kontroller dokunmatik ekranlar için optimize edilmiştir
- **Mobil Harita Kontrolleri**: Harita üzerinde kolay navigasyon
- **Dokunmatik-Friendly UI**: Büyük butonlar ve kolay erişilebilir menüler
- **Çevrimdışı Harita Desteği**: Bazı harita katmanları çevrimdışı çalışabilir

#### Mobil Kullanım İpuçları
1. **Konum İzinleri**: Mobil cihazınızda konum izinlerini açın
2. **Yatay Mod**: Harita görüntüleme için yatay modu kullanın
3. **Veri Kullanımı**: Harita verileri internet bağlantısı gerektirir
4. **Pil Tasarrufu**: GPS kullanımı pil tüketimini artırabilir

### 5.7 İpuçları ve Püf Noktaları

#### POI Keşfi İpuçları
- **Tercih Slider'ları**: Daha spesifik sonuçlar için slider'ları ayarlayın
- **Kategori Kombinasyonları**: Birden fazla kategoriyi birleştirerek daha zengin sonuçlar alın
- **Harita Yakınlaştırma**: Belirli bir bölgeye odaklanmak için haritayı yakınlaştırın
- **POI Filtreleme**: Sol paneldeki filtreleri kullanarak POI'leri daraltın

#### Rota Oluşturma İpuçları
- **POI Sıralaması**: Önemli POI'leri önce seçin
- **Mesafe Sınırı**: Uzun rotalar için maksimum mesafe belirleyin
- **Rota Optimizasyonu**: Mesafe optimizasyonu daha kısa rotalar, süre optimizasyonu daha hızlı rotalar verir
- **Yükseklik Profili**: Zorlu rotalar için yükseklik profiline bakın

#### Hazır Rotalar İpuçları
- **Zorluk Seviyesi**: Fiziksel durumunuza uygun zorluk seviyesi seçin
- **Süre Planlaması**: Rota süresini günlük planınıza göre ayarlayın
- **Mevsim Uygunluğu**: Bazı rotalar belirli mevsimlerde daha uygun olabilir
- **Hava Durumu**: Dış mekan rotaları için hava durumunu kontrol edin

---

## 6. Yazılımcı Dokümantasyonu

### 6.1 Proje Yapısı

```
seyahat_onerisi/
├── 📋 requirements.txt              # Python bağımlılıkları
├── 🐚 install.sh                   # Otomatik kurulum
├── 🐍 poi_api.py                   # Ana Flask uygulaması (legacy routes)
├── 🐍 wsgi.py                      # WSGI entry point (modüler yapı)
├── 🐍 category_route_planner_with_db.py # Komut satırı rota planlayıcı
├── 🐍 poi_database_adapter.py      # Veritabanı adaptörü
├── 🐍 route_service.py            # Rota servis katmanı (legacy)
├── 🐍 route_file_parser.py         # GPX/KML dosya işleyici
├── 🐍 poi_media_manager.py        # Medya yönetim sistemi (legacy)
├── 🐍 elevation_service.py        # Yükseklik servisleri
├── 🐍 auth_middleware.py          # Kimlik doğrulama sistemi
├── 🐍 session_config.py           # Session yapılandırması
├── 🐍 smoke_test.py               # Smoke test scripti
│
├── 📁 app/                         # Modüler uygulama yapısı
│   ├── __init__.py                # Flask app factory
│   ├── 📁 config/                 # Yapılandırma
│   │   ├── __init__.py
│   │   ├── settings.py            # Ana ayarlar
│   │   └── database.py             # Veritabanı yapılandırması
│   ├── 📁 routes/                 # API route'ları
│   │   ├── __init__.py
│   │   ├── poi.py                 # POI endpoints
│   │   ├── route.py                # Rota endpoints
│   │   ├── route_import.py        # Rota import endpoints
│   │   ├── auth.py                # Kimlik doğrulama endpoints
│   │   └── health.py              # Health check endpoint
│   ├── 📁 services/               # İş mantığı katmanı
│   │   ├── __init__.py
│   │   ├── poi_service.py         # POI iş mantığı
│   │   ├── route_service.py       # Rota iş mantığı
│   │   ├── route_planning_service.py  # Rota planlama
│   │   ├── route_import_service.py   # Rota içe aktarma
│   │   ├── media_service.py       # Medya iş mantığı
│   │   └── auth_service.py        # Kimlik doğrulama
│   ├── 📁 middleware/             # Middleware'ler
│   │   ├── __init__.py
│   │   └── error_handler.py       # Hata yönetimi
│   └── 📁 utils/                  # Yardımcı fonksiyonlar
│
├── 📁 static/                     # Statik dosyalar
│   ├── 📁 css/                    # Stil dosyaları
│   │   ├── poi_recommendation_system.css
│   │   ├── predefined_routes.css
│   │   └── 📁 poi-tabs/           # Sekme stilleri
│   ├── 📁 js/                     # JavaScript dosyaları
│   │   ├── poi_recommendation_system.js
│   │   ├── predefined_routes.js
│   │   └── 📁 poi-tabs/           # Sekme JavaScript'leri
│   └── 📁 config/                  # Yapılandırma dosyaları
│
├── 📁 templates/                  # HTML şablonları (varsa)
│
├── 📁 poi_media/                 # POI medya dosyaları
│   ├── 📁 images/                # Fotoğraflar
│   ├── 📁 videos/                # Videolar
│   └── 📁 by_panorama/           # 360° panoramalar
│
├── 📁 temp_uploads/              # Geçici yükleme dosyaları
│
├── 📁 cache/                      # Cache dosyaları
│
├── 📁 tests/                      # Test dosyaları
│   ├── conftest.py               # pytest yapılandırması
│   ├── smoke.py                  # Smoke testleri
│   └── 📁 api/                   # API testleri
│
├── 📁 scripts/                    # Yardımcı scriptler
│   ├── backup_poi_ratings.py     # Yedekleme scriptleri
│   ├── bench.sh                  # Basit benchmark
│   └── restore_safe_delete.sh    # Güvenli geri yükleme
│
├── 📁 .env                        # Çevre değişkenleri (gitignore)
└── 📖 README.md                   # Bu dosya
```

### 6.2 Ana Dosyalar Açıklaması

- **`poi_api.py`**: Ana Flask uygulaması, legacy route'lar ve tüm endpoint'ler
- **`wsgi.py`**: Üretim için WSGI entry point, modüler app factory kullanır
- **`app/__init__.py`**: Flask app factory, modüler yapı için
- **`app/config/settings.py`**: Ortam bazlı yapılandırma yönetimi
- **`category_route_planner_with_db.py`**: Komut satırı rota planlama aracı
- **`poi_database_adapter.py`**: Veritabanı adaptörü (PostgreSQL/PostGIS)
- **`route_service.py`**: Rota hesaplama ve optimizasyon servisleri (legacy)
- **`app/services/route_service.py`**: Modüler rota servisi
- **`poi_media_manager.py`**: Medya yönetim sistemi (legacy)
- **`app/services/media_service.py`**: Modüler medya servisi
- **`auth_middleware.py`**: Kimlik doğrulama middleware'i
- **`smoke_test.py`**: Sistem smoke testleri

### 6.3 Kod Standartları

#### Python Kodlama Standartları
- **PEP 8** uyumluluğu
- **Type hints** kullanımı
- **Docstring** formatı: Google style
- **Exception handling**: Özel exception sınıfları
- **Logging**: Structured logging

#### JavaScript Kodlama Standartları
- **ES6+** özellikler
- **Async/await** kullanımı
- **Modüler yapı**: ES6 modules
- **Error handling**: Try-catch blocks
- **DOM manipulation**: Modern API'ler

#### CSS/SCSS Standartları
- **BEM metodolojisi**
- **CSS Variables** kullanımı
- **Responsive design** ilkeleri
- **Performance optimization**

### 6.4 Modüler Mimari

Sistem Flask App Factory pattern kullanarak modüler bir yapıya sahiptir:

```python
# app/__init__.py
def create_app(config_name=None):
    app = Flask(__name__)
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Middleware'leri başlat
    configure_session(app)
    auth_middleware.init_app(app)
    
    # Blueprint'leri kaydet
    register_blueprints(app)
    
    return app
```

Bu yapı sayesinde:
- Test edilebilirlik artar
- Kod organizasyonu iyileşir
- Farklı ortamlar için farklı yapılandırmalar kullanılabilir
- Kod tekrarı azalır

---

## 7. API Dokümantasyonu

### 7.1 Temel Endpoint'ler
> Not: Bu repo iki farklı çalıştırma modu içerir: `poi_api.py` (web arayüzü + legacy API) ve `wsgi.py` (modüler API). Modüler API çekirdek CRUD + rota import + admin rota yönetimi uçlarını hedefler; `/api/route/*` ve `/api/recommendations` gibi gelişmiş uçlar legacy modda bulunur.

#### Health Check

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/health` | Sistem sağlık kontrolü | Hayır |

**Örnek:**
```bash
curl http://localhost:5560/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-01T10:00:00Z",
  "database": {
    "status": "healthy",
    "type": "postgresql"
  }
}
```

#### POI Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/pois` | Tüm POI'ları listele | Hayır |
| GET | `/api/poi/{id}` | POI detayı | Hayır |
| GET | `/api/search?q={query}` | POI arama | Hayır |
| POST | `/api/pois` | Yeni POI oluştur (modüler/önerilen) | Evet |
| POST | `/api/poi` | Yeni POI oluştur (legacy uyumluluk) | Evet |
| PUT | `/api/poi/{id}` | POI güncelle | Evet |
| DELETE | `/api/poi/{id}` | POI sil | Evet |
| GET | `/api/poi/{id}/media` | POI medya listesi | Hayır |
| POST | `/api/poi/{id}/media` | Medya yükle | Evet |
| GET | `/api/poi/{id}/ratings` | POI rating'leri | Hayır |
| PUT | `/api/poi/{id}/ratings` | POI rating'leri güncelle | Evet |

#### Rota Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/routes` | Tüm rotaları listele | Hayır |
| GET | `/api/routes/{id}` | Rota detayı | Hayır |
| GET | `/api/routes/{id}/geometry` | Rota geometrisi | Hayır |
| POST | `/api/route/smart` | Akıllı rota oluştur (legacy/poi_api.py) | Hayır |
| POST | `/api/route/walking` | Yürüyüş rotası hesapla (legacy/poi_api.py) | Hayır |
| POST | `/api/admin/routes` | Yeni rota oluştur | Evet |
| PUT | `/api/admin/routes/{id}` | Rota güncelle | Evet |
| DELETE | `/api/admin/routes/{id}` | Rota sil | Evet |

#### Rota İçe Aktarma Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| POST | `/api/routes/import` | Rota dosyası içe aktar (GPX/KML/KMZ) | Evet |
| GET | `/api/routes/import/progress/{upload_id}` | İçe aktarma ilerlemesi | Evet |
| POST | `/api/routes/import/confirm` | İçe aktarmayı onayla | Evet |
| POST | `/api/routes/import/cancel` | İçe aktarmayı iptal et | Evet |
| POST | `/api/routes/import/validate` | Dosyayı sadece doğrula (modüler) | Evet |

> Not: Import sırasında `upload_id` durum bilgisi RAM'de tutulur; sunucu yeniden başlarsa aynı `upload_id` ile `/confirm` yapılamaz, dosyayı yeniden yüklemek gerekir.

#### Öneri Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| POST | `/api/recommendations` | POI önerileri al (legacy/poi_api.py) | Hayır |

#### Kimlik Doğrulama Endpoints

| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/auth/login` | Login sayfası | Hayır |
| POST | `/auth/login` | Kullanıcı girişi | Hayır |
| POST | `/auth/logout` | Kullanıcı çıkışı | Hayır |
| GET | `/auth/status` | Oturum durumu | Hayır |
| GET | `/auth/csrf-token` | CSRF token al | Hayır |

### 7.2 Örnek API Çağrıları

#### POI Arama
```bash
# Tüm POI'ları listele
curl http://localhost:5560/api/pois

# Belirli POI detayı
curl http://localhost:5560/api/poi/1

# Kategoriye göre filtrele
curl http://localhost:5560/api/pois?category=gastronomik

# Konum bazlı arama
curl "http://localhost:5560/api/pois?lat=38.642&lng=34.831&radius=5"

# Metin arama
curl "http://localhost:5560/api/search?q=ürgüp"
```

#### POI Oluşturma (Admin)
```bash
curl -X POST http://localhost:5560/api/poi \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "name": "Yeni Restoran",
    "category": "gastronomik",
    "latitude": 38.642,
    "longitude": 34.831,
    "description": "Açıklama"
  }'
```

#### Akıllı Rota Oluşturma
```bash
curl -X POST http://localhost:5560/api/route/smart \
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
```

#### POI Önerileri
```bash
curl -X POST http://localhost:5560/api/recommendations \
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

#### Medya Yükleme
```bash
# Fotoğraf yükle
curl -X POST http://localhost:5560/api/poi/1/media \
  -H "Cookie: session=your_session_cookie" \
  -F "file=@photo.jpg"

# Çoklu fotoğraf yükle
curl -X POST http://localhost:5560/api/poi/1/media \
  -H "Cookie: session=your_session_cookie" \
  -F "files[]=@photo1.jpg" \
  -F "files[]=@photo2.jpg"
```

#### Rota İçe Aktarma
```bash
curl -X POST http://localhost:5560/api/routes/import \
  -H "Cookie: session=your_session_cookie" \
  -F "file=@route.gpx" \
  -F "name=Yeni Rota" \
  -F "description=Rota açıklaması"
```

### 7.3 API Response Formatları

#### Başarılı Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Ürgüp Müzesi",
    "category": "kulturel",
    "latitude": 38.642,
    "longitude": 34.831
  }
}
```

#### Hata Response
```json
{
  "success": false,
  "error": {
    "type": "POINotFoundError",
    "message": "POI with id 999 not found",
    "code": 404
  }
}
```

#### Paginated Response
```json
{
  "success": true,
  "routes": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "has_more": true
}
```

---

## 8. Veritabanı Yapısı

### 8.1 Veritabanı Teknolojileri

- **Ana Veritabanı**: PostgreSQL 12+
- **Coğrafi Uzantı**: PostGIS 3.0+
- **Koordinat Sistemi**: WGS84 (EPSG:4326)
- **ORM**: Yok (Raw SQL - performans için)
- **Connection Pooling**: psycopg2 connection pool

### 8.2 Ana Tablolar

#### POI Tablosu (`pois`)
```sql
CREATE TABLE pois (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude FLOAT,
    description TEXT,
    short_description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    attributes JSONB
);
```

**İndeksler:**
```sql
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_poi_active ON pois(is_active);
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
```

#### Rotalar Tablosu (`routes`)
```sql
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    route_type VARCHAR(50) NOT NULL DEFAULT 'walking',
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5) DEFAULT 1,
    estimated_duration INTEGER, -- dakika
    total_distance FLOAT, -- km
    elevation_gain INTEGER, -- metre
    route_geometry GEOGRAPHY(LINESTRING, 4326),
    waypoints JSONB,
    start_poi_id INTEGER REFERENCES pois(id),
    end_poi_id INTEGER REFERENCES pois(id),
    is_circular BOOLEAN DEFAULT false,
    season_availability JSONB DEFAULT '["spring", "summer", "autumn", "winter"]',
    tags TEXT,
    elevation_profile JSONB,
    preview_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

#### POI Puanlama Sistemi (`poi_ratings`)
```sql
CREATE TABLE poi_ratings (
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    category TEXT,
    rating INTEGER CHECK (rating BETWEEN 0 AND 100),
    PRIMARY KEY (poi_id, category)
);
```

**Puanlama Kategorileri:**
- `tarihi`: Tarihi önem ve değer
- `sanat_kultur`: Sanatsal ve kültürel değer
- `doga`: Doğal güzellik ve çevre
- `eglence`: Eğlence ve aktivite değeri
- `alisveris`: Alışveriş olanakları
- `spor`: Spor aktiviteleri
- `macera`: Macera ve heyecan
- `rahatlatici`: Huzur ve dinlendirici
- `yemek`: Gastronomi ve lezzet
- `gece_hayati`: Gece eğlencesi

#### Rota Medya Dosyaları (`route_media`)
```sql
CREATE TABLE route_media (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    thumbnail_path VARCHAR(255),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    media_type VARCHAR(20) DEFAULT 'photo',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### POI Medya Dosyaları (`poi_media`)
```sql
CREATE TABLE poi_media (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    thumbnail_path VARCHAR(255),
    media_type VARCHAR(20) DEFAULT 'image',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 8.3 Coğrafi Fonksiyonlar

#### Rota Yakınındaki POI'leri Bulma
```sql
CREATE OR REPLACE FUNCTION find_pois_near_route(
    route_geom GEOGRAPHY,
    max_distance_meters INTEGER DEFAULT 1000,
    limit_count INTEGER DEFAULT 50
) RETURNS TABLE(
    poi_id INTEGER,
    poi_name VARCHAR(255),
    poi_category VARCHAR(50),
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.category,
        ST_Distance(p.location, route_geom) as distance_meters
    FROM pois p
    WHERE ST_DWithin(p.location, route_geom, max_distance_meters)
    AND p.is_active = true
    ORDER BY distance_meters ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

### 8.4 Performans Optimizasyonları

#### Kritik İndeksler
```sql
-- Coğrafi sorgular için
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_routes_geometry ON routes USING GIST(route_geometry);

-- Kategori filtreleme için
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_routes_type ON routes(route_type);

-- JSON arama için
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
CREATE INDEX idx_routes_waypoints ON routes USING GIN(waypoints);

-- Metin arama için (trigram)
CREATE INDEX idx_routes_name_trgm ON routes USING GIN (name gin_trgm_ops);
```

---

## 9. Geliştirme Rehberi

### 9.1 Geliştirme Ortamı Kurulumu

```bash
# Projeyi klonlayın
git clone <repository-url>
cd seyahat_onerisi

# Sanal ortam oluşturun
python3 -m venv venv
source venv/bin/activate

# Geliştirme bağımlılıklarını kurun
pip install -r requirements.txt
pip install pytest pytest-cov black flake8 mypy

# Geliştirme modunda çalıştırın
export FLASK_ENV=development
export FLASK_DEBUG=True
python poi_api.py
```

### 9.2 Yeni Özellik Ekleme

#### 1. Feature Branch Oluşturun
```bash
git checkout -b feature/yeni-ozellik
```

#### 2. Değişiklikleri Yapın
- Modüler yapıyı koruyun (`app/` klasörü)
- Test yazın
- Dokümantasyonu güncelleyin

#### 3. Test Edin
```bash
python -m pytest tests/
python -m pytest --cov=app tests/
python smoke_test.py
```

#### 4. Commit ve Push
```bash
git add .
git commit -m "feat: yeni özellik eklendi"
git push origin feature/yeni-ozellik
```

#### 5. Pull Request Oluşturun

### 9.3 Test Yazma

#### Unit Test Örneği
```python
import pytest
from app import create_app
from app.services.poi_service import POIService

class TestPOIAPI:
    def setup_method(self):
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.service = POIService()
        
    def test_get_pois_success(self):
        """Test successful POI retrieval"""
        response = self.client.get('/api/pois')
        assert response.status_code == 200
        data = response.get_json()
        assert 'data' in data or 'pois' in data
        
    def test_create_poi_validation(self):
        """Test POI creation with validation"""
        invalid_poi = {
            'name': '',  # Invalid: empty name
            'category': 'invalid_category'
        }
        response = self.client.post('/api/poi', json=invalid_poi)
        assert response.status_code == 400
```

### 9.4 Kod Dokümantasyonu

#### Docstring Örneği
```python
def calculate_route_distance(route_points: List[Tuple[float, float]]) -> float:
    """
    Calculate total distance of a route given a list of coordinate points.
    
    This function uses the Haversine formula to calculate the great-circle
    distance between consecutive points in the route.
    
    Args:
        route_points: List of (latitude, longitude) tuples representing
                     the route waypoints in decimal degrees.
    
    Returns:
        Total route distance in kilometers.
    
    Raises:
        ValueError: If route_points contains fewer than 2 points.
    
    Example:
        >>> points = [(38.6322, 34.9115), (38.6422, 34.9215)]
        >>> calculate_route_distance(points)
        1.42
    """
    if len(route_points) < 2:
        raise ValueError("Route must have at least 2 points")
    
    total_distance = 0.0
    for i in range(len(route_points) - 1):
        lat1, lon1 = route_points[i]
        lat2, lon2 = route_points[i + 1]
        total_distance += haversine_distance(lat1, lon1, lat2, lon2)
    
    return total_distance
```

### 9.5 Hata Yönetimi

#### Özel Exception Sınıfları
```python
class APIError(Exception):
    """Base exception for API-related errors"""
    def __init__(self, message, code="INTERNAL_ERROR", status_code=500):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(self.message)

class POINotFoundError(APIError):
    """Raised when a POI is not found"""
    def __init__(self, poi_id):
        super().__init__(
            f"POI with id {poi_id} not found",
            "POI_NOT_FOUND",
            404
        )
        self.poi_id = poi_id

class RouteCreationError(APIError):
    """Raised when route creation fails"""
    def __init__(self, message, details=None):
        super().__init__(message, "ROUTE_CREATION_ERROR", 400)
        self.details = details
```

#### Error Handling Middleware
```python
from app.middleware.error_handler import error_handler

@error_handler.app_errorhandler(APIError)
def handle_api_error(error):
    """Handle API-specific exceptions"""
    response = {
        'success': False,
        'error': {
            'type': error.__class__.__name__,
            'message': error.message,
            'code': error.code
        }
    }
    
    if hasattr(error, 'details'):
        response['error']['details'] = error.details
    
    return jsonify(response), error.status_code
```

---

## 10. Sorun Giderme

### 10.1 Yaygın Sorunlar

#### 1. Veritabanı Bağlantı Hatası

**Belirtiler**: `Connection refused`, `Authentication failed`

**Çözüm**:
```bash
# Bağlantı bilgilerini kontrol et
python -c "from poi_database_adapter import POIDatabaseFactory; db = POIDatabaseFactory.create(); db.connect(); print('✅ Bağlantı başarılı'); db.disconnect()"

# PostgreSQL servisini kontrol et
sudo systemctl status postgresql

# Bağlantı string'ini kontrol et
echo $POI_DB_CONNECTION

# PostgreSQL loglarını kontrol et
sudo tail -f /var/log/postgresql/postgresql-*.log
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
pip install --upgrade pip
pip install -r requirements.txt

# Sistem bağımlılıklarını kontrol et
sudo apt-get install -y python3-dev build-essential
```

#### 3. Port Çakışması

**Belirtiler**: `Address already in use`

**Çözüm**:
```bash
# Kullanılan portları kontrol et
sudo netstat -tulpn | grep :5560
# veya
sudo lsof -i :5560

# Farklı port kullan
export PORT=5561
python poi_api.py
```

#### 4. PostGIS Uzantı Hatası

**Belirtiler**: `Extension postgis does not exist`

**Çözüm**:
```bash
sudo -u postgres psql -d poi_db << EOF
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
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

### 10.2 Log Analizi

```bash
# Uygulama logları
tail -f api.log

# Flask debug logları (geliştirme modunda)
# Konsol çıktısında görünür

# Sistem logları
journalctl -u poi-api -f  # systemd service için

# Nginx logları
sudo tail -f /var/log/nginx/error.log
```

### 10.3 Performans Sorunları

```bash
# Veritabanı sorgu analizi
python check_db_constraints.py

# Smoke testleri çalıştır
python smoke_test.py

# Cache durumunu kontrol et
ls -lh cache/

# Veritabanı performans analizi
psql -U poi_user -d poi_db -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

---

## 11. Dağıtım ve Bakım

### 11.1 Üretim Sunucusu Kurulumu

#### Gunicorn Kurulumu
```bash
pip install gunicorn

# Gunicorn yapılandırma dosyası
cat > gunicorn.conf.py << EOF
bind = "127.0.0.1:5560"
workers = 4
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
EOF

# Test
gunicorn --config gunicorn.conf.py wsgi:application
```

#### Systemd Servisi
```bash
sudo tee /etc/systemd/system/urgup-seyahat-onerisi.service > /dev/null << EOF
[Unit]
Description=Urgup Seyahat Oneri Sistemi
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/opt/rehber/seyahat_onerisi
Environment="PATH=/opt/rehber/seyahat_onerisi/venv/bin"
ExecStart=/opt/rehber/seyahat_onerisi/venv/bin/gunicorn --config gunicorn.conf.py wsgi:application
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=urgup-seyahat

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable urgup-seyahat-onerisi
sudo systemctl start urgup-seyahat-onerisi
```

#### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Static files
    location /static/ {
        alias /opt/rehber/seyahat_onerisi/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /opt/rehber/seyahat_onerisi/poi_media/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Main application
    location / {
        proxy_pass http://127.0.0.1:5560;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 11.2 SSL Sertifikası (Let's Encrypt)

```bash
# SSL sertifikası al
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Otomatik yenilemeyi test et
sudo certbot renew --dry-run

# Cron job ekle
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -
```

### 11.3 Yedekleme

#### Otomatik Yedekleme Scripti
```bash
sudo tee /usr/local/bin/urgup_backup.sh > /dev/null << EOF
#!/bin/bash
BACKUP_DIR="/backup/\$(date +%Y%m%d_%H%M%S)"
mkdir -p \$BACKUP_DIR

# Veritabanı yedekle
pg_dump -U poi_user poi_db > \$BACKUP_DIR/poi_db.sql

# Medya dosyaları yedekle
tar -czf \$BACKUP_DIR/media_backup.tar.gz /opt/rehber/seyahat_onerisi/poi_media/

# Eski yedekleri temizle (7 günden eski)
find /backup -name "*.sql" -mtime +7 -delete

echo "Yedekleme tamamlandı: \$BACKUP_DIR"
EOF

sudo chmod +x /usr/local/bin/urgup_backup.sh

# Cron job ekle (her gün 02:00'da)
sudo crontab -l | { cat; echo "0 2 * * * /usr/local/bin/urgup_backup.sh"; } | sudo crontab -
```

### 11.4 Monitoring

#### Sistem İzleme
```bash
# Sistem kaynaklarını izle
htop

# Disk kullanımını kontrol et
df -h

# Bellek kullanımını kontrol et
free -h

# Ağ bağlantılarını izle
netstat -tlnp | grep :5560
```

#### Log Yönetimi
```bash
# Logrotate yapılandırması
sudo tee /etc/logrotate.d/urgup-seyahat > /dev/null << EOF
/opt/rehber/seyahat_onerisi/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload urgup-seyahat-onerisi
    endscript
}
EOF
```

### 11.5 Docker ile Dağıtım

#### Dockerfile
```dockerfile
FROM python:3.12-slim

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
EXPOSE 5560

# Çalıştırma
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5560", "wsgi:application"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5560:5560"
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

---

### 11.6 Android APK (WebView)

Bu repo içindeki `android_app/` klasörü, web arayüzünü Android üzerinde **WebView** ile açan basit bir sarmalayıcı uygulamadır. Uygulama açılınca varsayılan olarak şu adrese gider:

- `https://harita.urgup.keenetic.link/`

#### Build (Android Studio)
- Android Studio ile `android_app/` klasörünü proje olarak açın.
- `Run` ile cihazda çalıştırın veya APK üretin.

#### Build (CLI)
```bash
cd android_app

# Android SDK yolunu local.properties içine yazın
echo "sdk.dir=/path/to/Android/Sdk" > local.properties

# Debug APK
./gradlew :app:assembleDebug
```

APK çıktısı:
- `android_app/app/build/outputs/apk/debug/app-debug.apk`

Başlangıç URL’i değiştirmek için:
- `android_app/app/src/main/java/link/keenetic/urgup/harita/MainActivity.kt` içindeki `START_URL`

---

## Ekler

### A. Komut Satırı Araçları

#### Rota Planlayıcı
```bash
# Tüm kategorilerde rota oluştur
python category_route_planner_with_db.py

# Belirli kategoride rota oluştur
python category_route_planner_with_db.py gastronomik
python category_route_planner_with_db.py kulturel

# Başlangıç noktası belirle
python category_route_planner_with_db.py kulturel --start "Ürgüp Müzesi"

# Maksimum mesafe belirle (km)
python category_route_planner_with_db.py aktivite --radius 5

# Yükseklik verilerini dahil et
python category_route_planner_with_db.py dogal --elevation

# Çıktı formatını belirle
python category_route_planner_with_db.py gastronomik -o rota.html
```

### B. Test Komutları

```bash
# Smoke testleri çalıştır
python smoke_test.py

# veya pytest ile
python -m pytest tests/

# Belirli test dosyası
python -m pytest tests/api/test_pois.py

# Coverage raporu ile
python -m pytest --cov=app tests/
```

### C. Veritabanı Yardımcı Scriptleri

```bash
# Veritabanı şemasını oluştur
python setup_basic_tables.py

# Veritabanı kısıtlamalarını kontrol et
python check_db_constraints.py

# Rota yükseklik verilerini güncelle
python recalculate_route_elevation.py

# POI verilerini içe aktar
python import_poi_data.py
```

### D. İletişim ve Destek

- **GitHub**: [Proje Sayfası](https://github.com/username/seyahat_onerisi)
- **Dokümantasyon**: [Wiki](https://github.com/username/seyahat_onerisi/wiki)
- **Issues**: [GitHub Issues](https://github.com/username/seyahat_onerisi/issues)

---

## Lisans

Bu repo içinde henüz bir `LICENSE` dosyası bulunmuyor. Lisans bilgisi netleştiğinde bu bölüm güncellenecektir.

---

**Not**: Bu dokümantasyon sürekli güncellenmektedir. En güncel sürüm için GitHub repository'sini kontrol edin.

**Versiyon**: 2.2.0  
**Son Güncelleme**: Aralık 2025
