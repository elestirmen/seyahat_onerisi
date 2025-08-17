# Rota Medya Geliştirmeleri - Veritabanı Migrasyonu

## Genel Bakış

Bu migrasyon, rota görsellerini konum bilgileri ile birlikte yönetmek için gerekli veritabanı değişikliklerini uygular.

## Yapılan Değişiklikler

### 1. Yeni `route_media` Tablosu
- Rota fotoğraflarını opsiyonel GPS koordinatları ile saklar
- Küçük önizleme (thumbnail) desteği
- Ana görsel (is_primary) işaretleme sistemi
- Fotoğraf açıklamaları (caption)
- Medya tipi sınıflandırması (photo, promotional, thumbnail, cover)

### 2. `routes` Tablosuna Eklenen Alanlar
- `preview_image`: Hızlı erişim için ana görsel yolu
- `total_distance`: Rota mesafesi (km)
- `difficulty_level`: Zorluk seviyesi (1-5)
- `estimated_duration`: Tahmini süre (dakika)

### 3. Metin Arama Optimizasyonu
- `pg_trgm` uzantısı ile trigram indeksleri
- Rota adı ve açıklamasında hızlı fuzzy search

### 4. Otomatik Fonksiyonlar
- Ana görsel senkronizasyonu
- Tek ana görsel garantisi
- Otomatik güncelleme tetikleyicileri

### 5. Veritabanı Görünümleri
- Ana görselli rotalar görünümü
- Rota bilgili medya görünümü

## Kurulum

### Ön Gereksinimler

```bash
# PostgreSQL contrib paketini yükleyin (pg_trgm için)
sudo apt-get install postgresql-contrib

# Veritabanında pg_trgm uzantısını etkinleştirin
psql poi_db -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

### Migrasyon Çalıştırma

```bash
# Migrasyonu çalıştır
python database_migration_route_media.py

# Sadece doğrulama yap (değişiklik yapmadan)
python database_migration_route_media.py --verify

# Geri alma (dikkatli kullanın!)
python database_migration_route_media.py --rollback
```

### Çevre Değişkenleri

Migrasyon aşağıdaki çevre değişkenlerini kullanır:

```bash
# Öncelikli: Birleşik bağlantı string'i
export POI_DB_CONNECTION="postgresql://user:password@localhost/poi_db"

# Alternatif: Ayrı değişkenler
export POI_DB_HOST="localhost"
export POI_DB_PORT="5432"
export POI_DB_NAME="poi_db"
export POI_DB_USER="poi_user"
export POI_DB_PASSWORD="poi_password"
```

## Kullanım Örnekleri

### Rota Medyası Ekleme

```sql
-- Konum bilgisi ile rota fotoğrafı ekle
INSERT INTO route_media (route_id, file_path, thumbnail_path, lat, lng, caption, is_primary, media_type)
VALUES (1, '/uploads/routes/route1_photo1.jpg', '/uploads/routes/thumbs/route1_photo1_thumb.jpg', 
        38.6322, 34.9115, 'Ürgüp manzarası', TRUE, 'photo');

-- Konum bilgisi olmadan tanıtım görseli ekle
INSERT INTO route_media (route_id, file_path, thumbnail_path, caption, is_primary, media_type)
VALUES (1, '/uploads/routes/route1_promo.jpg', '/uploads/routes/thumbs/route1_promo_thumb.jpg', 
        'Kapadokya Yürüyüş Rotası', FALSE, 'promotional');
```

### Ana Görsel Sorgulama

```sql
-- Rotaların ana görselleri ile birlikte listele
SELECT * FROM routes_with_primary_image WHERE is_active = TRUE;

