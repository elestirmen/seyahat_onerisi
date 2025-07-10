# -*- coding: utf-8 -*-
"""
POI Veritabanı Kurulum ve Veri İmport Scripti
"""

import os
import sys
from datetime import datetime
import argparse

# Mevcut POI verilerini import et
DEFAULT_POI_DATA = {
    "gastronomik": {
        "Ziggy Cafe & Restaurant (Ürgüp)": (38.633115, 34.907022),
        "Ehlikeyf Restaurant (Ürgüp)": (38.630610, 34.911284),
        "Sofra Restaurant (Ürgüp)": (38.63099, 34.91382),
        "Lagarto Restaurant (Kayakapı Premium Caves - Ürgüp)": (38.631862, 34.907135),
        "Fırın Express Pide & Kebap (Ürgüp)": (38.63161, 34.91537),
        "Mahzen Şarap Evi (Ürgüp)": (38.63411, 34.91035),
        "Apetino Restaurant (Ürgüp)": (38.63231, 34.91345),
        "Kolcuoğlu Ürgüp (Ürgüp)": (38.63145, 34.91183),
        "Han Çırağan Restaurant (Ürgüp)": (38.63309, 34.91522),
        "Ürgüp Pide Salonu (Ürgüp)": (38.63102, 34.91251)
    },
    "kulturel": {
        "Ürgüp Müzesi": (38.63222, 34.91148),
        "Temenni Tepesi (Ürgüp)": (38.63194, 34.91054),
        "Cappadocia Ebru Art House (Ürgüp)": (38.63161, 34.91537),
        "Ürgüp Erhan Ayata At Müzesi ve Güzel Atlar Sergisi (Ürgüp)": (38.62985, 34.90882),
        "Temenni Anıt Mezarı (Ürgüp)": (38.63194, 34.91054),
        "Rum Hamamı (Ürgüp)": (38.63273, 34.90841)
    },
    "sanatsal": {
        "El Sanatları Çarşısı (Ürgüp Cumhuriyet Meydanı)": (38.63145, 34.91183),
        "Kapadokya Sanat ve El Sanatları Merkezi (Ürgüp)": (38.63102, 34.91251),
        "Kilim Art Gallery (Ürgüp)": (38.63231, 34.91345)
    },
    "doga_macera": {
        "Temenni Hill (Ürgüp)": (38.63194, 34.91054),
        "Ürgüp ATV Turu Başlangıç Noktası (Ürgüp)": (38.63851, 34.91352),
        "Üç Güzeller Peribacaları (Ürgüp)": (38.635366, 34.890657),
        "Vefa Küçük Parkı (Ürgüp)": (38.63161, 34.91537)
    },
    "konaklama": {
        "Kayakapı Premium Caves (Ürgüp)": (38.62879, 34.91248),
        "Yunak Evleri Cappadocia (Ürgüp)": (38.63381, 34.90784),
        "Esbelli Evi Cave Hotel (Ürgüp)": (38.62985, 34.90882),
        "Dere Suites Cappadocia (Ürgüp)": (38.63273, 34.90841),
        "Seraphim Cave Hotel (Ürgüp)": (38.60942, 34.90375),
        "AJWA Cappadocia (Ürgüp)": (38.63411, 34.91035),
        "Utopia Cave Cappadocia (Ürgüp)": (38.63583, 34.90562)
    }
}

