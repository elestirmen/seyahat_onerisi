# POI Yönetim Sistemi - Kurulum Rehberi

Bu rehber, POI Yönetim Sistemi'ni yeni bir sunucuya kurmanız için gerekli tüm adımları içerir.

## 📋 Sistem Gereksinimleri

- **İşletim Sistemi**: Linux (Ubuntu 20.04+ önerilir)
- **Python**: 3.8+
- **PostgreSQL**: 12+
- **PostGIS**: 3.0+
- **RAM**: Minimum 2GB
- **Disk**: Minimum 5GB boş alan

## 🗄️ Veritabanı Yapısı

### Ana Tablolar

```sql
-- POI ana tablosu
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

-- Kategori tanımları
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    color VARCHAR(7),
    icon VARCHAR(50),
    description TEXT
);

-- POI puanlama sistemi (YENİ!)
CREATE TABLE poi_ratings (
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    category TEXT,
    rating INTEGER CHECK (rating BETWEEN 0 AND 100),
    PRIMARY KEY (poi_id, category)
);

-- POI görselleri
CREATE TABLE poi_images (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    image_data BYTEA,
    thumbnail_url VARCHAR(500),
    caption VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- POI 3D modelleri
CREATE TABLE poi_3d_models (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    model_format VARCHAR(50),
    model_url VARCHAR(500),
    model_data BYTEA,
    preview_image_url VARCHAR(500),
    scale JSONB,
    rotation JSONB,
    position_offset JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### İndeksler

```sql
-- Performans için gerekli indeksler
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_poi_active ON pois(is_active);
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
CREATE INDEX idx_poi_ratings_poi_id ON poi_ratings(poi_id);
CREATE INDEX idx_poi_ratings_category ON poi_ratings(category);
```

## 🚀 Kurulum Adımları

### 1. Sistem Güncellemesi

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. PostgreSQL ve PostGIS Kurulumu

```bash
# PostgreSQL kurulumu
sudo apt install postgresql postgresql-contrib -y

# PostGIS kurulumu
sudo apt install postgis postgresql-14-postgis-3 -y

# PostgreSQL servisini başlat
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Veritabanı Kullanıcısı ve Veritabanı Oluşturma

```bash
# PostgreSQL kullanıcısına geç
sudo -u postgres psql

# Veritabanı kullanıcısı oluştur
CREATE USER poi_user WITH PASSWORD 'poi_password';

# Veritabanı oluştur
CREATE DATABASE poi_db OWNER poi_user;

# PostGIS uzantısını etkinleştir
\c poi_db
CREATE EXTENSION postgis;

# Kullanıcıya yetki ver
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
GRANT ALL ON SCHEMA public TO poi_user;

# Çıkış
\q
```

### 4. Python Bağımlılıkları

```bash
# Python ve pip kurulumu
sudo apt install python3 python3-pip python3-venv -y

# Proje dizinine git
cd /opt/rehber/seyahat_onerisi

# Virtual environment oluştur
python3 -m venv poi_env

# Virtual environment'ı aktif et
source poi_env/bin/activate

# Gerekli paketleri kur
pip install flask flask-cors psycopg2-binary folium osmnx geopandas
```

### 5. Proje Dosyalarını Kopyalama

Aşağıdaki dosyaları proje dizinine kopyalayın:

**Ana Dosyalar:**
- `poi_api.py` - Flask API servisi
- `poi_database_adapter.py` - Veritabanı adaptörü
- `database_migration.py` - Veritabanı migration sistemi
- `poi_manager_ui.html` - Web arayüzü
- `start_poi_api.sh` - Başlatma scripti

**Yardımcı Dosyalar:**
- `setup_database_env.py` - Veritabanı test scripti
- `category_route_planner.py` - Rota planlayıcı
- `poi_media_manager.py` - Medya yöneticisi

### 6. Veritabanı Migration

```bash
# Virtual environment'ı aktif et
source poi_env/bin/activate

# Migration scriptini çalıştır
python3 database_migration.py "postgresql://poi_user:poi_password@localhost/poi_db"

# Veritabanı bağlantısını test et
python3 setup_database_env.py
```

### 7. Ortam Değişkenlerini Ayarlama

```bash
# Başlatma scriptini çalıştırılabilir yap
chmod +x start_poi_api.sh

# Ortam değişkenlerini ayarla (opsiyonel - script otomatik ayarlar)
export POI_DB_TYPE=postgresql
export POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db
export POI_DB_NAME=poi_db
```

