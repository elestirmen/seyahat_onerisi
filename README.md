# 🗺️ Ürgüp Seyahat Öneri Sistemi

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Ürgüp bölgesi için geliştirilmiş, Points of Interest (POI) yönetimi, rota planlama ve seyahat önerileri sunan kapsamlı bir web platformudur. Bu sistem, turistlerin Ürgüp'ü keşfetmesine yardımcı olmak için tasarlanmıştır.

## 🌟 Özellikler

### 🎯 Ana Özellikler
- **POI Yönetimi**: Restoranlar, oteller, turistik yerler ve aktiviteler için kapsamlı veri yönetimi
- **Akıllı Rota Planlama**: Kategori bazlı, özelleştirilebilir rota oluşturma
- **Çoklu Veritabanı Desteği**: JSON, MongoDB, PostgreSQL + PostGIS
- **Medya Yönetimi**: POI'lar için fotoğraf ve video desteği
- **WebSocket Desteği**: Gerçek zamanlı veri güncellemeleri
- **Admin Paneli**: Gelişmiş yönetim arayüzü
- **API Desteği**: RESTful API ile entegrasyon imkanı

### 🗺️ Harita ve Navigasyon
- **OpenStreetMap Entegrasyonu**: Folium tabanlı interaktif haritalar
- **Rota Görselleştirme**: GPX, KML dosya formatları desteği
- **Yükseklik Verileri**: Rota planlamada yükseklik faktörü
- **Çoklu Katman Desteği**: Farklı harita katmanları ve görünümler

### 🤖 AI ve Öneri Sistemi
- **Akıllı POI Önerileri**: Makine öğrenmesi tabanlı öneri algoritması
- **Kategori Optimizasyonu**: Otomatik kategori sınıflandırması
- **Performans Optimizasyonu**: Veritabanı sorgu optimizasyonları

## 🚀 Hızlı Başlangıç

### Sistem Gereksinimleri
- **Python**: 3.7 veya üzeri
- **İşletim Sistemi**: Linux, macOS, Windows
- **RAM**: Minimum 4GB (önerilen 8GB+)
- **Disk**: Minimum 2GB boş alan
- **Sunucu**: PostgreSQL + PostGIS (önerilen)

### Otomatik Kurulum (Önerilen)

```bash
# Projeyi klonlayın
git clone <repository-url>
cd kapadokya-poi-sistemi

# Kurulum scriptini çalıştırın
chmod +x install.sh
./install.sh
```

### Manuel Kurulum

#### 1. Python Sanal Ortamı Oluşturun
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# veya
venv\Scripts\activate     # Windows
```

#### 2. Bağımlılıkları Kurun
```bash
pip install -r requirements.txt
```

#### 3. Veritabanını Yapılandırın
```bash
# JSON dosyası (hızlı başlangıç)
python setup_poi_database.py json

# MongoDB
python setup_poi_database.py mongodb "mongodb://localhost:27017/"

# PostgreSQL + PostGIS
python setup_poi_database.py postgresql "postgresql://user:password@localhost/dbname"
```

#### 4. Sistemi Başlatın
```bash
# Rota planlayıcı
python category_route_planner.py

# POI API
python poi_api.py

# WSGI sunucu
python wsgi.py
```

## 📁 Proje Yapısı

```
seyahat-onerisi-sistemi/
├── 📋 requirements.txt        # Python bağımlılıkları
├── 🐍 poi_api.py             # Ana Flask uygulaması ve REST API
├── 🐍 category_route_planner.py # Akıllı rota planlama algoritması
├── 🐍 poi_database_adapter.py # Veritabanı adaptörü
├── 🐍 route_service.py       # Rota servis katmanı
├── 🐍 route_file_parser.py   # GPX/KML dosya işleyici
├── 🐍 poi_media_manager.py   # Medya yönetim sistemi
├── 🐍 elevation_service.py   # Yükseklik servisleri
├── 🐍 auth_middleware.py     # Kimlik doğrulama sistemi
├── 📁 static/                # Statik dosyalar
│   ├── 📁 css/              # Stil dosyaları
│   ├── 📁 js/               # JavaScript dosyaları
│   └── 📁 poi-tabs/         # POI sekmeleri
├── 📁 poi_media/            # POI medya dosyaları
├── 📁 poi_images/           # POI görselleri
├── 📁 temp_uploads/         # Geçici yüklemeler
├── 📁 tests/                # Test dosyaları
├── 📁 scripts/              # Yardımcı scriptler
├── 📁 perf/                 # Performans testleri
├── 📁 .qoder/               # Geliştirme görevleri
├── 📁 .kiro/                # Teknik spesifikasyonlar
├── 📁 SAFE_DELETE/          # Yedekleme arşivi
└── 📖 README.md             # Bu dosya
```

## 🔧 Yapılandırma

### Çevre Değişkenleri

`.env` dosyası oluşturun:

```bash
# Veritabanı Yapılandırması
POI_DB_TYPE=postgresql  # json, mongodb, postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=your_password
POI_DB_CONNECTION=postgresql://user:password@localhost/dbname

