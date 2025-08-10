# POI Veritabanı Tasarım Önerisi

## Önerilen Veritabanı: PostgreSQL + PostGIS

### Neden PostgreSQL + PostGIS?

1. **Gelişmiş Mekansal Özellikler**: PostGIS ile koordinat bazlı sorgular, mesafe hesaplamaları, alan içinde arama
2. **Veri Bütünlüğü**: ACID uyumlu, güvenilir
3. **Ölçeklenebilirlik**: Milyonlarca POI'yi rahatlıkla yönetebilir
4. **3D Desteği**: 3D geometri ve model verileri için destek
5. **JSON Desteği**: Esnek veri yapıları için JSONB

### Veritabanı Şeması

```sql
-- PostGIS uzantısını etkinleştir
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ana POI tablosu
CREATE TABLE pois (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude FLOAT, -- Yükseklik (metre)
    description TEXT,
    short_description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    attributes JSONB -- Esnek özellikler için
);

-- Görüntüler tablosu
CREATE TABLE poi_images (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    image_data BYTEA, -- Binary veri için
    thumbnail_url VARCHAR(500),
    caption VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3D Modeller tablosu
CREATE TABLE poi_3d_models (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    model_format VARCHAR(50), -- 'glTF', 'OBJ', 'FBX' vb.
    model_url VARCHAR(500),
    model_data BYTEA, -- Binary veri için
    preview_image_url VARCHAR(500),
    scale JSONB, -- {x: 1.0, y: 1.0, z: 1.0}
    rotation JSONB, -- {x: 0, y: 0, z: 0}
    position_offset JSONB, -- {x: 0, y: 0, z: 0}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- POI puanları tablosu (her kategori için ayrı satır)
CREATE TABLE poi_ratings (
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    category TEXT,
    rating INTEGER CHECK (rating BETWEEN 0 AND 100),
    PRIMARY KEY (poi_id, category)
);
-- Her bir kategori için puanlar bu tabloda tutulur. Attributes JSONB alanındaki
-- eski rating verileri buraya taşınabilir.

-- Kategoriler tablosu (genişletilebilir)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    color VARCHAR(7), -- HEX renk kodu
    icon VARCHAR(50),
    description TEXT
);

-- İndeksler
CREATE INDEX idx_poi_location ON pois USING GIST(location);
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_poi_active ON pois(is_active);
CREATE INDEX idx_poi_attributes ON pois USING GIN(attributes);
CREATE INDEX idx_poi_ratings_poi_id ON poi_ratings(poi_id);
CREATE INDEX idx_poi_ratings_category ON poi_ratings(category);
```

### Örnek Veri Ekleme

```sql
-- Kategori ekle
INSERT INTO categories (name, display_name, color, icon, description) VALUES
('gastronomik', '🍽️ Gastronomik', '#e74c3c', 'utensils', 'Restoranlar, kafeler ve lezzet noktaları'),
('kulturel', '🏛️ Kültürel', '#3498db', 'landmark', 'Müzeler, tarihi yerler ve kültürel mekanlar');

-- POI ekle
INSERT INTO pois (name, category, location, altitude, description, attributes) VALUES
(
    'Ürgüp Müzesi',
    'kulturel',
    ST_GeogFromText('POINT(34.91148 38.63222)'),
    1050.5,
    'Kapadokya bölgesinin zengin tarihini ve kültürünü sergileyen müze...',
    '{
        "opening_hours": "09:00-17:00",
        "ticket_price": 50,
        "phone": "+90 384 341 4082",
        "website": "https://...",
        "amenities": ["parking", "cafe", "gift_shop"],
        "languages": ["tr", "en", "de"],
        "rating": 4.5,
        "review_count": 234
    }'::jsonb
);
```

### Kullanışlı Sorgular

```sql
-- Belirli bir noktaya en yakın 10 POI
SELECT 
    id, 
    name, 
    category,
    ST_Distance(location, ST_GeogFromText('POINT(34.9130 38.6310)')) AS distance_meters
FROM pois
WHERE is_active = true
ORDER BY location <-> ST_GeogFromText('POINT(34.9130 38.6310)')
LIMIT 10;

-- Belirli bir alan içindeki POI'ler
SELECT * FROM pois
WHERE ST_DWithin(
    location,
    ST_GeogFromText('POINT(34.9130 38.6310)'),
    5000 -- 5km yarıçap
);

-- Kategori bazlı POI'ler görüntüleriyle
SELECT 
    p.*,
    COALESCE(
        json_agg(
            json_build_object(
                'caption', pi.caption,
                'is_primary', pi.is_primary,
                'thumbnail_url', pi.thumbnail_url
            )
        ) FILTER (WHERE pi.id IS NOT NULL),
        '[]'
    ) AS images
FROM pois p
LEFT JOIN poi_images pi ON p.id = pi.poi_id
WHERE p.category = 'kulturel' AND p.is_active = true
GROUP BY p.id;
```

