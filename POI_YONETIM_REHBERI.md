# 🗺️ POI Yönetim Sistemi - Kurulum ve Kullanım Rehberi

## 📋 İçindekiler
1. [Sistem Gereksinimleri](#sistem-gereksinimleri)
2. [Proje Kurulumu](#proje-kurulumu)
3. [Veritabanı Kurulumu](#veritabanı-kurulumu)
4. [API Başlatma](#api-başlatma)
5. [Web Arayüzü Kullanımı](#web-arayüzü-kullanımı)
6. [Özellikler](#özellikler)
7. [Sorun Giderme](#sorun-giderme)
8. [Geliştirme Notları](#geliştirme-notları)

---

## 🔧 Sistem Gereksinimleri

### Minimum Gereksinimler:
- **Python 3.8+**
- **RAM:** 512 MB
- **Disk Alanı:** 100 MB
- **İnternet Bağlantısı** (harita tiles için)

### Desteklenen Veritabanları:
- **MongoDB** (Önerilen - kolay kurulum)
- **PostgreSQL + PostGIS** (Gelişmiş jeolokasyon özellikleri)

---

## ⚙️ Proje Kurulumu

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
pip install flask flask-cors folium osmnx psycopg2-binary sqlalchemy geoalchemy2 pymongo
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
python setup_poi_database.py mongodb "mongodb://localhost:27017/"
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

---

## 🚀 API Başlatma

### 1. Ortam Değişkenlerini Ayarlayın

**MongoDB için:**
```bash
# Windows
set POI_DB_TYPE=mongodb
set POI_DB_CONNECTION=mongodb://localhost:27017/
set POI_DB_NAME=poi_db

# Linux/Mac
export POI_DB_TYPE=mongodb
export POI_DB_CONNECTION=mongodb://localhost:27017/
export POI_DB_NAME=poi_db
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

### 2. API Sunucusunu Başlatın
```bash
python poi_api.py
```

**Başarılı olursa şu mesajı göreceksiniz:**
```
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://[your-ip]:5000
```

### 3. Web Arayüzünü Açın
Tarayıcınızda şu adresi açın:
```
http://localhost:5000/poi_manager_ui.html
```

**VEYA** `poi_manager_ui.html` dosyasını doğrudan tarayıcınızda açabilirsiniz.

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

## ✨ Özellikler

### 🔧 Temel Özellikler:
- ✅ POI ekleme, düzenleme, silme
- ✅ Harita üzerinde görselleştirme
- ✅ Kategori bazlı filtreleme
- ✅ Arama ve sıralama
- ✅ Responsive tasarım (mobil uyumlu)

### 🎨 Gelişmiş Özellikler:
- ✅ Haritadan konum seçme
- ✅ Toast bildirimleri
- ✅ Yükleniyor animasyonları
- ✅ Detay paneli
- ✅ Klavye kısayolları
- ✅ Çoklu veritabanı desteği

### 📊 Desteklenen Veri Alanları:
- **Temel:** Ad, kategori, koordinatlar
- **Opsiyonel:** Açıklama, etiketler, resim URL'si
- **Otomatik:** Oluşturma/güncelleme tarihleri

---

## 🔧 Sorun Giderme

### ❌ Yaygın Hatalar ve Çözümleri:

#### 1. "ModuleNotFoundError" Hatası
```bash
# Çözüm: Gerekli paketleri kurun
pip install flask flask-cors pymongo psycopg2-binary
```

#### 2. Veritabanı Bağlantı Hatası
```bash
# MongoDB için kontrol edin:
mongo --eval "db.runCommand('ping')"

# PostgreSQL için kontrol edin:
pg_isready -h localhost -p 5432
```

#### 3. API Başlatma Hatası
```bash
# Port zaten kullanımda ise farklı port kullanın:
python poi_api.py --port 5001
```

#### 4. Harita Yüklenmiyor
- İnternet bağlantınızı kontrol edin
- Tarayıcı konsolunda hata mesajlarını kontrol edin (F12)
- CORS hatası varsa `poi_api.py`'nin çalıştığından emin olun

#### 5. POI'ler Görünmüyor
- Veritabanında veri olup olmadığını kontrol edin:
```bash
# MongoDB için:
mongo poi_db --eval "db.pois.find().count()"

# PostgreSQL için:
psql -d poi_db -c "SELECT COUNT(*) FROM pois;"
```

### 🐛 Debug Modu:
API'yi debug modunda çalıştırın:
```python
# poi_api.py dosyasının sonunda:
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

---

## 🛠️ Geliştirme Notları

### 📁 Proje Yapısı:
```
poi-management-system/
├── poi_api.py                 # Flask API sunucusu
├── poi_manager_ui.html        # Web arayüzü
├── poi_database_adapter.py    # Veritabanı adaptörü
├── setup_poi_database.py     # Veritabanı kurulum aracı
├── requirements.txt           # Python bağımlılıkları
└── README.md                  # Bu rehber
```

### 🔌 API Uç Noktaları:
- `GET /api/pois` - Tüm POI'leri listele
- `GET /api/pois?category=X` - Kategori bazlı listele
- `GET /api/poi/<id>` - Tekil POI detayı
- `POST /api/poi` - Yeni POI ekle
- `PUT /api/poi/<id>` - POI güncelle
- `DELETE /api/poi/<id>` - POI sil

### 🔒 Güvenlik Notları:
- Üretim ortamında `debug=False` yapın
- Güçlü veritabanı şifreleri kullanın
- HTTPS kullanmayı düşünün
- Gerekirse authentication ekleyin

### 📈 Performans İpuçları:
- MongoDB için indeksleri kontrol edin
- Büyük veri setleri için sayfalama ekleyin
- Harita tile önbellekleme düşünün

---

## 🎉 Kurulum Tamamlandı!

Artık POI Yönetim Sisteminiz kullanıma hazır! 

**Hızlı Test:**
1. http://localhost:5000/poi_manager_ui.html adresini açın
2. Haritaya çift tıklayarak bir POI ekleyin
3. Tabloda görüntülediğinizi kontrol edin

**Yardıma mı ihtiyacınız var?**
- API loglarını kontrol edin
- Tarayıcı konsolunda hataları kontrol edin
- Veritabanı bağlantısını test edin

**İyi kullanımlar! 🚀**