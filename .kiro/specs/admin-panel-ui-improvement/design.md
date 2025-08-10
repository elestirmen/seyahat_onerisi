# Design Document

## Overview

Bu tasarım, mevcut POI yönetim panelindeki UX sorunlarını çözmek ve rota dosyası import özelliği eklemek için kapsamlı bir UI/UX iyileştirmesi sağlar. Sistem, ayrı POI ve rota yönetim arayüzleri ile KMZ, KML, GPX dosya import özelliklerini içerecektir.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   POI Manager   │  │  Route Manager  │  │ File Import │ │
│  │     UI          │  │      UI         │  │     UI      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    API Gateway                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   POI Service   │  │  Route Service  │  │File Parser  │ │
│  │                 │  │                 │  │  Service    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   POI Tables    │  │  Route Tables   │  │Import Logs  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Separation Strategy

1. **POI Management UI** - Sadece POI işlemleri için optimize edilmiş arayüz
2. **Route Management UI** - Sadece rota işlemleri için optimize edilmiş arayüz  
3. **File Import UI** - Rota dosyası import işlemleri için özel arayüz
4. **Shared Components** - Ortak kullanılan harita, navigasyon ve utility bileşenleri

## Components and Interfaces

### 1. POI Management Interface

#### POI Manager UI (`poi_manager_enhanced.html`)
```html
<!-- Sadece POI yönetimi için optimize edilmiş arayüz -->
<div class="poi-management-container">
  <header class="poi-header">
    <nav class="main-navigation">
      <a href="poi_manager_enhanced.html" class="active">POI Yönetimi</a>
      <a href="route_manager_enhanced.html">Rota Yönetimi</a>
      <a href="file_import_manager.html">Dosya Import</a>
    </nav>
  </header>
  
  <main class="poi-main-content">
    <aside class="poi-sidebar">
      <!-- POI listesi, filtreleme, arama -->
    </aside>
    <section class="poi-workspace">
      <!-- POI detayları, düzenleme formu -->
    </section>
    <section class="poi-map-view">
      <!-- Harita görünümü -->
    </section>
  </main>
</div>
```

#### POI Service API Extensions
```python
class POIServiceEnhanced:
    def get_pois_paginated(self, page, limit, filters):
        """Sayfalanmış POI listesi"""
        
    def search_pois(self, query, category_filter, location_filter):
        """Gelişmiş POI arama"""
        
    def get_poi_suggestions(self, route_coordinates):
        """Rota için POI önerileri"""
```

### 2. Route Management Interface

#### Route Manager UI (`route_manager_enhanced.html`)
```html
<div class="route-management-container">
  <header class="route-header">
    <nav class="main-navigation">
      <a href="poi_manager_enhanced.html">POI Yönetimi</a>
      <a href="route_manager_enhanced.html" class="active">Rota Yönetimi</a>
      <a href="file_import_manager.html">Dosya Import</a>
    </nav>
  </header>
  
  <main class="route-main-content">
    <aside class="route-sidebar">
      <!-- Rota listesi, filtreleme -->
    </aside>
    <section class="route-workspace">
      <!-- Rota detayları, düzenleme -->
    </section>
    <section class="route-map-view">
      <!-- Harita ve rota görselleştirme -->
    </section>
  </main>
</div>
```

### 3. File Import Interface

#### File Import Manager UI (`file_import_manager.html`)
```html
<div class="import-management-container">
  <header class="import-header">
    <nav class="main-navigation">
      <a href="poi_manager_enhanced.html">POI Yönetimi</a>
      <a href="route_manager_enhanced.html">Rota Yönetimi</a>
      <a href="file_import_manager.html" class="active">Dosya Import</a>
    </nav>
  </header>
  
  <main class="import-main-content">
    <section class="file-upload-zone">
      <!-- Drag & drop dosya yükleme -->
    </section>
    <section class="import-preview">
      <!-- Dosya önizleme ve validation -->
    </section>
    <section class="import-configuration">
      <!-- Import ayarları ve POI eşleştirme -->
    </section>
  </main>
</div>
```

#### Route File Parser Service
```python
class RouteFileParser:
    def __init__(self):
        self.supported_formats = ["gpx", "kml", "kmz"]
        self.parsers = {
            'gpx': GPXParser(),
            'kml': KMLParser(), 
            'kmz': KMZParser()
        }
    
    def parse_file(self, file_path, file_type):
        """Ana parse metodu"""
        
    def extract_metadata(self, parsed_data):
        """Rota metadata'sını çıkar"""
        
    def suggest_pois(self, route_coordinates):
        """Rota için POI önerileri"""
        
    def validate_route_data(self, route_data):
        """Rota verilerini doğrula"""
```

### 4. Shared Components

#### Navigation Component
```javascript
class NavigationManager {
    constructor() {
        this.currentPage = this.detectCurrentPage();
        this.initializeNavigation();
    }
    
    detectCurrentPage() {
        // URL'den mevcut sayfayı tespit et
    }
    
    initializeNavigation() {
        // Navigasyon menüsünü başlat
    }
}
```

#### Map Component
```javascript
class EnhancedMapManager {
    constructor(containerId, options = {}) {
        this.map = null;
        this.layers = {};
        this.markers = {};
        this.routes = {};
    }
    
    initializeMap(center, zoom) {
        // Harita başlatma
    }
    
    addPOILayer(pois) {
        // POI katmanı ekleme
    }
    
    addRouteLayer(routes) {
        // Rota katmanı ekleme
    }
    
    showRoutePreview(routeData) {
        // Import edilen rota önizlemesi
    }
}
```

