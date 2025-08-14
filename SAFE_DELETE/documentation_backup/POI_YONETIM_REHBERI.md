# 🗺️ POI Yönetim Sistemi - Kurulum ve Kullanım Rehberi

## ℹ️ Mevcut Durum
- **Kapadokya POI Yönetim Sistemi**, Kapadokya bölgesindeki ilgi noktalarını (POI) yönetmek, harita üzerinde göstermek, kategori bazlı filtrelemek ve optimize edilmiş rotalar oluşturmak için geliştirilmiş kapsamlı bir Python tabanlı web uygulamasıdır.
- **Çoklu Veritabanı Desteği**: Hem MongoDB hem PostgreSQL/PostGIS desteği vardır
- **İleri Düzey Rota Planlama**: TSP algoritması ile optimize edilmiş rotalar, yükseklik profilleri ve gerçek yol verileri
- **Web Arayüzü**: Tam entegre POI ekleme, düzenleme, silme, arama, filtreleme ve harita görselleştirme
- **Otomatik Kurulum**: `install.sh` scripti ile tek komutla sistem kurulumu
- **JSON Fallback**: Veritabanı olmadan da çalışabilir (test verileri ile)

## 📋 İçindekiler
1. [Sistem Gereksinimleri](#sistem-gereksinimleri)
2. [Hızlı Kurulum](#hızlı-kurulum)
3. [Detaylı Kurulum](#detaylı-kurulum)
4. [Veritabanı Kurulumu](#veritabanı-kurulumu)
5. [API Başlatma](#api-başlatma)
6. [Web Arayüzü Kullanımı](#web-arayüzü-kullanımı)
7. [Rota Planlama](#rota-planlama)
8. [Özellikler](#özellikler)
9. [Sorun Giderme](#sorun-giderme)
10. [Geliştirme Notları](#geliştirme-notları)

---

## 🔧 Sistem Gereksinimleri

### Minimum Gereksinimler:
- **Python 3.7+** (3.8+ önerilir)
- **RAM:** 4 GB (8 GB önerilir)
- **Disk Alanı:** 2 GB boş alan
- **İnternet Bağlantısı** (harita tiles ve OSM verileri için)

### Desteklenen Veritabanları:
- **MongoDB** (Önerilen - kolay kurulum)
- **PostgreSQL + PostGIS** (Gelişmiş jeolokasyon özellikleri)
- **JSON Fallback** (Veritabanı olmadan test için)

---

## ⚡ Hızlı Kurulum

### Otomatik Kurulum (Linux/macOS)
```bash
# Tek komutla otomatik kurulum
chmod +x install.sh
./install.sh

# Veya manuel adımlar için aşağıya bakın
```

### Süper Hızlı Başlangıç (2 dakika)
```bash
# 1. Temel paketleri kurun
pip install folium osmnx networkx numpy requests flask flask-cors

# 2. Hemen API'yi başlatın (JSON fallback ile)
python poi_api.py

# 3. Web arayüzünü açın
# Tarayıcıda: http://localhost:5505/poi_manager_ui.html
```

---

## ⚙️ Detaylı Kurulum

### 1. Projeyi İndirin
```bash
# Git ile klonlayın (eğer git repository'si varsa)
git clone [repository-url]
cd poi-management-system

# VEYA dosyaları manuel olarak indirin ve bir klasöre çıkarın
```

### 2. Python Sanal Ortamı Oluşturun (Önerilen)
```bash
# Windows
python -m venv poi_env
poi_env\Scripts\activate

# Linux/Mac
python3 -m venv poi_env
source poi_env/bin/activate
```

### 3. Gerekli Paketleri Kurun
```bash
pip install -r requirements.txt
```

**Eğer requirements.txt çalışmazsa, manuel kurulum:**
```bash
pip install folium>=0.12.0 osmnx>=1.2.0 networkx>=2.6.0 numpy>=1.21.0
pip install flask>=2.0.0 flask-cors>=3.0.0 psycopg2-binary>=2.9.0 pymongo>=4.0.0
pip install requests>=2.25.0 geoalchemy2>=0.11.0 sqlalchemy>=1.4.0
pip install scipy>=1.7.0 pandas>=1.3.0 matplotlib>=3.4.0
```

---

## 🗄️ Veritabanı Kurulumu

### Seçenek A: MongoDB (Önerilen - Kolay)

#### 1. MongoDB Kurulumu:
**Windows:**
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) indirin
- Kurulum sihirbazını takip edin
- MongoDB Compass (GUI) da dahil

**Linux (Ubuntu/Debian):**
```bash
# MongoDB repository ekle
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Kurulum
sudo apt-get update
sudo apt-get install -y mongodb-org

# Başlatma
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Mac:**
```bash
# Homebrew ile
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### 2. MongoDB Veritabanını Hazırlayın:
```bash
python setup_poi_database.py mongodb "mongodb://localhost:27017/" --db-name poi_cappadocia
```

### Seçenek B: PostgreSQL + PostGIS

#### 1. PostgreSQL Kurulumu:
**Windows:**
- [PostgreSQL](https://www.postgresql.org/download/windows/) indirin ve kurun

**Linux:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib postgis
```

#### 2. Veritabanı Oluşturun:
```bash
# PostgreSQL kullanıcısına geçin
sudo -u postgres psql

# Veritabanı ve kullanıcı oluşturun
CREATE DATABASE poi_db;
CREATE USER poi_user WITH ENCRYPTED PASSWORD 'poi_password';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;

# PostGIS uzantısını ekleyin
\c poi_db
CREATE EXTENSION postgis;
\q
```

#### 3. PostgreSQL Veritabanını Hazırlayın:
```bash
python setup_poi_database.py postgresql "postgresql://poi_user:poi_password@localhost/poi_db"
```

### Seçenek C: JSON Fallback (Veritabanı Olmadan)

Hiçbir veritabanı kurmadan test edebilirsiniz:
```bash
# Doğrudan API'yi başlatın - otomatik olarak test_data.json kullanılacak
python poi_api.py
```

---

## 🚀 API Başlatma

### 1. Ortam Değişkenlerini Ayarlayın

**MongoDB için:**
```bash
# Windows
set POI_DB_TYPE=mongodb
set POI_DB_CONNECTION=mongodb://localhost:27017/
set POI_DB_NAME=poi_cappadocia

# Linux/Mac
export POI_DB_TYPE=mongodb
export POI_DB_CONNECTION=mongodb://localhost:27017/
export POI_DB_NAME=poi_cappadocia
```

**PostgreSQL için:**
```bash
# Windows
set POI_DB_TYPE=postgresql
set POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db

# Linux/Mac
export POI_DB_TYPE=postgresql
export POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db
```

**JSON Fallback için (varsayılan):**
```bash
# Hiçbir ortam değişkeni ayarlamayın - otomatik olarak JSON kullanılacak
```

### 2. API Sunucusunu Başlatın
```bash
python poi_api.py
```

**Başarılı olursa şu mesajı göreceksiniz:**
```
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5505
 * Running on http://[your-ip]:5505
```

### 3. Web Arayüzünü Açın
Tarayıcınızda şu adresi açın:
```
http://localhost:5505/poi_manager_ui.html
```

---

## 🖥️ Web Arayüzü Kullanımı

### 🗺️ Harita Özellikleri

#### POI Ekleme:
1. **Yöntem 1:** Haritaya çift tıklayın
2. **Yöntem 2:** "📍 Haritadan Seç" butonuna tıklayın ve haritadan bir nokta seçin
3. Formu doldurun ve "💾 Kaydet" butonuna tıklayın

#### POI'leri Görüntüleme:
- Haritada renkli daireler halinde görüntülenir
- Her kategori farklı renkte:
  - 🍽️ **Gastronomik:** Kırmızı
  - 🏛️ **Kültürel:** Mavi
  - 🎨 **Sanatsal:** Yeşil
  - 🌿 **Doğa & Macera:** Turuncu
  - 🏨 **Konaklama:** Mor

#### Harita Katmanları:
- **Varsayılan:** OpenStreetMap
- **Topoğrafik:** OpenTopoMap
- **Çok Renkli:** CartoDB Voyager
- **Uydu Görüntüsü:** Esri
- **Sade Beyaz:** CartoDB Positron
- **Karanlık Mod:** CartoDB Dark Matter

### 📋 Tablo Özellikleri

#### Arama ve Filtreleme:
- **Arama kutusu:** POI isimlerine göre arama yapın
- **Kategori filtresi:** Dropdown menüden kategori seçin
- **Sıralama:** Sütun başlıklarına tıklayarak sıralayın

#### POI İşlemleri:
- **Detay Görüntüleme:** POI ismine tıklayın
- **Düzenleme:** ✏️ butonuna tıklayın
- **Silme:** 🗑️ butonuna tıklayın

### 📱 Detay Paneli

POI'ye tıkladığınızda sol tarafta açılır:
- POI bilgileri görüntülenir
- "🎯 Haritada Göster" ile haritada odaklanabilirsiniz
- "Düzenle" ve "Sil" butonları ile hızlı işlemler yapabilirsiniz

---

## 🛣️ Rota Planlama

### JSON Verisi ile Rota Planlama (Hızlı)
```bash
# Belirli kategori için optimized rota
python category_route_planner.py gastronomik

# Başlangıç noktası belirterek
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Optimizasyon olmadan (hızlı test)
python category_route_planner.py --no-optimize

# Yükseklik verileri olmadan (daha hızlı)
python category_route_planner.py --no-elevation

# Küçük yarıçap ile test
python category_route_planner.py gastronomik --radius 2
```

### Veritabanı ile Rota Planlama (Dinamik)
```bash
# Veritabanından güncel POI'ler ile rota
python category_route_planner_with_db.py gastronomik

# Çevre değişkenleri ile özelleştirme
export POI_DB_TYPE=mongodb
python category_route_planner_with_db.py kulturel
```

### Rota Özellikleri:
- **TSP Optimizasyonu:** En kısa rota hesaplama
- **Yükseklik Profilleri:** Detaylı yükseklik grafikleri
- **Mesafe Hesaplamaları:** Gerçek yol mesafeleri
- **İnteraktif Haritalar:** Çoklu katman desteği
- **Ölçüm Araçları:** Mesafe ve alan ölçme
- **Responsive Tasarım:** Mobil uyumlu

---

## ✨ Özellikler

### 🔧 Temel Özellikler:
- ✅ POI ekleme, düzenleme, silme
- ✅ Harita üzerinde görselleştirme
- ✅ Kategori bazlı filtreleme
- ✅ Arama ve sıralama
- ✅ Responsive tasarım (mobil uyumlu)
- ✅ JSON fallback sistemi

### 🎨 Gelişmiş Özellikler:
- ✅ **Rota Optimizasyonu:** TSP algoritması ile en kısa rota
- ✅ **Yükseklik Profilleri:** Detaylı yükseklik verileri
- ✅ **Çoklu Harita Katmanları:** 6 farklı görünüm
- ✅ **Performans Önbellekleme:** Akıllı cache sistemi
- ✅ **Otomatik Kurulum:** install.sh scripti
- ✅ **Haritadan konum seçme**
- ✅ **Toast bildirimleri**
- ✅ **Yükleniyor animasyonları**
- ✅ **Detay paneli**
- ✅ **Klavye kısayolları**
- ✅ **Çoklu veritabanı desteği**

### 📊 Desteklenen Veri Alanları:
- **Temel:** Ad, kategori, koordinatlar
- **Opsiyonel:** Açıklama, etiketler, resim URL'si, 3D model
- **Otomatik:** Oluşturma/güncelleme tarihleri, ID'ler

---

## 🔧 Sorun Giderme

### ❌ Yaygın Hatalar ve Çözümleri:

#### 1. "ModuleNotFoundError" Hatası
```bash
# Çözüm: Gerekli paketleri kurun
pip install -r requirements.txt
# veya
pip install folium osmnx flask flask-cors pymongo psycopg2-binary
```

#### 2. Veritabanı Bağlantı Hatası
```bash
# MongoDB için kontrol edin:
mongo --eval "db.runCommand('ping')"

# PostgreSQL için kontrol edin:
pg_isready -h localhost -p 5432

# JSON fallback kullanın:
unset POI_DB_TYPE  # Çevre değişkenlerini temizle
python poi_api.py
```

#### 3. API Başlatma Hatası
```bash
# Port zaten kullanımda ise kontrol edin:
netstat -an | grep 5505
lsof -i :5505

# Farklı port kullanın:
export FLASK_PORT=5506
python poi_api.py
```

#### 4. Harita Yüklenmiyor
- İnternet bağlantınızı kontrol edin
- Tarayıcı konsolunda hata mesajlarını kontrol edin (F12)
- CORS hatası varsa `poi_api.py`'nin çalıştığından emin olun
- Cache klasörünü temizleyin: `rm -rf cache/*`

#### 5. POI'ler Görünmüyor
- Veritabanında veri olup olmadığını kontrol edin:
```bash
# MongoDB için:
mongo poi_cappadocia --eval "db.pois.find().count()"

# PostgreSQL için:
psql -d poi_db -c "SELECT COUNT(*) FROM pois;"

# JSON için test_data.json dosyasını kontrol edin
```

#### 6. Rota Planlama Hatası
```bash
# Cache temizleyin
rm -rf cache/*

# Küçük yarıçap ile test edin
python category_route_planner.py --radius 1

# Optimizasyonsuz test
python category_route_planner.py --no-optimize

# Sistem paketlerini kontrol edin (Linux)
sudo apt-get install libgeos-dev libproj-dev libgdal-dev
```

### 🐛 Debug Modu:
API'yi debug modunda çalıştırın:
```bash
export FLASK_DEBUG=1
export POI_LOG_LEVEL=DEBUG
python poi_api.py
```

---

## 🛠️ Geliştirme Notları

### 📁 Güncel Proje Yapısı:
```
poi-management-system/
├── poi_api.py                          # Flask API sunucusu (5505 portu)
├── poi_manager_ui.html                 # Web arayüzü
├── poi_database_adapter.py             # Veritabanı adaptörü
├── setup_poi_database.py              # Veritabanı kurulum aracı
├── category_route_planner.py           # JSON tabanlı rota planlayıcısı
├── category_route_planner_with_db.py   # Veritabanı tabanlı rota planlayıcısı
├── install.sh                          # Otomatik kurulum scripti
├── requirements.txt                    # Python bağımlılıkları
├── test_data.json                      # Test POI verileri
├── cache/                              # OSM ve yükseklik verileri önbelleği
├── *.graphml                          # OSM yol ağı dosyaları
├── *.html                             # Oluşturulan rota haritaları
├── HIZLI_BASLATMA.md                  # Hızlı başlangıç rehberi
├── POI_YONETIM_REHBERI.md             # Bu dosya
└── README.md                          # Ana dokümantasyon
```

### 🔌 API Uç Noktaları:
- `GET /health` - Sistem sağlık kontrolü
- `GET /api/pois` - Tüm POI'leri listele
- `GET /api/pois?category=X` - Kategori bazlı listele
- `GET /api/pois/nearby?lat=X&lng=Y&radius=Z` - Konum bazlı arama
- `GET /api/poi/<id>` - Tekil POI detayı
- `POST /api/poi` - Yeni POI ekle
- `PUT /api/poi/<id>` - POI güncelle
- `DELETE /api/poi/<id>` - POI sil
- `GET /poi_manager_ui.html` - Web arayüzü

### 🔒 Güvenlik Notları:
- Üretim ortamında `debug=False` yapın
- Güçlü veritabanı şifreleri kullanın
- HTTPS kullanmayı düşünün
- Gerekirse authentication ekleyin
- API rate limiting düşünün

### 📈 Performans İpuçları:
- MongoDB için indeksleri kontrol edin
- Cache klasörünü koruyun (offline çalışma için)
- Büyük veri setleri için sayfalama ekleyin
- Harita tile önbellekleme düşünün
- OSM veri indirmelerini sınırlayın

### 🎯 Yeni Özellikler:
- **Otomatik kurulum scripti** ile kolay setup
- **JSON fallback** ile veritabanısız çalışma
- **Gelişmiş rota optimizasyonu** TSP algoritması ile
- **Çoklu harita katmanları** (6 farklı görünüm)
- **Yükseklik profilleri** ve zorluk hesaplaması
- **Cache sistemi** offline çalışma için

---

## 🎉 Kurulum Tamamlandı!

Artık Kapadokya POI Yönetim Sisteminiz kullanıma hazır! 

### **Hızlı Test Senaryoları:**

#### 1. Web Arayüzü Testi:
```bash
python poi_api.py
# Tarayıcıda: http://localhost:5505/poi_manager_ui.html
# Haritaya çift tıklayarak POI ekleyin
```

#### 2. Rota Planlama Testi:
```bash
python category_route_planner.py gastronomik
# Sonuç: tum_kategoriler_rotasi.html
```

#### 3. API Testi:
```bash
curl http://localhost:5505/health
curl http://localhost:5505/api/pois
```

### **Yardıma mı ihtiyacınız var?**
1. `HIZLI_BASLATMA.md` dosyasını kontrol edin
2. API loglarını kontrol edin
3. Tarayıcı konsolunda hataları kontrol edin (F12)
4. Veritabanı bağlantısını test edin
5. `install.sh` scriptini kullanarak otomatik kurulum yapın

### **Başlangıç Önerileri:**
1. **İlk kez kullanıyorsanız:** JSON fallback ile başlayın
2. **Geliştirici iseniz:** MongoDB ile devam edin  
3. **Production için:** PostgreSQL + PostGIS kullanın
4. **Rota planlama için:** Önce küçük yarıçap ile test edin

**İyi kullanımlar! 🚀 🗺️**