## Python Entegrasyonu

### Gerekli kütüphaneler
```bash
pip install psycopg2-binary sqlalchemy geoalchemy2
```

### Örnek bağlantı sınıfı
```python
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geography
from datetime import datetime

Base = declarative_base()

class POI(Base):
    __tablename__ = 'pois'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    location = Column(Geography('POINT', srid=4326), nullable=False)
    altitude = Column(Float)
    description = Column(Text)
    short_description = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    attributes = Column(JSONB)
    
    # İlişkiler
    images = relationship("POIImage", back_populates="poi", cascade="all, delete-orphan")
    models_3d = relationship("POI3DModel", back_populates="poi", cascade="all, delete-orphan")

class POIImage(Base):
    __tablename__ = 'poi_images'
    
    id = Column(Integer, primary_key=True)
    poi_id = Column(Integer, ForeignKey('pois.id'))
    image_data = Column(LargeBinary)
    thumbnail_url = Column(String(500))
    caption = Column(String(255))
    is_primary = Column(Boolean, default=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    
    poi = relationship("POI", back_populates="images")

class POI3DModel(Base):
    __tablename__ = 'poi_3d_models'
    
    id = Column(Integer, primary_key=True)
    poi_id = Column(Integer, ForeignKey('pois.id'))
    model_format = Column(String(50))
    model_url = Column(String(500))
    model_data = Column(LargeBinary)
    preview_image_url = Column(String(500))
    scale = Column(JSONB)
    rotation = Column(JSONB)
    position_offset = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    poi = relationship("POI", back_populates="models_3d")

# Veritabanı bağlantısı
engine = create_engine('postgresql://user:password@localhost/poi_database')
Session = sessionmaker(bind=engine)
```

## Alternatif: MongoDB Tasarımı

Eğer daha esnek bir yapı tercih ederseniz:

```javascript
// POI Koleksiyonu
{
  _id: ObjectId("..."),
  name: "Ürgüp Müzesi",
  category: "kulturel",
  location: {
    type: "Point",
    coordinates: [34.91148, 38.63222] // [lon, lat]
  },
  altitude: 1050.5,
  description: {
    tr: "Kapadokya bölgesinin zengin tarihini...",
    en: "Museum showcasing rich history of Cappadocia..."
  },
  images: [
    {
      id: "img_001",
      url: "https://storage.../urgup-muzesi-1.jpg",
      thumbnailUrl: "https://storage.../urgup-muzesi-1-thumb.jpg",
      caption: "Ana giriş",
      isPrimary: true,
      metadata: {
        width: 1920,
        height: 1080,
        size: 1234567,
        mimeType: "image/jpeg"
      }
    }
  ],
  model3d: {
    format: "glTF",
    url: "https://storage.../urgup-muzesi.gltf",
    previewImage: "https://storage.../urgup-muzesi-3d-preview.jpg",
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    rotation: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 }
  },
  attributes: {
    openingHours: {
      monday: "09:00-17:00",
      tuesday: "09:00-17:00",
      // ...
    },
    pricing: {
      adult: 50,
      student: 25,
      child: 0
    },
    contact: {
      phone: "+90 384 341 4082",
      email: "info@urgup-muzesi.gov.tr",
      website: "https://..."
    },
    amenities: ["parking", "cafe", "gift_shop", "wheelchair_accessible"],
    languages: ["tr", "en", "de", "fr"],
    rating: {
      average: 4.5,
      count: 234
    }
  },
  tags: ["museum", "history", "culture", "family-friendly"],
  isActive: true,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-01T00:00:00Z")
}

// İndeksler
db.pois.createIndex({ "location": "2dsphere" })
db.pois.createIndex({ "category": 1 })
db.pois.createIndex({ "tags": 1 })
db.pois.createIndex({ "name": "text", "description": "text" })
```

## Görüntü ve 3D Model Saklama Stratejileri

### 1. **Cloud Storage + URL** (Önerilen)
- AWS S3, Google Cloud Storage, Azure Blob Storage
- Veritabanında sadece URL'ler saklanır
- CDN desteği ile hızlı erişim

### 2. **Veritabanında Binary**
- Küçük dosyalar için uygun
- Yedekleme kolaylığı
- Performans maliyeti var

### 3. **Hybrid Yaklaşım**
- Thumbnails: Veritabanında base64
- Büyük dosyalar: Cloud storage

## Performans İpuçları

1. **İndeksleme**: Coğrafi sorgular için GIST index kullanın
2. **Caching**: Redis ile sık kullanılan POI verilerini önbelleğe alın
3. **Pagination**: Büyük veri setlerinde sayfalama kullanın
4. **Materialized Views**: Karmaşık sorgular için
5. **Connection Pooling**: Veritabanı bağlantılarını yönetin