-- Belirli bir rotanın ana görselini al
SELECT get_route_primary_image(1);
```

### Metin Arama

```sql
-- Trigram ile fuzzy search
SELECT * FROM routes 
WHERE name % 'urgup' OR description % 'urgup'
ORDER BY similarity(name, 'urgup') DESC;
```

### Konum Bazlı Medya Arama

```sql
-- Belirli bir alan içindeki rota fotoğrafları
SELECT rm.*, r.name as route_name
FROM route_media rm
JOIN routes r ON rm.route_id = r.id
WHERE rm.lat BETWEEN 38.6 AND 38.7
AND rm.lng BETWEEN 34.9 AND 35.0;
```

## API Entegrasyonu

### Route Service Güncellemeleri

```python
# RouteService sınıfına yeni metodlar eklenebilir:

def get_route_media(self, route_id: int) -> List[Dict]:
    """Rotanın tüm medya dosyalarını getir"""
    query = """
        SELECT * FROM route_media 
        WHERE route_id = %s 
        ORDER BY is_primary DESC, uploaded_at DESC
    """
    return self._execute_query(query, (route_id,))

def add_route_media(self, route_id: int, media_data: Dict) -> int:
    """Rotaya yeni medya dosyası ekle"""
    query = """
        INSERT INTO route_media (route_id, file_path, thumbnail_path, lat, lng, caption, is_primary)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """
    params = (
        route_id,
        media_data['file_path'],
        media_data.get('thumbnail_path'),
        media_data['lat'],
        media_data['lng'],
        media_data.get('caption'),
        media_data.get('is_primary', False)
    )
    result = self._execute_query(query, params, fetch_one=True)
    return result['id'] if result else None
```

## Güvenlik Notları

1. **Dosya Yolu Doğrulama**: `file_path` alanları için güvenlik kontrolü yapın
2. **Koordinat Sınırları**: Lat/lng değerleri otomatik olarak kontrol edilir
3. **Ana Görsel Garantisi**: Tetikleyici ile otomatik olarak tek ana görsel garantisi
4. **Cascade Silme**: Rota silindiğinde tüm medya dosyaları otomatik silinir

## Performans Notları

1. **İndeks Kullanımı**: Tüm sık kullanılan alanlar için indeks oluşturuldu
2. **Trigram Arama**: Metin arama performansı önemli ölçüde iyileştirildi
3. **Görünüm Kullanımı**: Karmaşık JOIN'ler için hazır görünümler
4. **Otomatik Güncelleme**: Tetikleyiciler ile veri tutarlılığı

## Sorun Giderme

### Migrasyon Hataları

```bash
# Migrasyon durumunu kontrol et
python database_migration_route_media.py --verify

# Hata loglarını kontrol et
tail -f /var/log/postgresql/postgresql-12-main.log
```

### Performans Sorunları

```sql
-- İndeks kullanımını kontrol et
EXPLAIN ANALYZE SELECT * FROM route_media WHERE route_id = 1;

-- Trigram uzantısının aktif olduğunu kontrol et
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

### Veri Tutarlılığı

```sql
-- Ana görsel sayısını kontrol et (her rota için max 1 olmalı)
SELECT route_id, COUNT(*) 
FROM route_media 
WHERE is_primary = TRUE 
GROUP BY route_id 
HAVING COUNT(*) > 1;

-- Önizleme görseli senkronizasyonu
SELECT sync_route_preview_image(route_id) FROM routes WHERE id = 1;
```

## Rollback Prosedürü

⚠️ **DİKKAT**: Rollback işlemi tüm rota medya verilerini siler!

```bash
# Yedek alın
pg_dump poi_db > backup_before_rollback.sql

# Rollback çalıştırın
python database_migration_route_media.py --rollback

# Gerekirse geri yükleyin
psql poi_db < backup_before_rollback.sql
```

## Destek

Migrasyon ile ilgili sorunlar için:
1. Önce `--verify` komutu ile durumu kontrol edin
2. PostgreSQL loglarını inceleyin
3. Veritabanı bağlantı ayarlarını doğrulayın
4. Gerekirse rollback yapıp tekrar deneyin