# Örnek POI detayları
SAMPLE_POI_DETAILS = {
    "Ürgüp Müzesi": {
        "description": "Kapadokya bölgesinin zengin tarihini ve kültürünü sergileyen önemli bir müze. Bizans dönemine ait eserler, yerel el sanatları ve arkeolojik buluntular sergilenmektedir.",
        "attributes": {
            "opening_hours": "09:00-17:00",
            "ticket_price": 50,
            "phone": "+90 384 341 4082",
            "website": "https://muze.gov.tr",
            "amenities": ["parking", "cafe", "gift_shop", "wheelchair_accessible"],
            "languages": ["tr", "en", "de"],
            "rating": 4.5,
            "review_count": 234
        },
        "images": [
            {
                "url": "https://example.com/urgup-muzesi-1.jpg",
                "thumbnail_url": "https://example.com/urgup-muzesi-1-thumb.jpg",
                "caption": "Müze ana girişi"
            },
            {
                "url": "https://example.com/urgup-muzesi-2.jpg",
                "thumbnail_url": "https://example.com/urgup-muzesi-2-thumb.jpg",
                "caption": "Bizans dönemi eserleri"
            }
        ]
    },
    "Ziggy Cafe & Restaurant (Ürgüp)": {
        "description": "Kapadokya'nın en popüler restoranlarından biri. Türk ve dünya mutfağından lezzetler, romantik ambiyans ve mükemmel şehir manzarası.",
        "attributes": {
            "opening_hours": "10:00-23:00",
            "price_range": "₺₺₺",
            "phone": "+90 384 341 5107",
            "website": "https://ziggycafe.com",
            "cuisine": ["Turkish", "International", "Vegetarian"],
            "features": ["outdoor_seating", "wifi", "live_music", "view"],
            "rating": 4.8,
            "review_count": 1523
        },
        "images": [
            {
                "url": "https://example.com/ziggy-1.jpg",
                "thumbnail_url": "https://example.com/ziggy-1-thumb.jpg",
                "caption": "Restoran terası"
            }
        ]
    }
}


