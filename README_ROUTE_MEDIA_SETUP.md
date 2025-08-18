# 🎬 Rota Medya Yönetimi Kurulum Rehberi

Bu rehber, Route Management sayfasındaki gelişmiş medya yönetimi özelliğini aktif etmek için gerekli adımları açıklar.

## 📋 Gereksinimler

- Python 3.7+
- Flask web framework
- PIL (Pillow) kütüphanesi
- PostgreSQL veritabanı (opsiyonel, JSON fallback mevcut)

## 🚀 Kurulum Adımları

### 1. Backend Güncellemeleri

#### A) `poi_api.py` Güncellemesi
Rota medya yönetimi endpoint'leri zaten eklenmiştir:

- `POST /api/admin/routes/<route_id>/media` - Medya yükleme
- `GET /api/admin/routes/<route_id>/media` - Medya listesi
- `DELETE /api/admin/routes/<route_id>/media/<media_id>` - Medya silme

#### B) `poi_media_manager.py` Güncellemesi
Rota medya yönetimi fonksiyonları zaten eklenmiştir:

- `add_route_media()` - Rota'ya medya ekleme
- `get_route_media()` - Rota medya listesi
- `delete_route_media()` - Rota medya silme

### 2. Frontend Güncellemeleri

`route_manager_enhanced.html` dosyası zaten güncellenmiştir:

- ✅ Gelişmiş medya yükleme modal'ı
- ✅ Koordinat yönetimi
- ✅ Medya türü tespiti
- ✅ Dosya boyutu validasyonu
- ✅ Hata yönetimi

## 🔧 Aktif Etme

### 1. Backend'i Yeniden Başlatın

```bash
# Mevcut Flask uygulamasını durdurun (Ctrl+C)
# Sonra yeniden başlatın
python poi_api.py
```

### 2. Test Edin

```bash
# Test script'ini çalıştırın
python test_route_media_endpoints.py
```

## 📁 Klasör Yapısı

Rota medya dosyaları şu yapıda saklanır:

```
poi_media/
├── by_route_id/
│   └── {route_id}/
│       ├── images/
│       ├── videos/
│       ├── audio/
│       └── 3d_models/
├── thumbnails/
│   └── by_route_id/
│       └── {route_id}/
└── previews/
    └── by_route_id/
        └── {route_id}/
```

## 🎯 Özellikler

### Medya Türleri
- **Görseller**: JPG, PNG, GIF, WebP (Max: 15MB)
- **Videolar**: MP4, AVI, MOV, WebM (Max: 100MB)
- **Ses**: MP3, WAV, OGG, M4A, AAC, FLAC (Max: 50MB)
- **3D Modeller**: GLB, GLTF, OBJ, FBX, DAE, PLY, STL (Max: 50MB)

### Koordinat Yönetimi
- Manuel koordinat girişi
- Haritadan koordinat seçimi
- GPS konum tespiti
- Rota geometrisinden koordinat kopyalama

### Medya Yönetimi
- Otomatik medya türü tespiti
- Dosya boyutu validasyonu
- Thumbnail ve preview oluşturma
- WebP dönüşümü (görseller için)
- Primary media designation

## 🧪 Test

### 1. Endpoint Testleri
```bash
python test_route_media_endpoints.py
```

### 2. Manuel Test
1. Route Management sayfasını açın
2. Bir rota seçin
3. "Medya Ekle" butonuna tıklayın
4. Dosya seçin ve koordinat girin
5. "Medya Yükle ve Konum Belirle" butonuna tıklayın

## ⚠️ Sorun Giderme

### 404 Hatası
```
GET https://harita.urgup.keenetic.link/api/admin/routes/153/media 404 (Not Found)
```

**Çözüm:**
1. Backend'i yeniden başlatın
2. `poi_api.py` dosyasında rota medya endpoint'lerinin eklendiğinden emin olun
3. Test script'ini çalıştırın

### Medya Yükleme Hatası
```
Error uploading media: 'POIMediaManager' object has no attribute 'add_route_media'
```

**Çözüm:**
1. `poi_media_manager.py` dosyasında rota medya fonksiyonlarının eklendiğinden emin olun
2. Backend'i yeniden başlatın

### Klasör Oluşturma Hatası
```
PermissionError: [Errno 13] Permission denied
```

**Çözüm:**
1. `poi_media` klasörüne yazma izni verin
2. Klasör yolunu kontrol edin

## 🔄 Güncelleme

### Yeni Medya Türü Ekleme
1. `poi_media_manager.py` dosyasında `SUPPORTED_FORMATS` sözlüğüne ekleyin
2. Gerekli işleme fonksiyonlarını ekleyin
3. Frontend'de desteklenen formatlar listesini güncelleyin

### Yeni Endpoint Ekleme
1. `poi_api.py` dosyasında yeni route tanımlayın
2. Gerekli validasyon ve işleme mantığını ekleyin
3. Frontend'de yeni fonksiyonaliteyi entegre edin

## 📚 API Dokümantasyonu

### Medya Yükleme
```http
POST /api/admin/routes/{route_id}/media
Content-Type: multipart/form-data

Form Data:
- media: Dosya
- caption: Açıklama (opsiyonel)
- is_primary: Ana medya (true/false)
- lat: Enlem
- lng: Boylam
```

### Medya Listesi
```http
GET /api/admin/routes/{route_id}/media
```

### Medya Silme
```http
DELETE /api/admin/routes/{route_id}/media/{media_id}
```

## 🎉 Başarı!

Rota medya yönetimi başarıyla aktif edildikten sonra:

- ✅ Görsel yükleme çalışacak
- ✅ Koordinat yönetimi aktif olacak
- ✅ Medya türü tespiti çalışacak
- ✅ Dosya boyutu validasyonu aktif olacak
- ✅ Thumbnail ve preview'lar oluşturulacak

## 📞 Destek

Sorun yaşıyorsanız:
1. Test script'ini çalıştırın
2. Backend log'larını kontrol edin
3. Klasör izinlerini kontrol edin
4. Gerekli kütüphanelerin yüklü olduğundan emin olun
