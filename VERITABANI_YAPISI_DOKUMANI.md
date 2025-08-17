# POI Seyahat Öneri Sistemi - Veritabanı Yapısı Dokümantasyonu

## Genel Bakış

Bu dokuman, POI (Point of Interest) Seyahat Öneri Sistemi'nin PostgreSQL/PostGIS veritabanı yapısını detaylı olarak açıklamaktadır. Sistem, coğrafi konumlar, rotalar, puanlama sistemi ve medya yönetimi için optimize edilmiş bir veritabanı şeması kullanmaktadır.

## Veritabanı Teknolojileri

- **Ana Veritabanı**: PostgreSQL 12+
- **Coğrafi Uzantı**: PostGIS 3.0+
- **Koordinat Sistemi**: WGS84 (EPSG:4326)
- **Bağlantı Havuzu**: psycopg2
- **ORM**: Yok (Raw SQL)

## Tablo Yapısı

### 1. Ana POI Tablosu (`pois`)

POI'lerin (İlgi Çekici Noktalar) temel bilgilerini saklar.

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

**Alanlar:**
- `id`: Benzersiz POI kimliği
- `name`: POI adı (ör: "Ürgüp Müzesi")
- `category`: Kategori kodu (gastronomik, kulturel, sanatsal, doga_macera, konaklama)
- `location`: PostGIS coğrafi konum (lat/lon)
- `altitude`: Rakım (metre)
- `description`: Detaylı açıklama
- `short_description`: Kısa açıklama (500 karakter)
- `attributes`: Ek özellikler (JSON formatında)

**İndeksler:**
```sql
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_poi_active ON pois(is_active);
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
```

### 2. Kategori Tanımları (`categories`)

POI kategorilerinin görsel ve açıklama bilgilerini saklar.

```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    color VARCHAR(7),
    icon VARCHAR(50),
    description TEXT
);
```

