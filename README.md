# 🏺 Kapadokya Rota Planlayıcısı

Kapadokya bölgesindeki ilgi noktaları (POI) arasında optimize edilmiş rotalar oluşturan gelişmiş Python uygulaması. Ürgüp merkez odaklı bu sistem, turistik yerleri kategorize ederek interaktif haritalar ve detaylı rota planları sunar.

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

## 🚀 Hızlı Başlangıç

### Kurulum

```bash
# Depoyu klonlayın
git clone <repo-url>
cd seyahat_onerisi

# Bağımlılıkları kurun
pip install -r requirements.txt
```

### Temel Kullanım

```bash
# Tüm kategoriler için optimize edilmiş rotalar
python category_route_planner.py

# Belirli kategori için rota
python category_route_planner.py gastronomik

# Başlangıç noktası belirleyerek
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Optimizasyon olmadan basit rota
python category_route_planner.py --no-optimize

# Yükseklik verisi olmadan
python category_route_planner.py --no-elevation
```

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

Detaylı veritabanı tasarımı için `poi_database_design.md` dosyasını inceleyin. Şema şunları içerir:

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

### Katkı Alanları
- Yeni POI verilerinin eklenmesi
- Harita stil iyileştirmeleri
- Performans optimizasyonları
- Dokümantasyon güncellemeleri
- Çoklu dil desteği
- Test case yazımı

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasını inceleyin.

## 👥 Geliştiriciler

- **Proje Sahibi**: [İsim]
- **Katkıda Bulunanlar**: [GitHub Contributors]

## 📞 İletişim

- **GitHub**: [Repository URL]
- **E-posta**: [İletişim e-postası]
- **Dokümantasyon**: [Dokümantasyon linki]

## 🙏 Teşekkürler

Bu proje aşağıdaki açık kaynak projeleri kullanmaktadır:

- [OpenStreetMap](https://www.openstreetmap.org/) - Açık harita verileri
- [Folium](https://python-visualization.github.io/folium/) - Python harita kütüphanesi
- [OSMnx](https://osmnx.readthedocs.io/) - Ağ analiz kütüphanesi
- [Open-Meteo](https://open-meteo.com/) - Ücretsiz hava durumu API'si

---

⭐ **Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**