def setup_postgresql_database(connection_string):
    """PostgreSQL veritabanını kur ve örnek verileri ekle"""
    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        print("❌ psycopg2 kurulu değil. 'pip install psycopg2-binary' komutunu çalıştırın.")
        return False
    
    try:
        # Veritabanına bağlan
        conn = psycopg2.connect(connection_string)
        cur = conn.cursor()
        
        print("📊 PostgreSQL veritabanına bağlanıldı")
        
        # PostGIS uzantısını etkinleştir
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        print("✅ PostGIS uzantısı etkinleştirildi")
        
        # Tabloları oluştur
        cur.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                display_name VARCHAR(100),
                color VARCHAR(7),
                icon VARCHAR(50),
                description TEXT
            );
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pois (
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
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poi_images (
                id SERIAL PRIMARY KEY,
                poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
                image_url VARCHAR(500),
                image_data BYTEA,
                thumbnail_url VARCHAR(500),
                caption VARCHAR(255),
                is_primary BOOLEAN DEFAULT false,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poi_3d_models (
                id SERIAL PRIMARY KEY,
                poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
                model_format VARCHAR(50),
                model_url VARCHAR(500),
                model_data BYTEA,
                preview_image_url VARCHAR(500),
                scale JSONB,
                rotation JSONB,
                position_offset JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # İndeksleri oluştur
        cur.execute("CREATE INDEX IF NOT EXISTS idx_poi_location ON pois USING GIST(location);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_poi_category ON pois(category);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_poi_active ON pois(is_active);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_poi_attributes ON pois USING GIN(attributes);")
        
        print("✅ Tablolar ve indeksler oluşturuldu")
        
        # Kategorileri ekle
        category_data = {
            "gastronomik": ("🍽️ Gastronomik", "#e74c3c", "utensils", "Restoranlar, kafeler ve lezzet noktaları"),
            "kulturel": ("🏛️ Kültürel", "#3498db", "landmark", "Müzeler, tarihi yerler ve kültürel mekanlar"),
            "sanatsal": ("🎨 Sanatsal", "#2ecc71", "palette", "Sanat galerileri, atölyeler ve yaratıcı mekanlar"),
            "doga_macera": ("🌿 Doğa & Macera", "#f39c12", "hiking", "Doğal güzellikler ve macera aktiviteleri"),
            "konaklama": ("🏨 Konaklama", "#9b59b6", "bed", "Oteller, pansiyonlar ve konaklama tesisleri")
        }
        
        for cat_name, (display_name, color, icon, desc) in category_data.items():
            cur.execute("""
                INSERT INTO categories (name, display_name, color, icon, description)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (name) DO NOTHING;
            """, (cat_name, display_name, color, icon, desc))
        
        print("✅ Kategoriler eklendi")
        
        # POI'leri ekle
        poi_count = 0
        for category, pois in DEFAULT_POI_DATA.items():
            for poi_name, (lat, lon) in pois.items():
                # Detay bilgileri varsa kullan
                details = SAMPLE_POI_DETAILS.get(poi_name, {})
                
                cur.execute("""
                    INSERT INTO pois (name, category, location, description, attributes)
                    VALUES (%s, %s, ST_GeogFromText('POINT(%s %s)'), %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id;
                """, (
                    poi_name,
                    category,
                    lon,
                    lat,
                    details.get('description'),
                    Json(details.get('attributes', {}))
                ))
                
                result = cur.fetchone()
                if result:
                    poi_id = result[0]
                    poi_count += 1
                    
                    # Görüntüleri ekle
                    if 'images' in details:
                        for img in details['images']:
                            cur.execute("""
                                INSERT INTO poi_images (poi_id, image_url, thumbnail_url, caption)
                                VALUES (%s, %s, %s, %s);
                            """, (poi_id, img['url'], img.get('thumbnail_url'), img.get('caption')))
        
        conn.commit()
        print(f"✅ {poi_count} POI başarıyla eklendi")
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ PostgreSQL kurulum hatası: {e}")
        return False


def setup_mongodb_database(connection_string, database_name="poi_db"):
    """MongoDB veritabanını kur ve örnek verileri ekle"""
    try:
        from pymongo import MongoClient, GEOSPHERE
    except ImportError:
        print("❌ pymongo kurulu değil. 'pip install pymongo' komutunu çalıştırın.")
        return False
    
    try:
        # MongoDB'ye bağlan
        client = MongoClient(connection_string)
        db = client[database_name]
        collection = db.pois
        
        print("📊 MongoDB veritabanına bağlanıldı")
        
        # Geospatial index oluştur
        collection.create_index([("location", GEOSPHERE)])
        collection.create_index("category")
        collection.create_index("tags")
        collection.create_index([("name", "text")])
        
        print("✅ İndeksler oluşturuldu")
        
        # POI'leri ekle
        poi_count = 0
        for category, pois in DEFAULT_POI_DATA.items():
            for poi_name, (lat, lon) in pois.items():
                # Detay bilgileri varsa kullan
                details = SAMPLE_POI_DETAILS.get(poi_name, {})
                
                document = {
                    "name": poi_name,
                    "category": category,
                    "location": {
                        "type": "Point",
                        "coordinates": [lon, lat]  # MongoDB: [longitude, latitude]
                    },
                    "description": details.get('description', {}),
                    "images": details.get('images', []),
                    "attributes": details.get('attributes', {}),
                    "isActive": True,
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
                
                # Varsa güncelle, yoksa ekle
                result = collection.update_one(
                    {"name": poi_name, "category": category},
                    {"$set": document},
                    upsert=True
                )
                
                if result.upserted_id or result.modified_count:
                    poi_count += 1
        
        print(f"✅ {poi_count} POI başarıyla eklendi")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ MongoDB kurulum hatası: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="POI Veritabanı Kurulum ve Veri İmport Aracı",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    parser.add_argument(
        "db_type",
        choices=["postgresql", "mongodb"],
        help="Veritabanı tipi"
    )
    
    parser.add_argument(
        "connection_string",
        help="Veritabanı bağlantı string'i\n"
             "PostgreSQL örnek: postgresql://user:password@localhost/poi_db\n"
             "MongoDB örnek: mongodb://localhost:27017/"
    )
    
    parser.add_argument(
        "--db-name",
        default="poi_db",
        help="MongoDB veritabanı adı (sadece MongoDB için)"
    )
    
    args = parser.parse_args()
    
    print(f"🚀 {args.db_type.upper()} veritabanı kurulumu başlıyor...")
    
    if args.db_type == "postgresql":
        success = setup_postgresql_database(args.connection_string)
    else:  # mongodb
        success = setup_mongodb_database(args.connection_string, args.db_name)
    
    if success:
        print("\n✨ Veritabanı kurulumu başarıyla tamamlandı!")
        print("\n📝 Kullanım örnekleri:")
        
        if args.db_type == "postgresql":
            print(f"python category_route_planner_with_db.py --db-type postgresql --db-connection \"{args.connection_string}\"")
        else:
            print(f"python category_route_planner_with_db.py --db-type mongodb --db-connection \"{args.connection_string}\" --db-name {args.db_name}")
    else:
        print("\n❌ Veritabanı kurulumu başarısız oldu.")
        sys.exit(1)


if __name__ == "__main__":
    main()