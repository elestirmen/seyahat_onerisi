# Proje Mimarisi ve Veritabanı Yapısı

Bu döküman, Kapadokya POI Yönetim Sistemi projesindeki ana Python bileşenlerini ve PostgreSQL tabanlı veritabanı tasarımını özetler.

## 1. Genel Akış

1. **Veri Kaynağı**: `poi_database_adapter.py` üzerinden PostgreSQL veritabanı kullanılır. Bağlantı bilgileri ortam değişkenleri (`POI_DB_TYPE`, `POI_DB_CONNECTION`, `POI_DB_NAME`) ile tanımlanır.
2. **API Katmanı**: `poi_api.py` dosyası Flask tabanlı REST API sunar. Bu API, veritabanı adaptörüyle iletişim kurarak POI kayıtlarını ekler, günceller ve listeler.
3. **Rating Sistemi**: Yeni POI puanlama sistemi ile her POI 10 farklı kategoride (tarihi, doğa, yemek vb.) 0-100 arası puanlanabilir.
4. **Web Arayüzü**: `poi_manager_ui.html` ile POI'leri yönetmek, rating'leri güncellemek ve medya eklemek mümkündür.
5. **Migration Sistemi**: `database_migration.py` ile veritabanı şeması otomatik olarak oluşturulur ve güncellenir.
6. **Rota Planlama**: `category_route_planner.py` dosyası, OSMnx kütüphanesi ile rota hesaplar.

Aşağıdaki şema genel akışı göstermektedir:

```
Kullanıcı -> Web UI -> Flask API -> PostgreSQL (Rating Sistemi) -> Rota Planlayıcı -> HTML/JSON Çıktı
```

## 2. Veritabanı Şeması

Temel tablolar aşağıdaki gibidir:

- **pois**: POI temel bilgileri (`name`, `category`, `location`, `altitude`, `description`, `attributes`)
- **poi_ratings**: **YENİ!** Kategori bazında puanlama sistemi (0-100 arası, 10 kategori)
- **poi_images**: Her POI için görseller. `poi_id` alanı `pois` tablosuna bağlıdır.
- **poi_3d_models**: Opsiyonel 3D modeller. `poi_id` alanı `pois` tablosuna bağlıdır.
- **categories**: Kategori tanımları (renk, ikon, açıklama).

### Rating Sistemi (YENİ!)

`poi_ratings` tablosu ile her POI şu kategorilerde puanlanabilir:
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

Tüm coğrafi alanlar PostGIS uzantısı kullanılarak `GEOGRAPHY(POINT, 4326)` tipinde saklanır. Sık sorgulanan kolonlarda GIST indeksleri bulunmaktadır.

## 3. Önemli Python Dosyaları

### 3.1 `poi_database_adapter.py`
- **PostgreSQLPOIDatabase** sınıfı veritabanı bağlantısını yönetir.
- POI ekleme, güncelleme, silme ve arama gibi işlemler için metodlar sağlar.
- `get_poi_ratings` ve `update_poi_ratings` fonksiyonları ile puanlama sistemi yönetilir.

### 3.2 `poi_api.py`
- Flask tabanlı API uç noktaları sağlar.
- **YENİ!** Rating sistemi API'leri (`/api/poi/{id}/ratings`)
- Dosya yükleme ve medya yönetimi için `poi_media_manager.py` kullanılır.
- JSON fallback mekanizması ile veritabanı bağlantısı başarısız olduğunda `test_data.json` kullanılır.

### 3.3 `category_route_planner.py`
- OSMnx üzerinden yol ağı verisini indirir veya önceden indirilen GraphML dosyasını kullanır.
- POI verilerini kategori bazında işleyerek en kısa rotayı hesaplar.
- Sonuçlar Folium ile interaktif HTML haritası olarak oluşturulur.

## 4. Başlangıç ve Kurulum

1. **Otomatik Migration ile Veritabanını Kurmak**:
   ```bash
   python3 database_migration.py postgresql://poi_user:poi_password@localhost/poi_db
   ```

2. **API'yi Başlatmak**:
   ```bash
   # Otomatik başlatma scripti (önerilen)
   ./start_poi_api.sh
   
   # Manuel başlatma
   export POI_DB_TYPE=postgresql
   export POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db
   export POI_DB_NAME=poi_db
   python3 poi_api.py
   ```

3. **Web Arayüzüne Erişim**:
   - Ana sayfa: `http://localhost:5505/`
   - POI Yönetim Paneli: `http://localhost:5505/poi_manager_ui.html`

4. **Rota Planlayıcıyı Kullanmak**:
   ```bash
   python3 category_route_planner.py gastronomik -o rota.html
   ```

## 5. Yeni Özellikler

### Rating Sistemi
- Her POI 10 farklı kategoride puanlanabilir (0-100 arası)
- Web arayüzünde slider'lar ile kolay puanlama
- API üzerinden rating'leri okuma/yazma
- Otomatik rating yükleme ve kaydetme

### Migration Sistemi
- Otomatik veritabanı şeması oluşturma
- Mevcut veritabanlarını güncelleme
- Schema validation ve hata kontrolü
- Güvenli migration işlemleri

### Web Arayüzü İyileştirmeleri
- Modern Bootstrap 5 tasarımı
- Tab-based POI yönetimi
- Gerçek zamanlı rating güncellemeleri
- Medya yönetimi (resim, video, ses, 3D model)

## 6. API Endpoints (Güncel)

### POI Yönetimi
- `GET /api/pois` - Tüm POI'leri listele
- `GET /api/poi/{id}` - POI detaylarını getir
- `POST /api/poi` - Yeni POI ekle
- `PUT /api/poi/{id}` - POI güncelle
- `DELETE /api/poi/{id}` - POI sil

### Rating Sistemi (YENİ!)
- `GET /api/poi/{id}/ratings` - POI rating'lerini getir
- `PUT /api/poi/{id}/ratings` - POI rating'lerini güncelle
- `GET /api/ratings/categories` - Rating kategorilerini listele

### Arama ve Filtreleme
- `GET /api/search?q=terim` - Gelişmiş arama
- `GET /api/pois/by-rating?category=tarihi&min_score=50` - Rating'e göre arama

## 7. Ek Bilgiler

- Detaylı kurulum adımları için `KURULUM_REHBERI.md` dosyasına bakabilirsiniz.
- Yedekleme ve geri yükleme adımları kurulum rehberinde yer alır.

