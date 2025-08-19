# 🗺️ Ürgüp POI Öneri Sistemi

Kullanıcı tercihlerine dayalı akıllı POI (Point of Interest) öneri sistemi. Ürgüp bölgesindeki turistik yerleri, restoranları, otelleri ve aktiviteleri kişiselleştirilmiş öneriler halinde sunar.

## ✨ Özellikler

### 🎯 Akıllı Öneri Sistemi
- **Kişiselleştirilmiş Öneriler**: 10 farklı kategori için tercih belirleme
- **Puanlama Sistemi**: 0-100 arası uygunluk puanları
- **İki Seviyeli Görüntüleme**: 
  - Yüksek puanlı öneriler (≥45 puan) öncelikli gösterim
  - Düşük puanlı alternatifler isteğe bağlı görüntüleme

### 🗺️ Gelişmiş Harita Entegrasyonu
- **İnteraktif Harita**: Leaflet.js tabanlı modern harita
- **Özel Marker'lar**: Kategori bazlı renkli ve ikonlu marker'lar
- **Popup Detayları**: Her POI için zengin bilgi kartları
- **Smooth Navigation**: "Haritada Göster" ile yumuşak geçişler
- **Responsive Tasarım**: Mobil uyumlu harita boyutları

### 🛣️ Rota Planlama
- **Çoklu POI Seçimi**: İstediğiniz POI'leri rotaya ekleme
- **Rota Detayları**: Mesafe, süre ve durak bilgileri
- **Yükseklik Profili**: Chart.js ile interaktif yükseklik grafiği
- **Google Maps Entegrasyonu**: Rotayı Google Maps'e aktarma
- **Başlangıç Noktası**: Özel başlangıç konumu belirleme

### 🎨 Modern Kullanıcı Arayüzü
- **Glassmorphism Tasarım**: Modern cam efekti tasarımı
- **Responsive Layout**: Tüm cihazlarda uyumlu görünüm
- **Smooth Animasyonlar**: CSS3 ve JavaScript animasyonları
- **Loading States**: Kullanıcı dostu yükleme göstergeleri
- **Touch Optimized**: Mobil dokunmatik optimizasyonları

### 📱 Medya Galerisi
- **Çoklu Medya Desteği**: Resim, video ve ses dosyaları
- **Modal Görüntüleyici**: Tam ekran medya görüntüleme
- **Lazy Loading**: Performans için gecikmeli yükleme
- **Thumbnail Preview**: POI kartlarında medya önizlemeleri

## 🚀 Kurulum

### Gereksinimler
- Python 3.8+
- PostgreSQL 12+
- Redis 6+ (opsiyonel)
- Docker & Docker Compose (opsiyonel)

### 1. Projeyi İndirin
```bash
git clone <repository-url>
cd urgup-poi-recommendation
```

### 2. Python Sanal Ortamı Oluşturun
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Gerekli Paketleri Yükleyin
```bash
pip install -r requirements.txt
```

### 4. Environment Değişkenlerini Ayarlayın
```bash
# .env dosyasını düzenleyin
cp .env.example .env
# Veritabanı bilgilerini güncelleyin
```

### 5. Veritabanını Kurun
```bash
# PostgreSQL veritabanını oluşturun
python setup_database.py

# POI verilerini import edin
python import_poi_data.py
```

### 6. Sunucuyu Başlatın
```bash
# Development
python poi_api.py

# Production
python wsgi.py
```

### 7. Docker ile Kurulum (Önerilen)
```bash
# Tüm servisleri başlatın
docker-compose up -d

# Logları takip edin
docker-compose logs -f poi-api
```

## 📁 Proje Yapısı

```
urgup-poi-recommendation/
├── app/                          # Flask uygulama modülü
│   ├── __init__.py              # Uygulama factory
│   ├── config/                  # Konfigürasyon dosyaları
│   │   ├── __init__.py
│   │   ├── database.py          # Veritabanı konfigürasyonu
│   │   └── settings.py          # Uygulama ayarları
│   ├── middleware/              # Middleware'ler
│   │   ├── __init__.py
│   │   └── error_handler.py     # Hata yönetimi
│   ├── routes/                  # Route'lar
│   │   ├── __init__.py
│   │   ├── main.py             # Ana sayfa route'ları
│   │   ├── poi.py              # POI endpoint'leri
│   │   ├── route.py            # Rota endpoint'leri
│   │   ├── route_import.py     # Rota import endpoint'leri
│   │   └── health.py           # Health check endpoint'leri
│   └── services/                # İş mantığı servisleri
│       ├── __init__.py
│       ├── auth_service.py      # Kimlik doğrulama
│       ├── media_service.py     # Medya yönetimi
│       ├── poi_service.py       # POI işlemleri
│       ├── route_service.py     # Rota işlemleri
│       ├── route_import_service.py  # Rota import
│       └── route_planning_service.py # Rota planlama
├── static/                       # Statik dosyalar
│   ├── css/                     # CSS dosyaları
│   └── js/                      # JavaScript dosyaları
├── templates/                    # HTML template'leri
│   ├── base.html               # Temel template
│   └── index.html              # Ana sayfa
├── logs/                        # Log dosyaları
├── temp_uploads/                # Geçici yüklemeler
├── poi_media/                   # POI medya dosyaları
├── poi_images/                  # POI resimleri
├── poi_api.py                   # Ana uygulama (development)
├── wsgi.py                      # WSGI entry point (production)
├── requirements.txt             # Python bağımlılıkları
├── Dockerfile                   # Docker image
├── docker-compose.yml           # Docker Compose
├── .env                         # Environment değişkenleri
└── README.md                    # Bu dosya
```

## 🔧 Konfigürasyon