### 8. Servisi Başlatma

```bash
# API'yi başlat
./start_poi_api.sh

# Veya manuel başlatma
source poi_env/bin/activate
export POI_DB_TYPE=postgresql
export POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db
export POI_DB_NAME=poi_db
python3 poi_api.py
```

## 🌐 Erişim

Kurulum tamamlandıktan sonra:

- **API**: `http://localhost:5505/`
- **POI Yönetim Paneli**: `http://localhost:5505/poi_manager_ui.html`
- **API Dokümantasyonu**: `http://localhost:5505/` (ana sayfa)

## 🔧 Yapılandırma

### Veritabanı Bağlantısı

`poi_api.py` dosyasında veya ortam değişkenlerinde:

```python
POI_DB_TYPE = 'postgresql'
POI_DB_CONNECTION = 'postgresql://poi_user:poi_password@localhost/poi_db'
POI_DB_NAME = 'poi_db'
```

### Port Ayarları

API varsayılan olarak `5505` portunda çalışır. Değiştirmek için `poi_api.py` dosyasının sonundaki:

```python
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5505, debug=True)
```

## 🔄 Yedekleme ve Geri Yükleme

### Veritabanı Yedeği

```bash
# Yedek alma
pg_dump -h localhost -U poi_user -d poi_db > poi_backup.sql

# Geri yükleme
psql -h localhost -U poi_user -d poi_db < poi_backup.sql
```

### Medya Dosyaları

```bash
# Medya klasörünü yedekle
tar -czf media_backup.tar.gz uploads/
```

## 🐛 Sorun Giderme

### Veritabanı Bağlantı Sorunları

```bash
# PostgreSQL durumunu kontrol et
sudo systemctl status postgresql

# Bağlantıyı test et
psql -h localhost -U poi_user -d poi_db -c "SELECT version();"
```

### API Sorunları

```bash
# Logları kontrol et
tail -f api.log

# Port kullanımını kontrol et
netstat -tlnp | grep 5505
```

### Migration Sorunları

```bash
# Schema durumunu kontrol et
python3 database_migration.py "postgresql://poi_user:poi_password@localhost/poi_db" --dry-run

# Manuel migration
python3 -c "
from database_migration import DatabaseMigration
migration = DatabaseMigration('postgresql://poi_user:poi_password@localhost/poi_db')
result = migration.run_migration()
print('Migration result:', result.success)
"
```

## 📊 Rating Sistemi

### Rating Kategorileri

Sistem şu rating kategorilerini destekler:

- **Tarihi** (0-100): Tarihi önem ve değer
- **Sanat & Kültür** (0-100): Sanatsal ve kültürel değer  
- **Doğa** (0-100): Doğal güzellik ve çevre
- **Eğlence** (0-100): Eğlence ve aktivite değeri
- **Alışveriş** (0-100): Alışveriş olanakları
- **Spor** (0-100): Spor aktiviteleri
- **Macera** (0-100): Macera ve heyecan
- **Rahatlatıcı** (0-100): Huzur ve dinlendirici
- **Yemek** (0-100): Gastronomi ve lezzet
- **Gece Hayatı** (0-100): Gece eğlencesi

### Rating API'leri

```bash
# POI rating'lerini getir
GET /api/poi/{id}/ratings

# POI rating'lerini güncelle
PUT /api/poi/{id}/ratings
Content-Type: application/json
{
  "ratings": {
    "tarihi": 90,
    "doga": 85,
    "yemek": 95
  }
}
```

## 🔒 Güvenlik

### Firewall Ayarları

```bash
# Sadece gerekli portları aç
sudo ufw allow 5505/tcp
sudo ufw allow 5432/tcp  # PostgreSQL (sadece local erişim için)
```

### Veritabanı Güvenliği

```bash
# PostgreSQL yapılandırmasını güvenli hale getir
sudo nano /etc/postgresql/14/main/postgresql.conf
# listen_addresses = 'localhost'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# local   all   poi_user   md5
```

## 📈 Performans Optimizasyonu

### PostgreSQL Ayarları

```sql
-- Performans için ayarlar
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
SELECT pg_reload_conf();
```

### İndeks Optimizasyonu

```sql
-- İndeks kullanımını kontrol et
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'pois';
```

Bu rehber ile POI Yönetim Sistemi'ni herhangi bir Linux sunucusuna başarıyla kurabilirsiniz.