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

## 🚀 Ubuntu Sunucuda Kapsamlı Kurulum Rehberi

### 1. Sistem Güncellemesi
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Gerekli Sistem Paketlerini Kurun
```bash
sudo apt install python3 python3-pip python3-venv postgresql postgresql-contrib postgis build-essential libpq-dev -y
```

### 3. PostgreSQL’i Yapılandırın
```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql
```
Açılan psql konsolunda:
```sql
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'strongpassword';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
\c poi_db
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

### 4. Proje Dosyalarını Sunucuya Aktarın
```bash
cd /path/to/proje_klasoru
```

### 5. Python Ortamı Kurulumu
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 6. Veritabanı Tablolarını ve Örnek Verileri Kurun
```bash
python setup_poi_database.py "postgresql://poi_user:strongpassword@localhost/poi_db"
```

### 7. Uygulamayı Çalıştırma
```bash
python poi_api.py
# veya
python category_route_planner_with_db.py --db-type postgresql --db-connection "postgresql://poi_user:strongpassword@localhost/poi_db"
```

### 8. Kısa Test
```bash
python category_route_planner_with_db.py --db-type postgresql --db-connection "postgresql://poi_user:strongpassword@localhost/poi_db"
```
Çıktı olarak `tum_kategoriler_optimized_rotasi.html` dosyası oluşmalı.

### 9. Sık Karşılaşılan Sorunlar
- **psycopg2-binary hatası:**  `libpq-dev` ve `build-essential` kurulu olmalı.
- **PostGIS uzantısı hatası:**  `CREATE EXTENSION postgis;` komutunu veritabanında manuel çalıştırın.
- **Bağlantı hatası:**  Bağlantı stringindeki kullanıcı adı, şifre ve veritabanı adını kontrol edin.
- **Port hatası:**  PostgreSQL’in 5432 portunda çalıştığından ve güvenlik duvarının izin verdiğinden emin olun.

---

## 💽 Veritabanı Kurulumu (Sadece PostgreSQL)

```bash
python setup_poi_database.py "postgresql://poi_user:strongpassword@localhost/poi_db"
```
- Bu komut, gerekli tabloları oluşturur ve 30’a yakın örnek POI kaydını ekler.

```bash
python category_route_planner_with_db.py --db-type postgresql --db-connection "postgresql://poi_user:strongpassword@localhost/poi_db"
```

---

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