## Data Models

### Enhanced Route Model
```sql
-- Mevcut routes tablosuna eklenmesi gereken alanlar
ALTER TABLE routes ADD COLUMN IF NOT EXISTS import_source VARCHAR(50);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);
ALTER TABLE routes ADD COLUMN IF NOT EXISTS import_metadata JSONB;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS waypoints JSONB;

-- Import log tablosu
CREATE TABLE IF NOT EXISTS route_imports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_size INTEGER,
    import_status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    imported_route_id INTEGER REFERENCES routes(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);
```

### POI-Route Association Model
```sql
-- POI-Rota ilişki tablosu
CREATE TABLE IF NOT EXISTS route_poi_associations (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    sequence_order INTEGER,
    distance_from_route DECIMAL(10,2),
    is_waypoint BOOLEAN DEFAULT FALSE,
    association_type VARCHAR(20) DEFAULT 'suggested',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_id, poi_id)
);
```

## Error Handling

### File Import Error Handling
```python
class ImportError(Exception):
    def __init__(self, message, error_code, details=None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

class FileParserErrorHandler:
    ERROR_CODES = {
        'UNSUPPORTED_FORMAT': 'Desteklenmeyen dosya formatı',
        'CORRUPTED_FILE': 'Bozuk dosya',
        'INVALID_COORDINATES': 'Geçersiz koordinat bilgisi',
        'MISSING_ROUTE_DATA': 'Rota verisi bulunamadı',
        'PARSING_FAILED': 'Dosya parse edilemedi'
    }
    
    def handle_error(self, error_code, details=None):
        """Hata işleme ve kullanıcı dostu mesaj üretme"""
```

### UI Error States
```javascript
class ErrorStateManager {
    showFileUploadError(errorCode, message) {
        // Dosya yükleme hatası gösterimi
    }
    
    showParsingError(filename, errors) {
        // Parse hatası detayları
    }
    
    showValidationErrors(validationResults) {
        // Validation hataları
    }
}
```

## Testing Strategy

### Unit Tests
1. **File Parser Tests**
   - GPX, KML, KMZ dosya parse testleri
   - Hatalı dosya handling testleri
   - Metadata extraction testleri

2. **UI Component Tests**
   - Navigation component testleri
   - Map interaction testleri
   - Form validation testleri

### Integration Tests
1. **File Import Flow Tests**
   - End-to-end dosya import süreci
   - POI association testleri
   - Database integration testleri

2. **UI Integration Tests**
   - Sayfa geçişleri
   - API entegrasyonu
   - Real-time updates

### Performance Tests
1. **Large File Handling**
   - Büyük GPX dosyaları (>10MB)
   - Çok sayıda waypoint içeren dosyalar
   - Memory usage testleri

2. **UI Performance**
   - Page load times
   - Map rendering performance
   - Mobile responsiveness

## Security Considerations

### File Upload Security
```python
class SecureFileUploader:
    ALLOWED_EXTENSIONS = {'gpx', 'kml', 'kmz'}
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    def validate_file(self, file):
        """Dosya güvenlik validasyonu"""
        
    def sanitize_filename(self, filename):
        """Dosya adı sanitizasyonu"""
        
    def scan_file_content(self, file_path):
        """Dosya içeriği güvenlik taraması"""
```

### Authentication & Authorization
- Mevcut auth_middleware kullanımı devam edecek
- File upload işlemleri için ek rate limiting
- Import log'ları için audit trail

## Mobile Responsiveness

### Responsive Design Strategy
```css
/* Mobile-first approach */
.poi-management-container {
    display: grid;
    grid-template-areas: 
        "header"
        "sidebar"
        "workspace"
        "map";
}

@media (min-width: 768px) {
    .poi-management-container {
        grid-template-areas: 
            "header header header"
            "sidebar workspace map";
        grid-template-columns: 300px 1fr 400px;
    }
}

@media (min-width: 1200px) {
    .poi-management-container {
        grid-template-columns: 350px 1fr 500px;
    }
}
```

### Touch Optimizations
```javascript
class TouchOptimizer {
    initializeTouchEvents() {
        // Touch gesture handling
    }
    
    optimizeMapInteractions() {
        // Map touch optimizations
    }
    
    enhanceFormInputs() {
        // Mobile form optimizations
    }
}
```

## Performance Optimizations

### Frontend Optimizations
1. **Lazy Loading**
   - Component-based lazy loading
   - Image lazy loading
   - Map tile lazy loading

2. **Caching Strategy**
   - Browser cache for static assets
   - API response caching
   - Map tile caching

3. **Bundle Optimization**
   - Code splitting
   - Tree shaking
   - Asset compression

### Backend Optimizations
1. **Database Optimizations**
   - Index optimizations
   - Query optimization
   - Connection pooling

2. **File Processing**
   - Async file processing
   - Background job queue
   - Progress tracking

## Implementation Phases

### Phase 1: UI Separation
- POI Manager UI ayrıştırması
- Route Manager UI ayrıştırması
- Navigation component geliştirme

### Phase 2: File Import System
- File parser service geliştirme
- Import UI oluşturma
- Database schema güncellemeleri

### Phase 3: POI-Route Integration
- POI suggestion algoritması
- Association management
- Enhanced route editing

### Phase 4: Mobile & Performance
- Responsive design implementation
- Performance optimizations
- Testing ve bug fixes