**Varsayılan Kategoriler:**
- `gastronomik`: 🍽️ Gastronomik (#e74c3c, utensils)
- `kulturel`: 🏛️ Kültürel (#3498db, landmark)
- `sanatsal`: 🎨 Sanatsal (#2ecc71, palette)
- `doga_macera`: 🌿 Doğa & Macera (#f39c12, hiking)
- `konaklama`: 🏨 Konaklama (#9b59b6, bed)

### 3. POI Puanlama Sistemi (`poi_ratings`)

Her POI için kategori bazlı puanlama sistemi.

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

### 4. POI Görselleri (`poi_images`)

POI'lere ait görsel medya dosyalarını yönetir.

```sql
CREATE TABLE poi_images (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    image_data BYTEA,
    thumbnail_url VARCHAR(500),
    caption VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. POI 3D Modelleri (`poi_3d_models`)

POI'lere ait 3D model dosyalarını saklar.

```sql
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

## Rota Yönetimi Tabloları

### 6. Rotalar (`routes`)

Önceden tanımlanmış seyahat rotalarını saklar.

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
    elevation_resolution INTEGER,
    import_source VARCHAR(50),
    original_filename VARCHAR(255),
    import_metadata JSONB,
    file_waypoints JSONB,
    import_date TIMESTAMP,
    imported_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

**Rota Tipleri:**
- `walking`: Yürüyüş rotası
- `hiking`: Doğa yürüyüşü
- `cycling`: Bisiklet rotası
- `driving`: Araç rotası

### 7. Rota-POI İlişkileri (`route_pois`)

Rotalar ile POI'ler arasındaki ilişkileri tanımlar.

```sql
CREATE TABLE route_pois (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    order_in_route INTEGER NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    estimated_time_at_poi INTEGER DEFAULT 15, -- dakika
    notes TEXT,
    UNIQUE(route_id, poi_id)
);
```

### 8. Rota Puanlamaları (`route_ratings`)

Rotalar için kategori bazlı puanlama sistemi.

```sql
CREATE TABLE route_ratings (
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    category TEXT,
    rating INTEGER CHECK (rating BETWEEN 0 AND 100),
    PRIMARY KEY (route_id, category)
);
```

**Rota Puanlama Kategorileri:**
- `scenic_beauty`: Manzara güzelliği
- `historical`: Tarihi değer
- `cultural`: Kültürel zenginlik
- `family_friendly`: Aile dostu
- `photography`: Fotoğraf çekimi
- `adventure`: Macera seviyesi
- `accessibility`: Erişilebilirlik

## Dosya İçe Aktarma Tabloları

### 9. Rota İçe Aktarmaları (`route_imports`)

GPX, KML dosyalarından rota içe aktarma işlemlerini takip eder.

```sql
CREATE TABLE route_imports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('gpx', 'kml', 'kmz')),
    file_size INTEGER NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash
    import_status VARCHAR(20) DEFAULT 'pending' CHECK (
        import_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),
    error_message TEXT,
    error_details JSONB,
    imported_route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    import_metadata JSONB,
    processing_log JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_by VARCHAR(100)
);
```

### 10. Rota-POI İlişkilendirmeleri (`route_poi_associations`)

Gelişmiş rota-POI ilişkilendirme sistemi.

```sql
CREATE TABLE route_poi_associations (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    distance_from_route DECIMAL(10,2), -- metre
    is_waypoint BOOLEAN DEFAULT FALSE,
    is_mandatory BOOLEAN DEFAULT TRUE,
    estimated_time_at_poi INTEGER DEFAULT 15, -- dakika
    association_type VARCHAR(20) DEFAULT 'suggested' CHECK (
        association_type IN ('suggested', 'manual', 'imported', 'auto_generated')
    ),
    association_score DECIMAL(5,2), -- 0-100 arası relevans skoru
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    UNIQUE(route_id, poi_id)
);
```

### 11. Şema Migrasyonları (`schema_migrations`)

Veritabanı şema değişikliklerini takip eder.

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    migration_version VARCHAR(50) NOT NULL,
    description TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);
```

## Coğrafi Fonksiyonlar

### 1. POI-Rota Mesafe Hesaplama

```sql
CREATE OR REPLACE FUNCTION calculate_poi_route_distance(
    poi_location GEOGRAPHY,
    route_geometry GEOGRAPHY
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_Distance(poi_location, route_geometry);
END;
$$ LANGUAGE plpgsql;
```

### 2. Rota Yakınındaki POI'leri Bulma

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

### 3. İlişkilendirme Skorlarını Güncelleme

```sql
CREATE OR REPLACE FUNCTION update_association_scores(route_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
    route_geom GEOGRAPHY;
BEGIN
    SELECT route_geometry INTO route_geom 
    FROM routes WHERE id = route_id_param;
    
    UPDATE route_poi_associations rpa
    SET association_score = CASE
        WHEN rpa.distance_from_route <= 100 THEN 100
        WHEN rpa.distance_from_route <= 500 THEN 80
        WHEN rpa.distance_from_route <= 1000 THEN 60
        ELSE 40
    END
    WHERE rpa.route_id = route_id_param;
END;
$$ LANGUAGE plpgsql;
```

## Tetikleyiciler (Triggers)

### Otomatik Güncelleme Zamanı

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tablolara uygula
CREATE TRIGGER update_route_imports_updated_at
    BEFORE UPDATE ON route_imports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_poi_associations_updated_at
    BEFORE UPDATE ON route_poi_associations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Performans Optimizasyonları

### Kritik İndeksler

```sql
-- Coğrafi sorgular için
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_routes_geometry ON routes USING GIST(route_geometry);

-- Kategori filtreleme için
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_routes_type ON routes(route_type);

-- Aktif kayıt filtreleme için
CREATE INDEX idx_poi_active ON pois(is_active);
CREATE INDEX idx_routes_active ON routes(is_active);

-- JSON arama için
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
CREATE INDEX idx_routes_waypoints ON routes USING GIN(waypoints);

-- İlişki tabloları için
CREATE INDEX idx_route_pois_route_id ON route_pois(route_id);
CREATE INDEX idx_route_pois_order ON route_pois(route_id, order_in_route);
CREATE INDEX idx_poi_ratings_poi_id ON poi_ratings(poi_id);
```

### Sorgu Optimizasyonları

1. **Yakındaki POI Arama**: GIST indeksi ile ST_DWithin kullanımı
2. **Kategori Filtreleme**: B-tree indeksi ile hızlı kategori araması
3. **JSON Arama**: GIN indeksi ile attributes alanında arama
4. **Rota Geometrisi**: PostGIS optimizasyonları ile coğrafi hesaplamalar

## Veri Bütünlüğü

### Referans Bütünlüğü

- POI silme: CASCADE ile ilgili tüm veriler silinir
- Rota silme: CASCADE ile POI ilişkileri silinir
- Soft delete: `is_active` alanı ile mantıksal silme

### Veri Doğrulama

```sql
-- Koordinat sınırları
ALTER TABLE pois ADD CONSTRAINT valid_coordinates 
CHECK (ST_X(location::geometry) BETWEEN -180 AND 180 
   AND ST_Y(location::geometry) BETWEEN -90 AND 90);

-- Puanlama sınırları
ALTER TABLE poi_ratings ADD CONSTRAINT valid_rating 
CHECK (rating BETWEEN 0 AND 100);

-- Zorluk seviyesi sınırları
ALTER TABLE routes ADD CONSTRAINT valid_difficulty 
CHECK (difficulty_level BETWEEN 1 AND 5);
```

## Kurulum ve Migrasyon

### Veritabanı Kurulumu

```bash
# PostgreSQL ve PostGIS kurulumu
sudo apt-get install postgresql-12 postgresql-12-postgis-3

# Veritabanı oluşturma
createdb poi_db
psql poi_db -c "CREATE EXTENSION postgis;"

# Python bağımlılıkları
pip install psycopg2-binary
```

### Migrasyon Çalıştırma

```bash
# Temel şema kurulumu
python setup_poi_database.py "postgresql://user:password@localhost/poi_db"

# Rota tabloları kurulumu
python setup_routes_database.py

# Admin panel migrasyonu
python database_schema_migration_admin_panel.py
```

## API Entegrasyonu

### Bağlantı Yönetimi

```python
from poi_database_adapter import POIDatabaseFactory

# Veritabanı bağlantısı
db = POIDatabaseFactory.create_database(
    'postgresql',
    connection_string='postgresql://user:password@localhost/poi_db'
)
db.connect()
```

### Örnek Sorgular

```python
# POI arama
pois = db.search_nearby_pois(lat=38.6322, lon=34.9115, radius_meters=1000)

# Kategori bazlı listeleme
cultural_pois = db.get_pois_by_category('kulturel')

# POI detayları
poi_details = db.get_poi_details(poi_id=1)
```

## Güvenlik

### Erişim Kontrolü

- Okuma işlemleri: Herkese açık
- Yazma işlemleri: Kimlik doğrulama gerekli
- Admin işlemleri: Yetki kontrolü

### SQL Injection Koruması

- Parametreli sorgular kullanımı
- Input validasyonu
- Prepared statements

## Yedekleme ve Kurtarma

### Otomatik Yedekleme

```bash
# Günlük yedekleme
pg_dump poi_db > backup_$(date +%Y%m%d).sql

# Coğrafi veriler dahil
pg_dump -Fc poi_db > backup_$(date +%Y%m%d).dump
```

### Kurtarma

```bash
# SQL dosyasından kurtarma
psql poi_db < backup_20231201.sql

# Binary dump'tan kurtarma
pg_restore -d poi_db backup_20231201.dump
```

## Monitoring ve Bakım

### Performans İzleme

```sql
-- Yavaş sorgular
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- İndeks kullanımı
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

### Bakım İşlemleri

```sql
-- İstatistik güncelleme
ANALYZE;

-- Vakumlama
VACUUM ANALYZE;

-- İndeks yeniden oluşturma
REINDEX DATABASE poi_db;
```

Bu dokümantasyon, POI Seyahat Öneri Sistemi'nin veritabanı yapısını kapsamlı olarak açıklamaktadır. Sistem, coğrafi veriler, rotalar, puanlama sistemi ve medya yönetimi için optimize edilmiş bir PostgreSQL/PostGIS altyapısı kullanmaktadır.