### Environment Değişkenleri
```bash
# Flask
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key

# Veritabanı
DB_HOST=localhost
DB_PORT=5432
DB_NAME=poi_database
DB_USER=postgres
DB_PASSWORD=your_password

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
```

### Veritabanı Konfigürasyonu
```python
# app/config/database.py
DB_POOL_SIZE = 10
DB_TIMEOUT = 30
```

## 🌐 API Endpoint'leri

### Health Check
- `GET /api/health/` - Temel sağlık kontrolü
- `GET /api/health/detailed` - Detaylı sistem durumu
- `GET /api/health/ready` - Readiness kontrolü

### POI Endpoint'leri
- `GET /api/pois` - Tüm POI'leri listele
- `GET /api/pois/<id>` - Belirli POI detayı
- `POST /api/pois` - Yeni POI oluştur
- `PUT /api/pois/<id>` - POI güncelle
- `DELETE /api/pois/<id>` - POI sil

### Rota Endpoint'leri
- `GET /api/routes` - Tüm rotaları listele
- `GET /api/routes/<id>` - Belirli rota detayı
- `POST /api/routes` - Yeni rota oluştur
- `POST /api/routes/plan` - Rota planla

### Rota Import Endpoint'leri
- `POST /api/routes/import` - Rota dosyası yükle
- `GET /api/routes/import/progress/<id>` - Import ilerlemesi
- `POST /api/routes/import/confirm` - Import onayla

## 🐳 Docker

### Tek Container
```bash
# Image build
docker build -t poi-api .

# Container çalıştır
docker run -p 5000:5000 --env-file .env poi-api
```

### Docker Compose (Önerilen)
```bash
# Tüm servisleri başlat
docker-compose up -d

# Sadece API'yi başlat
docker-compose up poi-api

# Logları takip et
docker-compose logs -f poi-api

# Servisleri durdur
docker-compose down
```

## 🧪 Test

### Test Çalıştırma
```bash
# Tüm testleri çalıştır
python run_all_tests.py

# Belirli test dosyası
python -m pytest tests/test_api_core.py

# Coverage ile test
python -m pytest --cov=app tests/
```

### Test Veritabanı
```bash
# Test veritabanı kurulumu
python setup_database.py --test

# Test verilerini yükle
python import_poi_data.py --test
```

## 📊 Monitoring & Logging

### Health Checks
```bash
# Temel sağlık kontrolü
curl http://localhost:5000/api/health/

# Detaylı sistem durumu
curl http://localhost:5000/api/health/detailed

# Readiness kontrolü
curl http://localhost:5000/api/health/ready
```

### Log Yapısı
```
logs/
├── api.log                      # Uygulama logları
├── error.log                    # Hata logları
└── access.log                   # Erişim logları
```

## 🔒 Güvenlik

### Authentication
- Session-based authentication
- Password hashing (bcrypt)
- Rate limiting
- CORS protection

### Input Validation
- File upload validation
- SQL injection protection
- XSS protection

## 🚀 Production Deployment

### Environment
```bash
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=strong-secret-key
```

### Gunicorn
```bash
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:application
```

### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🐛 Sorun Giderme

### Yaygın Sorunlar

**1. Veritabanı Bağlantı Hatası**
```bash
# PostgreSQL servisini kontrol et
sudo systemctl status postgresql

# Bağlantıyı test et
psql -h localhost -U postgres -d poi_database
```

**2. Port Zaten Kullanımda**
```bash
# Port'u kullanan process'i bul
lsof -i :5000

# Process'i sonlandır
kill -9 <PID>
```

**3. Permission Hatası**
```bash
# Dizin izinlerini kontrol et
ls -la logs/ temp_uploads/ poi_media/

# İzinleri düzelt
chmod 755 logs/ temp_uploads/ poi_media/
```

### Debug Modu
```bash
# Environment'da debug'ı etkinleştir
export FLASK_DEBUG=True

# Log seviyesini artır
export LOG_LEVEL=DEBUG
```

## 📈 Performans Optimizasyonları

### Database
- Connection pooling
- Query optimization
- Index creation
- Caching

### Frontend
- Lazy loading
- Image optimization
- Minification
- CDN usage

### Backend
- Async processing
- Background tasks
- Caching strategies
- Load balancing

## 🔮 Gelecek Geliştirmeler

- [ ] **Kullanıcı Hesapları**: Kişisel tercih kaydetme
- [ ] **Sosyal Özellikler**: POI paylaşımı ve yorumlar
- [ ] **Offline Destek**: PWA özellikleri
- [ ] **AI Önerileri**: Machine learning tabanlı öneriler
- [ ] **Çoklu Dil**: İngilizce ve diğer dil desteği
- [ ] **Admin Panel**: POI yönetimi için admin arayüzü
- [ ] **Mobile App**: React Native / Flutter uygulaması
- [ ] **Analytics**: Kullanıcı davranış analizi
- [ ] **Notifications**: Push bildirimler
- [ ] **Payment Integration**: Ödeme sistemi entegrasyonu

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

### Development Setup
```bash
# Pre-commit hooks kurulumu
pip install pre-commit
pre-commit install

# Code formatting
black app/ tests/
isort app/ tests/

# Linting
flake8 app/ tests/
mypy app/
```

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 📞 İletişim

Proje hakkında sorularınız için:
- GitHub Issues kullanın
- Email: [your-email@example.com]

## 🙏 Teşekkürler

- Ürgüp Belediyesi
- Açık kaynak topluluğu
- Tüm katkıda bulunanlar

---

**Not**: Bu proje Ürgüp turizmi için geliştirilmiş bir demo uygulamadır. Gerçek kullanım için POI verilerinin güncel tutulması önerilir.