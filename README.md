# 🏺 Kapadokya Rota Planlayıcısı

Kapadokya bölgesindeki ilgi noktaları (POI) arasında optimize edilmiş rotalar oluşturan gelişmiş Python uygulaması. Ürgüp merkez odaklı bu sistem, turistik yerleri kategorize ederek interaktif haritalar ve detaylı rota planları sunar.

Detaylı mimari açıklaması için [PROJE_MIMARISI.md](PROJE_MIMARISI.md) dosyasını inceleyebilirsiniz.
![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![OpenStreetMap](https://img.shields.io/badge/Maps-OpenStreetMap-orange.svg)

## ✨ Özellikler

### 🗺️ Harita ve Rota Özellikleri
- **İnteraktif Haritalar**: Folium tabanlı dinamik haritalar
- **Çoklu Harita Katmanları**: OpenStreetMap, Topografik, Uydu görüntüsü
- **Rota Optimizasyonu**: TSP (Traveling Salesman Problem) algoritması ile optimize edilmiş rotalar
- **Yükseklik Profilleri**: Detaylı yükseklik grafikleri ve zorluk hesaplaması
- **Gerçek Yol Verileri**: OSMnx ile OpenStreetMap yol ağı kullanımı

### 📍 POI Kategori Sistemi
- 🍽️ **Gastronomik**: Restoranlar, kafeler ve lezzet noktaları
- 🏛️ **Kültürel**: Müzeler, tarihi yerler ve kültürel mekanlar  
- 🎨 **Sanatsal**: Sanat galerileri, atölyeler ve yaratıcı mekanlar
- 🌿 **Doğa & Macera**: Doğal güzellikler ve macera aktiviteleri
- 🏨 **Konaklama**: Oteller, pansiyonlar ve konaklama tesisleri

### 💾 Veritabanı Desteği
- **PostgreSQL + PostGIS**: Gelişmiş mekansal sorgular
- **MongoDB**: Esnek NoSQL çözümü
- **POI Detay Yönetimi**: Görseller, 3D modeller, detaylı özellikler

### 🛠️ Teknik Özellikler
- **Performans Optimizasyonu**: Akıllı önbellekleme sistemi
- **Çoklu Harita Formatı**: Farklı görünüm seçenekleri
- **Responsive Tasarım**: Mobil uyumlu arayüz
- **Ölçüm Araçları**: Mesafe ve alan ölçüm desteği

## 🚀 Kurulum

### Sistem Gereksinimleri

**Minimum Gereksinimler:**
- **Python**: 3.7 veya üzeri
- **İşletim Sistemi**: Windows 10, macOS 10.14, Ubuntu 18.04 veya üzeri
- **RAM**: En az 4GB (8GB önerilir)
- **Disk Alanı**: En az 2GB boş alan
- **İnternet Bağlantısı**: OSM verilerini indirmek ve yükseklik API'si için gerekli

**Gerekli Sistem Paketleri:**

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install python3-pip python3-dev python3-venv
sudo apt-get install libgeos-dev libproj-dev libgdal-dev
sudo apt-get install build-essential libssl-dev libffi-dev
```

**CentOS/RHEL/Fedora:**
```bash
sudo yum install python3-pip python3-devel
sudo yum install geos-devel proj-devel gdal-devel
sudo yum install gcc openssl-devel libffi-devel
```

**macOS:**
```bash
# Homebrew ile
brew install python3 geos proj gdal
```

**Windows:**
- Python'u [python.org](https://python.org) adresinden indirin
- Microsoft Visual C++ Build Tools'u yükleyin

### Adım Adım Kurulum

#### Otomatik Kurulum (Tercih Edilen)
```bash
./install.sh
```

#### 1. Projeyi İndirin
```bash
# Depoyu klonlayın
git clone <repo-url>
cd kapadokya-rota-planlayicisi

# Veya ZIP olarak indirin ve açın
```

#### 2. Python Sanal Ortamı Oluşturun (Önerilir)
```bash
# Sanal ortam oluştur
python3 -m venv venv

# Sanal ortamı aktifleştir
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

#### 3. Python Bağımlılıklarını Kurun
```bash
# Bağımlılıkları kurun
pip install --upgrade pip
pip install -r requirements.txt

# Eksik paketler varsa manuel kurulum:
pip install pymongo psycopg2-binary geoalchemy2 requests
```

#### 4. Veritabanı Kurulumu (İsteğe Bağlı)

**Sadece JSON Dosyası ile Çalışma (Hızlı Başlangıç):**
```bash
# Hiçbir ek kurulum gerekmez
# Sistem otomatik olarak test_data.json dosyasını kullanacak
```

**MongoDB Kurulumu:**
```bash
# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb

# macOS (Homebrew ile)
brew install mongodb-community
brew services start mongodb-community

# Windows - MongoDB Community Server indirin ve kurun
```

**PostgreSQL + PostGIS Kurulumu:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib postgis
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS (Homebrew ile)
brew install postgresql postgis
brew services start postgresql

# Windows - PostgreSQL'i resmi siteden indirin
```

#### 5. Çevre Değişkenlerini Ayarlayın

**Linux/macOS (.bashrc veya .zshrc dosyasına ekleyin):**
```bash
# MongoDB için
export POI_DB_TYPE=mongodb
export POI_DB_CONNECTION=mongodb://localhost:27017/
export POI_DB_NAME=poi_cappadocia

# PostgreSQL için
export POI_DB_TYPE=postgresql
export POI_DB_CONNECTION=postgresql://kullanici:sifre@localhost/poi_db
export POI_DB_NAME=poi_db

# JSON dosyası için (varsayılan)
# Hiçbir değişken ayarlamanıza gerek yok
```

**Windows (System Properties > Environment Variables):**
```cmd
# MongoDB için
set POI_DB_TYPE=mongodb
set POI_DB_CONNECTION=mongodb://localhost:27017/
set POI_DB_NAME=poi_cappadocia

# PostgreSQL için
set POI_DB_TYPE=postgresql
set POI_DB_CONNECTION=postgresql://kullanici:sifre@localhost/poi_db
set POI_DB_NAME=poi_db
```

#### 6. Veritabanını Başlatın (Veritabanı Kullanıyorsanız)

**MongoDB için:**
```bash
python setup_poi_database.py mongodb "mongodb://localhost:27017/" --db-name poi_cappadocia
```

**PostgreSQL için:**
```bash
# Önce veritabanı ve kullanıcı oluşturun
sudo -u postgres psql
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
CREATE EXTENSION postgis;
\q

# Sonra veritabanını hazırlayın
python setup_poi_database.py postgresql "postgresql://poi_user:your_password@localhost/poi_db"
```

#### 7. Test ve Doğrulama

**Kurulum testini çalıştırın:**
```bash
# Basit rota testi
python category_route_planner.py gastronomik --no-elevation -o test_route.html

# API testi (veritabanı varsa)
python poi_api.py &
curl http://localhost:5505/health
```

**Beklenen çıktılar:**
- `test_route.html` dosyası oluşmalı
- Cache klasöründe `.json` dosyaları oluşmalı
- API health check'i başarılı olmalı

### Hızlı Başlatma (5 Dakika)

Eğer hızlıca test etmek istiyorsanız:

```bash
# 1. Temel paketleri kurun
pip install folium osmnx networkx numpy requests

# 2. Hemen çalıştırın (JSON verisi ile)
python category_route_planner.py

# 3. Sonucu açın
# tum_kategoriler_rotasi.html dosyası oluşacak
```

### Docker ile Kurulum (Gelişmiş)

```bash
# Dockerfile oluşturun
cat > Dockerfile << 'EOF'
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5505

CMD ["python", "poi_api.py"]
EOF

# Docker imajını oluşturun
docker build -t kapadokya-poi .

# Çalıştırın
docker run -p 5505:5505 kapadokya-poi
```

## 🔧 Kurulum Sorunları ve Çözümleri

### Yaygın Kurulum Sorunları

**1. OSMnx Kurulum Hatası:**
```bash
# Çözüm 1: Conda ile kurun
conda install -c conda-forge osmnx

# Çözüm 2: Sistem paketlerini kurun
sudo apt-get install libspatialindex-dev  # Ubuntu/Debian
brew install spatialindex  # macOS
```

**Ek: scikit-learn Eksik Uyarısı**
```bash
pip install scikit-learn
```

**2. GEOS/GDAL Hataları:**
```bash
# Ubuntu/Debian
sudo apt-get install libgeos-dev libgdal-dev libproj-dev

# macOS
brew install geos gdal proj

# Sonra tekrar kurun
pip install --force-reinstall folium osmnx
```

**3. Psycopg2 Kurulum Hatası:**
```bash
# Ubuntu/Debian
sudo apt-get install libpq-dev python3-dev

# macOS
brew install postgresql

# Sonra tekrar kurun
pip install psycopg2-binary
```

**4. MongoDB Bağlantı Hatası:**
```bash
# Servisi kontrol edin
sudo systemctl status mongodb

# Başlatın
sudo systemctl start mongodb

# Port kontrolü
netstat -an | grep 27017
```

**5. Bellek Hatası (Büyük Veri Setleri):**
```bash
# Küçük bölge ile test edin
python category_route_planner.py gastronomik --radius 2

# Yükseklik verilerini devre dışı bırakın
python category_route_planner.py --no-elevation
```

**6. İnternet Bağlantı Sorunları:**
```bash
# Mevcut cache verilerini kullanın
ls cache/  # Cache dosyalarını kontrol edin

# Offline mod için mevcut GraphML dosyalarını kullanın
python category_route_planner.py -g urgup_merkez_walking.graphml
```

### Test Komutları

**Kurulum doğrulama:**
```bash
# Python ve paket sürümlerini kontrol edin
python --version
pip list | grep -E "(folium|osmnx|networkx|numpy)"

# İndirilen GraphML dosyalarını kontrol edin
ls -la *.graphml

# Cache klasörünü kontrol edin
ls -la cache/

# API test (veritabanı ile)
python -c "from poi_database_adapter import POIDatabaseFactory; print('✅ Veritabanı adaptörü çalışıyor')"
```

**Performans testi:**
```bash
# Küçük alan testi
time python category_route_planner.py gastronomik --radius 1

# Büyük alan testi  
time python category_route_planner.py --radius 15
```

### Güncelleme Prosedürü

```bash
# Güncel sürümü indirin
git pull origin main

# Bağımlılıkları güncelleyin
pip install --upgrade -r requirements.txt

# Cache'i temizleyin (isteğe bağlı)
rm -rf cache/*

# Veritabanını güncelleyin (varsa)
python setup_poi_database.py <db_type> <connection_string>
```

### Kaldırma İşlemi

```bash
# Sanal ortamı kaldırın
rm -rf venv/

# Proje dosyalarını kaldırın
cd .. && rm -rf kapadokya-rota-planlayicisi/

# Veritabanını kaldırın (isteğe bağlı)
# MongoDB:
mongo
use poi_cappadocia
db.dropDatabase()

# PostgreSQL:
sudo -u postgres psql
DROP DATABASE poi_db;
```

### Yedekleme ve Geri Yükleme
Projeyi ve veritabanını yedeklemek için `backup_restore.sh` scriptini kullanabilirsiniz.
```bash
# Yedek oluştur
./backup_restore.sh backup

# Yedekleri listele
./backup_restore.sh list

# Geri yükleme
./backup_restore.sh restore <yedek_adi>
```
Detaylı açıklama için `YEDEKLEME_REHBERI.md` dosyasına bakabilirsiniz.

## 📚 Detaylı Kullanım

### Komut Satırı Parametreleri

```bash
python category_route_planner.py [kategori] [seçenekler]

Pozisyonel Argümanlar:
  kategori              İşlenecek POI kategorisi (gastronomik, kulturel, sanatsal, doga_macera, konaklama)

Seçenekler:
  -o, --output          Çıktı HTML dosya adı
  -g, --graphfile       Yol ağı GraphML dosyası (varsayılan: urgup_merkez_walking.graphml)
  -r, --radius          Yol ağı indirme yarıçapı (km, varsayılan: 10)
  --start               Rotanın başlayacağı POI adı
  --no-optimize         Rota optimizasyonunu devre dışı bırak
  --no-elevation        Yükseklik profilini devre dışı bırak
  -h, --help            Yardım mesajını göster
```

### Örnek Kullanım Senaryoları

#### 1. Gastronomik Tur Planı
```bash
python category_route_planner.py gastronomik --start "Ziggy Cafe & Restaurant (Ürgüp)"
```

#### 2. Kültürel Gezi Rotası
```bash
python category_route_planner.py kulturel --start "Ürgüp Müzesi" -o kulturel_tur.html
```

#### 3. Tam Kapsamlı Ürgüp Turu
```bash
python category_route_planner.py -o urgup_komple_tur.html
```

## 💽 Veritabanı Kurulumu

### PostgreSQL + PostGIS

```bash
# PostgreSQL veritabanı kurulumu
python setup_poi_database.py postgresql "postgresql://user:password@localhost/poi_db"

# Veritabanı ile rota planlama
python category_route_planner_with_db.py --db-type postgresql --db-connection "postgresql://user:password@localhost/poi_db"
```

### MongoDB

```bash
# MongoDB veritabanı kurulumu
python setup_poi_database.py mongodb "mongodb://localhost:27017/" --db-name poi_cappadocia

# MongoDB ile rota planlama
python category_route_planner_with_db.py --db-type mongodb --db-connection "mongodb://localhost:27017/" --db-name poi_cappadocia
```

### Veritabanı Şeması

Detaylı mimari için `PROJE_MIMARISI.md`, tablo açıklamaları için `poi_database_design.md` dosyalarına bakabilirsiniz.
- **POI Tablosu**: Ana ilgi noktaları bilgileri
- **Kategoriler**: POI sınıflandırması
- **Görseller**: POI fotoğrafları ve thumbnails
- **3D Modeller**: 3 boyutlu model verileri
- **Mekansal İndeksler**: Performanslı coğrafi sorgular

## 📁 Proje Yapısı

```
seyahat_onerisi/
├── category_route_planner.py          # Ana rota planlayıcı
├── category_route_planner_with_db.py  # Veritabanı destekli versiyon
├── poi_database_adapter.py            # Veritabanı adaptörü
├── setup_poi_database.py              # Veritabanı kurulum scripti
├── poi_database_design.md             # Veritabanı tasarım dokümantasyonu
├── requirements.txt                   # Python bağımlılıkları
├── cache/                             # Performans önbellek dosyaları
├── *.graphml                          # OSM yol ağı verileri
└── *.html                             # Üretilen harita dosyaları
```

## 🛠️ Bağımlılıklar

### Ana Kütüphaneler
- **folium**: İnteraktif harita oluşturma
- **osmnx**: OpenStreetMap veri işleme
- **psycopg2-binary**: PostgreSQL bağlantısı
- **sqlalchemy**: ORM ve veritabanı yönetimi
- **geoalchemy2**: Mekansal veritabanı işlemleri
- **pymongo**: MongoDB bağlantısı

### Sistem Gereksinimleri
- Python 3.7+
- PostgreSQL 12+ (PostGIS uzantısı ile) veya MongoDB 4.0+
- İnternet bağlantısı (OSM verileri ve yükseklik API'si için)

## 🎨 Harita Özellikleri

### İnteraktif Kontroller
- **Katman Seçimi**: Farklı harita görünümleri
- **POI Filtreleme**: Kategori bazlı gösterim/gizleme
- **Mesafe Ölçümü**: Harita üzerinde mesafe ölçüm aracı
- **Tam Ekran**: Büyütülmüş harita görünümü
- **Mini Harita**: Konum referansı

### Rota Bilgileri
- **Toplam Mesafe**: Kilometre cinsinden rota uzunluğu
- **Yükseklik Profili**: İnteraktif yükseklik grafikleri
- **Zorluk Seviyesi**: Otomatik hesaplanan rota zorluğu
- **Tırmanış/İniş**: Toplam yükselti değişimleri

### POI Detayları
- **Sıralı Numaralandırma**: Optimize edilmiş ziyaret sırası
- **Detaylı Bilgiler**: Açıklama, iletişim, özellikler
- **Google Maps Entegrasyonu**: Direkt navigasyon linki
- **Kategori Renklendirme**: Görsel sınıflandırma

## ⚡ Performans Optimizasyonu

### Önbellekleme Sistemi
- OSM yol ağı verileri yerel olarak saklanır
- API çağrıları minimize edilir
- İşlenmiş rota verileri önbelleğe alınır

### Veri İndirme Stratejileri
- **Otomatik İndirme**: İlk çalıştırmada OSM verilerini indirir
- **Offline Mod**: Mevcut verilerle çalışma imkanı
- **API Hata Yönetimi**: Bağlantı sorunlarında alternatif çözümler

## 🔧 Gelişmiş Konfigürasyon

### Özel POI Ekleme

POI verilerini `category_route_planner.py` dosyasındaki `POI_DATA` sözlüğünde düzenleyebilirsiniz:

```python
POI_DATA = {
    "ozel_kategori": {
        "Özel Nokta 1": (38.6310, 34.9130),
        "Özel Nokta 2": (38.6320, 34.9140)
    }
}
```

### Stil Özelleştirme

Kategori renklerini ve simgelerini `CATEGORY_STYLES` sözlüğünde değiştirebilirsiniz:

```python
CATEGORY_STYLES = {
    "ozel_kategori": {
        "color": "#ff6b6b",
        "icon": "star",
        "display_name": "⭐ Özel Yerler"
    }
}
```

## 🌐 API Entegrasyonları

### Yükseklik Verileri
- **Open-Meteo API**: Ücretsiz yükseklik profili verileri
- **Chunk İşleme**: Büyük rotaları parçalara bölerek işler
- **Hata Toleransı**: API erişim sorunlarında graceful degradation

### Harita Servisleri
- **OpenStreetMap**: Ücretsiz harita katmanları
- **CartoDB**: Çoklu stil seçenekleri
- **Esri**: Uydu görüntüleri

## 🚨 Sorun Giderme

### Yaygın Sorunlar ve Çözümleri

#### OSM Verisi İndirilememe
```bash
# Manuel GraphML dosyası oluşturma
python -c "
import osmnx as ox
G = ox.graph_from_place('Ürgüp, Türkiye', network_type='walk')
ox.save_graphml(G, 'urgup_merkez_walking.graphml')
"
```

#### Yükseklik API'si Erişim Hatası
```bash
# Yükseklik özelliğini devre dışı bırakma
python category_route_planner.py --no-elevation
```

#### Veritabanı Bağlantı Sorunları
```bash
# PostgreSQL servis kontrolü
sudo systemctl status postgresql

# MongoDB servis kontrolü  
sudo systemctl status mongod
```

### Performans Sorunları

#### Büyük Veri Setleri
- Cache klasörünü temizleyin
- Radius parametresini azaltın
- POI sayısını sınırlayın

#### Bellek Kullanımı
- `--no-elevation` parametresini kullanın
- Daha küçük GraphML dosyaları tercih edin

## 📈 Gelecek Özellikler

### Planlanan Geliştirmeler
- [ ] Çoklu şehir desteği (Göreme, Avanos, Nevşehir)
- [ ] Mobil uygulama entegrasyonu
- [ ] Sosyal medya paylaşım özellikleri
- [ ] Hava durumu entegrasyonu
- [ ] Çoklu dil desteği
- [ ] Özel tur paketi oluşturma
- [ ] QR kod tabanlı POI bilgileri

### Teknik İyileştirmeler
- [ ] WebSocket tabanlı gerçek zamanlı güncellemeler
- [ ] Machine Learning tabanlı öneri sistemi
- [ ] PWA (Progressive Web App) desteği
- [ ] Docker konteyner desteği

## 🤝 Katkıda Bulunma

Bu projeye katkıda bulunmak için:

1. Bu repository'i fork edin
2. Yeni bir feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun


## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasını inceleyin.

