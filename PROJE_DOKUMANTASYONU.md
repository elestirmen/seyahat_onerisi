# 🗺️ Seyahat Öneri Sistemi - Tam Dokümantasyon

*Güncelleme Tarihi: Ocak 2024*

## 📋 İçindekiler
- [Proje Genel Bakış](#-proje-genel-bakış)
- [Teknik Gereksinimler](#-teknik-gereksinimler)
- [Kurulum ve Yapılandırma](#-kurulum-ve-yapılandırma)
- [Proje Yapısı](#-proje-yapısı)
- [Veritabanı Yapısı](#-veritabanı-yapısı)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Kullanım Rehberi](#-kullanım-rehberi)
- [Yapılandırma](#-yapılandırma)
- [Geliştirme Rehberi](#-geliştirme-rehberi)

---

## 🎯 Proje Genel Bakış

### Sistem Açıklaması

**Seyahat Öneri Sistemi**, Kapadokya bölgesi (özellikle Ürgüp) için geliştirilmiş kapsamlı bir seyahat planlama ve öneri platformudur. Sistem, turistlerin bölgedeki ilgi çekici noktaları (POI - Points of Interest) keşfetmelerine ve kişiselleştirilmiş rotalar oluşturmalarına yardımcı olur.

### Ana Özellikler

#### 🎯 Temel Özellikler
- **POI Yönetimi**: Restoranlar, oteller, tarihi yerler, aktiviteler için kapsamlı veri yönetimi
- **Akıllı Rota Planlama**: Kategori bazlı, özelleştirilebilir rota oluşturma
- **Çoklu Veritabanı Desteği**: JSON, MongoDB, PostgreSQL + PostGIS
- **Medya Yönetimi**: POI'lar için fotoğraf ve video desteği
- **WebSocket Desteği**: Gerçek zamanlı veri güncellemeleri
- **Admin Paneli**: Gelişmiş yönetim arayüzü
- **RESTful API**: Üçüncü parti entegrasyonlar için

#### 🗺️ Harita ve Navigasyon
- **OpenStreetMap Entegrasyonu**: Folium tabanlı interaktif haritalar
- **Rota Görselleştirme**: GPX, KML dosya formatları desteği
- **Yükseklik Verileri**: Rota planlamada yükseklik faktörü
- **Çoklu Katman Desteği**: Farklı harita katmanları ve görünümler

#### 🤖 AI ve Öneri Sistemi
- **Akıllı POI Önerileri**: Makine öğrenmesi tabanlı öneri algoritması
- **Kategori Optimizasyonu**: Otomatik kategori sınıflandırması
- **Performans Optimizasyonu**: Veritabanı sorgu optimizasyonları

### Sistem Mimarisi

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Flask Backend │    │   PostgreSQL    │
│   (HTML/CSS/JS) │◄──►│   (Python)      │◄──►│   + PostGIS     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Media Files  │
                    │   (Images/Vids)|
                    └─────────────────┘
```

---

## 🔧 Teknik Gereksinimler

### Sistem Gereksinimleri
- **İşletim Sistemi**: Linux, macOS, Windows
- **RAM**: Minimum 4GB (önerilen 8GB+)
- **Disk**: Minimum 2GB boş alan
- **Python**: 3.7 veya üzeri

### Backend Teknolojileri
- **Web Framework**: Flask 2.3.3
- **Veritabanı**: PostgreSQL 12+ with PostGIS 3.0+
- **Coğrafi İşlemler**: PostGIS, Folium
- **WebSocket**: Flask-SocketIO
- **Authentication**: Flask-Session, bcrypt

### Frontend Teknolojileri
- **HTML5/CSS3**: Modern responsive tasarım
- **JavaScript**: ES6+ özellikler
- **Maps**: Leaflet.js, OpenStreetMap
- **Charts**: Chart.js
- **UI Framework**: Bootstrap 5.3.0

### Python Bağımlılıkları
```
Flask==2.3.3
psycopg2==2.9.10
folium==0.20.0
Pillow==11.3.0
requests==2.32.4
scikit-learn==1.7.1
```

---

## 🚀 Kurulum ve Yapılandırma

### Hızlı Kurulum (Önerilen)

```bash
# 1. Projeyi klonlayın
git clone <repository-url>
cd seyahat-onerisi-sistemi

# 2. Python sanal ortamı oluşturun
python3 -m venv venv
source venv/bin/activate  # Linux/macOS

# 3. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 4. Veritabanını yapılandırın
python setup_poi_database.py postgresql "postgresql://user:password@localhost/poi_db"

# 5. Sistemi başlatın
python poi_api.py
```

### Manuel Kurulum Adımları

#### Adım 1: PostgreSQL ve PostGIS Kurulumu
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql-12 postgresql-12-postgis-3 postgresql-contrib

# Veritabanı oluşturma
sudo -u postgres createdb poi_db
sudo -u postgres psql poi_db -c "CREATE EXTENSION postgis;"
sudo -u postgres psql poi_db -c "CREATE EXTENSION pg_trgm;"
```

#### Adım 2: Python Ortamı
```bash
# Sanal ortam oluşturma
python3 -m venv venv
source venv/bin/activate

# Bağımlılıkları yükleme
pip install -r requirements.txt
```

#### Adım 3: Veritabanı Şemasını Oluşturma
```bash
# Temel POI tabloları
python setup_poi_database.py postgresql "postgresql://user:password@localhost/poi_db"

# Rota tabloları
python setup_routes_database.py

# Admin panel tabloları
python database_schema_migration_admin_panel.py
```

#### Adım 4: Başlatma
```bash
# Ana API sunucusu
python poi_api.py

# Tarayıcıda açın: http://localhost:5505
```

---

## 📁 Proje Yapısı

```
seyahat-onerisi-sistemi/
├── 📋 requirements.txt              # Python bağımlılıkları
├── 🐍 poi_api.py                    # Ana Flask uygulaması
├── 🐍 category_route_planner.py     # Rota planlama motoru
├── 🐍 poi_database_adapter.py       # Veritabanı adaptörü
├── 🐍 route_service.py              # Rota servis katmanı
├── 🐍 route_file_parser.py          # GPX/KML dosya işleyici
├── 🐍 poi_media_manager.py          # Medya yönetim sistemi
├── 🐍 elevation_service.py          # Yükseklik servisleri
│
├── 📁 static/                       # Statik dosyalar
│   ├── 📁 css/                      # Stil dosyaları
│   ├── 📁 js/                       # JavaScript dosyaları
│   └── 📁 poi-tabs/                 # POI sekmeleri
│
├── 📁 poi_media/                    # POI medya dosyaları
├── 📁 poi_images/                   # POI görselleri
├── 📁 temp_uploads/                 # Geçici yüklemeler
├── 📁 tests/                        # Test dosyaları
│
├── 📁 scripts/                      # Yardımcı scriptler
├── 📁 perf/                         # Performans testleri
└── 📁 archive/                      # Eski sürümler
```

### Temel Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `poi_api.py` | Ana Flask web uygulaması ve REST API |
| `category_route_planner.py` | Akıllı rota planlama algoritması |
| `poi_database_adapter.py` | Veritabanı işlemlerini yöneten adaptör |
| `route_service.py` | Rota oluşturma ve yönetim servisleri |
| `poi_media_manager.py` | Fotoğraf/video medya yönetimi |

---

## 🗄️ Veritabanı Yapısı

### Veritabanı Teknolojileri
- **Ana DB**: PostgreSQL 12+ with PostGIS 3.0+
- **Koordinat Sistemi**: WGS84 (EPSG:4326)
- **ORM**: Raw SQL (performans için)
- **Connection Pooling**: psycopg2

### Ana Tablolar

#### 1. POI Tablosu (`pois`)
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

#### 2. Rotalar Tablosu (`routes`)
```sql
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    route_type VARCHAR(50) DEFAULT 'walking',
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    estimated_duration INTEGER, -- dakika
    total_distance FLOAT, -- km
    elevation_gain INTEGER, -- metre
    route_geometry GEOGRAPHY(LINESTRING, 4326),
    waypoints JSONB,
    start_poi_id INTEGER REFERENCES pois(id),
    end_poi_id INTEGER REFERENCES pois(id),
    is_circular BOOLEAN DEFAULT false,
    elevation_profile JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

#### 3. Kategoriler Tablosu (`categories`)
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

### İndeksler ve Performans
```sql
-- Coğrafi sorgular için GIST indeksleri
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_routes_geometry ON routes USING GIST(route_geometry);

-- Kategori filtreleme için B-tree indeksleri
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_routes_type ON routes(route_type);

-- JSON arama için GIN indeksleri
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
CREATE INDEX idx_routes_waypoints ON routes USING GIN(waypoints);
```

### Coğrafi Fonksiyonlar
```sql
-- Yakındaki POI'leri bulma
CREATE OR REPLACE FUNCTION find_pois_near_route(
    route_geom GEOGRAPHY,
    max_distance_meters INTEGER DEFAULT 1000
) RETURNS TABLE(...) AS $$
-- Implementation
$$ LANGUAGE plpgsql;
```

---

## 🔌 API Dokümantasyonu

### Ana Endpoint'ler

#### POI İşlemleri
```
GET    /api/pois              # Tüm POI'leri listele
GET    /api/pois/{id}         # POI detayı
POST   /api/pois              # Yeni POI ekle
PUT    /api/pois/{id}         # POI güncelle
DELETE /api/pois/{id}         # POI sil

GET    /api/pois?category=gastronomik  # Kategori filtreleme
GET    /api/pois?search=terim          # Metin arama
GET    /api/pois?lat=38.6&lon=34.9&radius=1000  # Yakın POI arama
```

#### Rota İşlemleri
```
GET    /api/routes            # Tüm rotaları listele
GET    /api/routes/{id}       # Rota detayı
POST   /api/routes            # Yeni rota oluştur
PUT    /api/routes/{id}       # Rota güncelle
DELETE /api/routes/{id}       # Rota sil

GET    /api/routes/{id}/geometry     # Rota geometrisi
POST   /api/routes/import             # GPX/KML içe aktar
```

#### Medya İşlemleri
```
GET    /api/poi/{id}/media            # POI medya dosyaları
POST   /api/poi/{id}/media            # Medya yükle
DELETE /api/poi/{id}/media/{filename} # Medya sil

GET    /api/poi/{id}/images           # POI görselleri
POST   /api/poi/{id}/images           # Görsel yükle
```

#### Arama ve Filtreleme
```
GET    /api/search?q=ürgüp             # Genel arama
GET    /api/pois/by-rating?category=tarihi&min_score=50
POST   /api/recommendations           # Kişiselleştirilmiş öneriler
POST   /api/routes/filter             # Rota filtreleme
```

### Admin Endpoint'leri
```
GET    /api/admin/routes              # Admin rota yönetimi
POST   /api/admin/routes              # Yeni rota oluştur
PUT    /api/admin/routes/{id}         # Rota güncelle
DELETE /api/admin/routes/{id}         # Rota sil
```

### Örnek API Çağrıları

#### POI Arama
```bash
# Yakındaki POI'leri bulma
curl "http://localhost:5505/api/pois?lat=38.6322&lon=34.9115&radius=1000"

# Kategori bazlı arama
curl "http://localhost:5505/api/pois?category=kulturel"

# Metin arama
curl "http://localhost:5505/api/search?q=üçhisar"
```

#### Rota Oluşturma
```bash
# Akıllı rota oluşturma
curl -X POST "http://localhost:5505/api/route/smart" \
  -H "Content-Type: application/json" \
  -d '{
    "start": {"lat": 38.6322, "lon": 34.9115},
    "end": {"lat": 38.6422, "lon": 34.9215},
    "preferences": ["kulturel", "gastronomik"],
    "max_distance": 5000
  }'
```

---

## 🎮 Kullanım Rehberi

### Sistem Erişim URL'leri

#### Ana Arayüzler
- **Ana Sayfa**: `http://localhost:5505/poi_recommendation_system.html`
- **Keşfedilecek Yerler**: `http://localhost:5505/personal_routes.html`
- **Hazır Rotalar**: `http://localhost:5505/predefined_routes.html`
- **Admin Panel**: `http://localhost:5505/admin`

#### API Dokümantasyonu
- **Swagger UI**: `http://localhost:5505/swagger-ui`
- **OpenAPI Spec**: `http://localhost:5505/openapi.yaml`

### Temel Kullanım Adımları

#### 1. Sistem Başlatma
```bash
# Backend API'yi başlat
python poi_api.py

# Tarayıcıda ana sayfaya git
# http://localhost:5505/poi_recommendation_system.html
```

#### 2. POI Keşfi
1. Ana sayfada "Keşfedilecek Yerler" sekmesine tıklayın
2. Konum izinlerini verin (GPS)
3. İlgi alanlarınızı seçin (kültürel, gastronomik, doğa vb.)
4. Sistem size yakın POI'leri önerecek

#### 3. Rota Oluşturma
1. "Keşfedilecek Yerler" bölümünde POI'leri seçin
2. "Rota Oluştur" butonuna tıklayın
3. Rota tercihlerinizi belirleyin (yürüyüş, araç, bisiklet)
4. Harita üzerinde rotanızı görüntüleyin

#### 4. Hazır Rotalar
1. "Hazır Rotalar" sekmesine geçin
2. Filtreleri kullanarak rotaları arayın
3. Zorluk seviyesine, süreye göre filtreleyin
4. Favori rotalarınızı kaydedin

### Komut Satırı Kullanımı

#### Rota Planlama
```bash
# Tüm kategorilerde rota oluştur
python category_route_planner.py

# Belirli kategoride rota oluştur
python category_route_planner.py gastronomik

# Başlangıç noktası belirle
python category_route_planner.py kulturel --start "Ürgüp Müzesi"

# Maksimum mesafe belirle
python category_route_planner.py aktivite --radius 5
```

#### Veritabanı İşlemleri
```bash
# POI verilerini içe aktar
python import_poi_data.py data/pois.json

# Veritabanını senkronize et
python sync_json_pois_to_db.py

# Kategorileri optimize et
python optimize_categories.py
```

### Mobil Kullanım

Sistem responsive tasarımla mobil cihazlarda da tam fonksiyonel çalışır:

- **Dokunmatik optimizasyonları**
- **Mobil harita kontrolleri**
- **Dokunmatik-friendly UI elemanları**
- **Çevrimdışı harita desteği**

---

## ⚙️ Yapılandırma

### Çevre Değişkenleri

`.env` dosyası oluşturun:

```bash
# Flask Yapılandırması
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your_secret_key_here

# Veritabanı Yapılandırması
POI_DB_TYPE=postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=your_password
POI_DB_CONNECTION=postgresql://user:password@localhost/poi_db

# Sunucu Yapılandırması
HOST=0.0.0.0
PORT=5505

# Harita Yapılandırması
DEFAULT_MAP_CENTER_LAT=38.6322
DEFAULT_MAP_CENTER_LON=34.9115
DEFAULT_MAP_ZOOM=13

# Medya Yapılandırması
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,mp4,webm
MEDIA_UPLOAD_FOLDER=poi_media

# Cache Yapılandırması
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300

# Güvenlik
SESSION_TIMEOUT=3600
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_WINDOW=60
```

### Yapılandırma Dosyaları

#### `config.json`
```json
{
  "database": {
    "type": "postgresql",
    "connection_string": "postgresql://user:password@localhost/poi_db",
    "pool_size": 10,
    "max_overflow": 20
  },
  "api": {
    "host": "0.0.0.0",
    "port": 5505,
    "debug": true,
    "cors_origins": ["*"]
  },
  "maps": {
    "default_provider": "openstreetmap",
    "tile_servers": {
      "openstreetmap": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "satellite": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    }
  }
}
```

### Kategori Yapılandırması

`categories.json`:
```json
{
  "gastronomik": {
    "display_name": "Gastronomik",
    "color": "#e74c3c",
    "icon": "utensils",
    "description": "Restoranlar, kafeler, yerel mutfak"
  },
  "kulturel": {
    "display_name": "Kültürel",
    "color": "#3498db",
    "icon": "landmark",
    "description": "Tarihi yerler, müzeler, sanat galerileri"
  }
}
```

---

## 🛠️ Geliştirme Rehberi

### Kodlama Standartları

#### Python Kodlama Standartları
- **PEP 8** uyumluluğu
- **Type hints** kullanımı
- **Docstring** formatı: Google style
- **Exception handling**: Özel exception sınıfları
- **Logging**: Structured logging

#### JavaScript Kodlama Standartları
- **ES6+** özellikler
- **Async/await** kullanımı
- **Modüler yapı**: ES6 modules
- **Error handling**: Try-catch blocks
- **DOM manipulation**: Modern API'ler

#### CSS/SCSS Standartları
- **BEM metodolojisi**
- **CSS Variables** kullanımı
- **Responsive design** ilkeleri
- **Performance optimization**

### Proje Geliştirme Ortamı

#### Gerekli Araçlar
```bash
# Python geliştirme araçları
pip install flake8 black mypy pytest pytest-cov

# Node.js araçları (frontend için)
npm install -g eslint prettier

# Git hooks
pre-commit install
```

#### IDE Yapılandırması
- **VS Code** önerilir
- **Python extension** ve **Pylance**
- **ESLint** ve **Prettier** entegrasyonu
- **GitLens** extension

### Test Yazma Rehberi

#### Unit Test Örneği
```python
import pytest
from poi_api import app
from poi_database_adapter import POIDatabaseAdapter

class TestPOIAPI:
    def setup_method(self):
        self.app = app.test_client()
        self.db = POIDatabaseAdapter()
        
    def test_get_pois_success(self):
        """Test successful POI retrieval"""
        response = self.app.get('/api/pois')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'pois' in data
        
    def test_create_poi_validation(self):
        """Test POI creation with validation"""
        invalid_poi = {
            'name': '',  # Invalid: empty name
            'category': 'invalid_category'
        }
        response = self.app.post('/api/pois', 
                               json=invalid_poi)
        assert response.status_code == 400
```

#### Integration Test Örneği
```python
def test_route_creation_workflow(client, db_session):
    """Test complete route creation workflow"""
    # Create test POIs
    poi1 = create_test_poi(db_session, name="Start Point")
    poi2 = create_test_poi(db_session, name="End Point")
    
    # Create route
    route_data = {
        'name': 'Test Route',
        'start_poi_id': poi1.id,
        'end_poi_id': poi2.id,
        'route_type': 'walking'
    }
    
    response = client.post('/api/routes', json=route_data)
    assert response.status_code == 201
    
    # Verify route was created
    route_id = response.get_json()['id']
    route = db_session.query(Route).get(route_id)
    assert route.name == 'Test Route'
```

### Katkıda Bulunma Süreci

#### 1. Issue Oluşturma
- Bug raporları için **Bug Report** template'i kullanın
- Özellik istekleri için **Feature Request** template'i kullanın
- Açıklayıcı başlıklar kullanın

#### 2. Branch Oluşturma
```bash
# Feature branch oluşturma
git checkout -b feature/yeni-ozellik

# Bug fix branch oluşturma
git checkout -b bugfix/hata-duzeltmesi

# Hotfix branch oluşturma
git checkout -b hotfix/acil-duzeltme
```

#### 3. Kod Geliştirme
```bash
# Değişiklikleri commit etme
git add .
git commit -m "feat: yeni özellik eklendi

- Özellik açıklaması
- Test case'leri eklendi
- Dokümantasyon güncellendi"

# Push etme
git push origin feature/yeni-ozellik
```

#### 4. Pull Request Oluşturma
- PR şablonunu doldurun
- İlgili issue'ları linkleyin
- Test sonuçlarını ekleyin
- Screenshots/GIF'ler ekleyin

### CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      
      - name: Run tests
        run: pytest --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

### Dokümantasyon

#### Kod Dokümantasyonu
```python
def calculate_route_distance(route_points: List[Tuple[float, float]]) -> float:
    """
    Calculate total distance of a route given a list of coordinate points.
    
    This function uses the Haversine formula to calculate the great-circle
    distance between consecutive points in the route.
    
    Args:
        route_points: List of (latitude, longitude) tuples representing
                     the route waypoints in decimal degrees.
    
    Returns:
        Total route distance in kilometers.
    
    Raises:
        ValueError: If route_points contains fewer than 2 points.
    
    Example:
        >>> points = [(38.6322, 34.9115), (38.6422, 34.9215)]
        >>> calculate_route_distance(points)
        1.42
    """
    if len(route_points) < 2:
        raise ValueError("Route must have at least 2 points")
    
    total_distance = 0.0
    for i in range(len(route_points) - 1):
        lat1, lon1 = route_points[i]
        lat2, lon2 = route_points[i + 1]
        total_distance += haversine_distance(lat1, lon1, lat2, lon2)
    
    return total_distance
```

#### API Dokümantasyonu
```python
@app.route('/api/pois', methods=['GET'])
def get_pois():
    """
    Retrieve Points of Interest with optional filtering.
    
    Query Parameters:
        category (str): Filter by POI category
        lat (float): Latitude for proximity search
        lon (float): Longitude for proximity search
        radius (int): Search radius in meters (default: 1000)
        limit (int): Maximum number of results (default: 50)
        search (str): Text search in POI names/descriptions
    
    Returns:
        JSON response with POI data and metadata
        
    Response Format:
        {
            "pois": [...],
            "total": 150,
            "page": 1,
            "per_page": 50,
            "filters": {...}
        }
    """
```

### Hata Yönetimi

#### Özel Exception Sınıfları
```python
class POIException(Exception):
    """Base exception for POI-related errors"""
    pass

class POINotFoundError(POIException):
    """Raised when a POI is not found"""
    def __init__(self, poi_id):
        self.poi_id = poi_id
        super().__init__(f"POI with id {poi_id} not found")

class RouteCreationError(POIException):
    """Raised when route creation fails"""
    def __init__(self, message, details=None):
        self.details = details
        super().__init__(message)
```

#### Error Handling Middleware
```python
@app.errorhandler(POIException)
def handle_poi_exception(error):
    """Handle POI-specific exceptions"""
    response = {
        'success': False,
        'error': {
            'type': error.__class__.__name__,
            'message': str(error)
        }
    }
    
    if hasattr(error, 'details'):
        response['error']['details'] = error.details
    
    return jsonify(response), 400

@app.errorhandler(404)
def handle_not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Resource not found'
    }), 404
```

### Performans Optimizasyonları

#### Veritabanı Optimizasyonları
- **İndeks stratejileri**: GIST, B-tree, GIN indeksleri
- **Query optimization**: EXPLAIN ANALYZE kullanımı
- **Connection pooling**: psycopg2 pool kullanımı
- **Caching**: Redis/Flask-Caching entegrasyonu

#### Frontend Optimizasyonları
- **Code splitting**: Dinamik import'lar
- **Lazy loading**: Resimler ve component'ler için
- **Service workers**: Offline caching
- **Bundle optimization**: Webpack konfigürasyonu

---

## 📞 İletişim ve Destek

### Geliştirici Ekibi
- **Ana Geliştirici**: [Takım Lideri]
- **Backend Developer**: [Backend Uzmanı]
- **Frontend Developer**: [Frontend Uzmanı]
- **DevOps Engineer**: [Sistem Yöneticisi]

### Dokümantasyon
- **API Dokümantasyonu**: `/docs/api`
- **Kullanıcı Kılavuzu**: `/docs/user-guide`
- **Geliştirici Kılavuzu**: `/docs/developer-guide`

### Destek Kanalları
- **GitHub Issues**: Bug raporları ve özellik istekleri
- **Discussions**: Genel tartışmalar ve sorular
- **Wiki**: Detaylı dokümantasyon ve rehberler

---

## 📋 Değişiklik Geçmişi (Changelog)

### v2.1.0 (Ocak 2024)
- ✨ Yeni rota optimizasyon algoritması
- 🐛 POI arama performans iyileştirmesi
- 📱 Mobil arayüz geliştirmeleri
- 🔒 Güvenlik güncellemeleri

### v2.0.0 (Aralık 2023)
- 🎯 Tam yeniden yazım
- 🗄️ PostgreSQL + PostGIS entegrasyonu
- 🎨 Modern UI/UX tasarımı
- 🔌 RESTful API implementasyonu

### v1.5.0 (Kasım 2023)
- 📍 GPS tabanlı POI önerileri
- 🗺️ İnteraktif harita entegrasyonu
- 📊 Veri analizi dashboard'u

---

*Bu dokümantasyon sürekli güncellenmektedir. En güncel sürüm için GitHub repository'sini kontrol edin.*
