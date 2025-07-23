# Proje Mimarisi ve Veritabanı Yapısı

Bu döküman, Kapadokya Rota Planlayıcısı projesindeki ana Python bileşenlerini ve PostgreSQL tabanlı veritabanı tasarımını özetler.

## 1. Genel Akış

1. **Veri Kaynağı**: `poi_database_adapter.py` üzerinden PostgreSQL veritabanı kullanılır. Bağlantı bilgileri ortam değişkenleri (`POI_DB_TYPE`, `POI_DB_CONNECTION`, `POI_DB_NAME`) ile tanımlanır.
2. **API Katmanı**: `poi_api.py` dosyası Flask tabanlı REST API sunar. Bu API, veritabanı adaptörüyle iletişim kurarak POI kayıtlarını ekler, günceller ve listeler.
3. **Rota Planlama**: `category_route_planner.py` ve `category_route_planner_with_db.py` dosyaları, OSMnx kütüphanesi ile rota hesaplar. POI verilerini doğrudan Python sözlüklerinden veya veritabanından alır.
4. **Veri Kurulumu**: `setup_poi_database.py` başlangıç POI verilerini veritabanına yükler ve gerekli tabloları oluşturur.

Aşağıdaki şema genel akışı göstermektedir:

```
Kullanıcı -> Flask API -> POI Veritabanı -> Rota Planlayıcı -> HTML/JSON Çıktı
```

## 2. Veritabanı Şeması

Veritabanı tasarımının detayları `poi_database_design.md` dosyasında yer alır. Temel tablolar aşağıdaki gibidir:

- **pois**: POI temel bilgileri (`name`, `category`, `location`, `altitude`, `description`, `attributes`)
- **poi_images**: Her POI için görseller. `poi_id` alanı `pois` tablosuna bağlıdır.
- **poi_3d_models**: Opsiyonel 3D modeller. `poi_id` alanı `pois` tablosuna bağlıdır.
- **poi_ratings**: Kategori bazında puanlama sistemi.
- **categories**: Kategori tanımları (renk, ikon, açıklama).

Tüm coğrafi alanlar PostGIS uzantısı kullanılarak `GEOGRAPHY(POINT, 4326)` tipinde saklanır. Sık sorgulanan kolonlarda GIST indeksleri bulunmaktadır.

## 3. Önemli Python Dosyaları

### 3.1 `poi_database_adapter.py`
- **PostgreSQLPOIDatabase** sınıfı veritabanı bağlantısını yönetir.
- POI ekleme, güncelleme, silme ve arama gibi işlemler için metodlar sağlar.
- `get_poi_ratings` ve `update_poi_ratings` fonksiyonları ile puanlama sistemi yönetilir.

### 3.2 `poi_api.py`
- Flask tabanlı API uç noktaları sağlar.
- Dosya yükleme ve medya yönetimi için `poi_media_manager.py` kullanılır.
- JSON fallback mekanizması ile veritabanı bağlantısı başarısız olduğunda `test_data.json` kullanılır.

### 3.3 `category_route_planner.py`
- OSMnx üzerinden yol ağı verisini indirir veya önceden indirilen GraphML dosyasını kullanır.
- POI verilerini kategori bazında işleyerek en kısa rotayı hesaplar.
- Sonuçlar Folium ile interaktif HTML haritası olarak oluşturulur.

## 4. Başlangıç ve Kurulum

1. Veritabanını kurmak için:
   ```bash
   python setup_poi_database.py postgresql://kullanici:sifre@localhost/poi_db
   ```
2. API'yi çalıştırmak için:
   ```bash
   export POI_DB_TYPE=postgresql
   export POI_DB_CONNECTION=postgresql://kullanici:sifre@localhost/poi_db
   python poi_api.py
   ```
3. Rota planlayıcıyı kullanmak için:
   ```bash
   python category_route_planner_with_db.py gastronomik -o rota.html
   ```

## 5. Ek Bilgiler

- Ayrıntılı veritabanı sorguları ve tablo açıklamaları için `poi_database_design.md` dosyasına bakabilirsiniz.
- Yedekleme ve geri yükleme adımları `YEDEKLEME_REHBERI.md` içerisinde yer alır.