# Flask Yapılandırması
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your_secret_key

# Sunucu Yapılandırması
HOST=0.0.0.0
PORT=5505

# Cache Yapılandırması
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300
```

### Veritabanı Seçenekleri

#### 1. JSON Dosyası (Hızlı Başlangıç)
- **Avantajlar**: Kurulum gerektirmez, hızlı başlangıç
- **Dezavantajlar**: Sınırlı performans, eşzamanlı erişim yok
- **Kullanım**: Küçük projeler ve test için ideal

#### 2. MongoDB
- **Avantajlar**: Esnek şema, JSON benzeri veri yapısı
- **Dezavantajlar**: Coğrafi sorgular için ek kurulum gerekir
- **Kullanım**: Orta ölçekli projeler

#### 3. PostgreSQL + PostGIS (Önerilen)
- **Avantajlar**: Güçlü coğrafi sorgular, ACID uyumluluğu
- **Dezavantajlar**: Kurulum karmaşıklığı
- **Kullanım**: Üretim ortamları ve büyük projeler

## 🚀 Kullanım

### Rota Planlayıcı

#### Temel Kullanım
```bash
# Tüm kategorilerde rota oluştur
python category_route_planner.py

# Belirli kategoride rota oluştur
python category_route_planner.py gastronomik

# Başlangıç noktası belirle
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Maksimum mesafe belirle
python category_route_planner.py aktivite --radius 5

# Yükseklik verilerini dahil et
python category_route_planner.py dogal --elevation

# Çıktı formatını belirle
python category_route_planner.py gastronomik -o rota.html
```

#### Gelişmiş Seçenekler
```bash
# Yardım menüsü
python category_route_planner.py --help

# Detaylı çıktı
python category_route_planner.py --verbose

# Belirli saat aralığında planla
python category_route_planner.py --time-start "09:00" --time-end "18:00"

# Bütçe sınırı ekle
python category_route_planner.py --max-budget 500
```

### POI Yönetimi

#### Web Arayüzü
```bash
# POI API'yi başlat
python poi_api.py

# Tarayıcıda aç
http://localhost:5505/poi_recommendation_system.html
```

#### API Endpoints
```bash
# POI listesi
GET /api/pois

# POI detayı
GET /api/pois/{poi_id}

# POI oluştur
POST /api/pois

# POI güncelle
PUT /api/pois/{poi_id}

# POI sil
DELETE /api/pois/{poi_id}
```

### Medya Yönetimi

#### Fotoğraf Yükleme
```bash
# Tek fotoğraf
curl -X POST -F "file=@photo.jpg" http://localhost:5505/api/pois/{poi_id}/media

# Çoklu fotoğraf
curl -X POST -F "files[]=@photo1.jpg" -F "files[]=@photo2.jpg" http://localhost:5505/api/pois/{poi_id}/media
```

#### Video Yükleme
```bash
# Video yükleme
curl -X POST -F "file=@video.mp4" http://localhost:5505/api/pois/{poi_id}/media
```

## 🧪 Test

### Test Çalıştırma
```bash
# Tüm testleri çalıştır
python run_all_tests.py

# Belirli test kategorisi
python -m pytest tests/test_api_core.py

# Performans testleri
python -m pytest perf/
```

### Test Kapsamı
- **API Testleri**: Endpoint fonksiyonalitesi
- **Entegrasyon Testleri**: Sistem bileşenleri arası etkileşim
- **Performans Testleri**: Yük testleri ve optimizasyon
- **Frontend Testleri**: Kullanıcı arayüzü testleri

## 📊 API Dokümantasyonu

### API Dokümantasyonu
API dokümantasyonu sistem içinde entegre edilmiştir ve aşağıdaki endpoint'lerden erişilebilir:

- **API Ana Sayfa**: `http://localhost:5505/api/pois` (temel API testi)
- **Swagger/OpenAPI**: Sistem içinde otomatik olarak oluşturulur
- **Detaylı Dokümantasyon**: `PROJE_DOKUMANTASYONU.md` dosyasında

## 🔒 Güvenlik

### Kimlik Doğrulama
- **Session Tabanlı**: Flask-Session ile güvenli oturum yönetimi
- **Rate Limiting**: Admin endpoint'leri için istek sınırlama
- **CORS**: Cross-Origin Resource Sharing yapılandırması

### Güvenlik Önlemleri
- **Input Validation**: Tüm kullanıcı girdileri doğrulanır
- **File Upload Security**: Güvenli dosya yükleme kontrolleri
- **SQL Injection Protection**: Parametreli sorgular kullanılır

## 🚀 Dağıtım

### Geliştirme Ortamı
```bash
# Geliştirme sunucusu
python poi_api.py

# Debug modunda
FLASK_DEBUG=True python poi_api.py
```

### Üretim Ortamı
```bash
# WSGI sunucu
python wsgi.py

# Gunicorn ile
gunicorn -w 4 -b 0.0.0.0:5505 wsgi:application

# Docker ile
docker build -t urgup-seyahat-onerisi .
docker run -p 5505:5505 urgup-seyahat-onerisi
```

### Docker Kurulumu
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "wsgi.py"]
```

## 📈 Performans Optimizasyonu

### Veritabanı Optimizasyonları
- **İndeksleme**: Önerilen indeksler `recommended_indexes.sql` dosyasında
- **Sorgu Optimizasyonu**: Optimize edilmiş SQL sorguları
- **Connection Pooling**: Veritabanı bağlantı havuzu

### Cache Stratejileri
- **Redis Cache**: Yüksek performanslı önbellekleme
- **Memory Cache**: Hızlı erişim için bellek önbelleği
- **File Cache**: Statik dosyalar için dosya önbelleği

## 🐛 Sorun Giderme

### Yaygın Sorunlar

#### 1. Veritabanı Bağlantı Hatası
```bash
# Bağlantı bilgilerini kontrol et
python -c "from poi_database_adapter import test_connection; test_connection()"

# Veritabanı servisini kontrol et
sudo systemctl status postgresql
```

#### 2. Python Bağımlılık Hataları
```bash
# Sanal ortamı yeniden oluştur
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 3. Port Çakışması
```bash
# Kullanılan portları kontrol et
netstat -tulpn | grep :5000

# Farklı port kullan
python poi_api.py --port 5506
```

### Log Dosyaları
```bash
# Uygulama logları
tail -f logs/app.log

# Hata logları
tail -f logs/error.log

# Debug logları
tail -f logs/debug.log
```

## 🤝 Katkıda Bulunma

### Geliştirme Ortamı Kurulumu
```bash
# Projeyi fork edin
git clone <your-fork-url>
cd kapadokya-poi-sistemi

# Geliştirme branch'i oluşturun
git checkout -b feature/yeni-ozellik

# Değişiklikleri commit edin
git add .
git commit -m "Yeni özellik: açıklama"

# Pull request gönderin
git push origin feature/yeni-ozellik
```

### Kod Standartları
- **Python**: PEP 8 standartlarına uygun
- **JavaScript**: ESLint kurallarına uygun
- **CSS**: BEM metodolojisi
- **Git**: Conventional Commits formatı

### Test Yazma
```python
# Yeni test ekle
def test_yeni_ozellik():
    """Yeni özellik testi"""
    result = yeni_fonksiyon()
    assert result == expected_value
```

## 📚 Ek Kaynaklar

### Dokümantasyon
- [Flask Dokümantasyonu](https://flask.palletsprojects.com/)
- [PostGIS Dokümantasyonu](https://postgis.net/documentation/)
- [Folium Dokümantasyonu](https://python-visualization.github.io/folium/)

### Yardımcı Araçlar
- **Postman**: API testleri için
- **pgAdmin**: PostgreSQL yönetimi için
- **MongoDB Compass**: MongoDB yönetimi için

### Topluluk
- [GitHub Issues](https://github.com/username/kapadokya-poi-sistemi/issues)
- [Discussions](https://github.com/username/kapadokya-poi-sistemi/discussions)

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👥 Geliştirici Ekibi

- **Ana Geliştirici**: [İsim](mailto:email@example.com)
- **UI/UX Tasarım**: [İsim](mailto:email@example.com)
- **Veritabanı Uzmanı**: [İsim](mailto:email@example.com)

## 🙏 Teşekkürler

- [OpenStreetMap](https://www.openstreetmap.org/) - Harita verileri için
- [Folium](https://python-visualization.github.io/folium/) - Harita görselleştirme için
- [PostGIS](https://postgis.net/) - Coğrafi veritabanı desteği için

## 📞 İletişim

- **E-posta**: support@urgup-seyahat.com
- **GitHub**: [Proje Sayfası](https://github.com/username/urgup-seyahat-onerisi)
- **Dokümantasyon**: [Wiki](https://github.com/username/urgup-seyahat-onerisi/wiki)

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!