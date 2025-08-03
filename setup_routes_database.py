#!/usr/bin/env python3
"""
Routes Database Setup Script
Creates routes, route_pois, and route_ratings tables
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import json

def setup_routes_database():
    """Setup routes database tables"""
    
    # Database connection
    db_config = {
        'host': os.getenv('POI_DB_HOST', 'localhost'),
        'port': os.getenv('POI_DB_PORT', '5432'),
        'database': os.getenv('POI_DB_NAME', 'poi_db'),
        'user': os.getenv('POI_DB_USER', 'poi_user'),
        'password': os.getenv('POI_DB_PASSWORD', 'poi_password')
    }
    
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        print("🗺️ Creating routes tables...")
        
        # Routes table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS routes (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                route_type VARCHAR(50) NOT NULL DEFAULT 'walking',
                difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5) DEFAULT 1,
                estimated_duration INTEGER, -- dakika
                total_distance FLOAT, -- km
                elevation_gain INTEGER, -- metre
                route_geometry GEOGRAPHY(LINESTRING, 4326),
                waypoints JSONB,
                start_poi_id INTEGER REFERENCES pois(id),
                end_poi_id INTEGER REFERENCES pois(id),
                is_circular BOOLEAN DEFAULT false,
                season_availability JSONB DEFAULT '["spring", "summer", "autumn", "winter"]',
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        """)
        
        # Route-POI junction table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS route_pois (
                id SERIAL PRIMARY KEY,
                route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
                poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
                order_in_route INTEGER NOT NULL,
                is_mandatory BOOLEAN DEFAULT true,
                estimated_time_at_poi INTEGER DEFAULT 15, -- dakika
                notes TEXT,
                UNIQUE(route_id, poi_id)
            );
        """)
        
        # Route ratings table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS route_ratings (
                route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
                category TEXT,
                rating INTEGER CHECK (rating BETWEEN 0 AND 100),
                PRIMARY KEY (route_id, category)
            );
        """)
        
        # Indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_routes_type ON routes(route_type);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_routes_difficulty ON routes(difficulty_level);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_routes_active ON routes(is_active);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_routes_geometry ON routes USING GIST(route_geometry);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_route_pois_route_id ON route_pois(route_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_route_pois_order ON route_pois(route_id, order_in_route);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_route_ratings_route_id ON route_ratings(route_id);")
        
        conn.commit()
        print("✅ Routes tables created successfully")
        
        # Sample data
        print("📝 Adding sample routes...")
        
        # Sample route 1: Ürgüp Historic Walking Tour
        cur.execute("""
            INSERT INTO routes (name, description, route_type, difficulty_level, estimated_duration, 
                              total_distance, elevation_gain, is_circular, tags)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING id;
        """, (
            "Ürgüp Tarihi Yürüyüş Turu",
            "Ürgüp'ün tarihi merkezini keşfeden yürüyüş rotası. Tarihi camiler, geleneksel evler ve yerel kültürü deneyimleyin.",
            "walking",
            2,  # Orta zorluk
            120,  # 2 saat
            3.5,  # 3.5 km
            50,   # 50m yükselti
            True,  # Dairesel rota
            "tarihi, kültürel, merkez, yürüyüş"
        ))
        
        route_id = cur.fetchone()
        if route_id:
            route_id = route_id[0]
            
            # Route ratings
            ratings = [
                ('scenic_beauty', 75),
                ('historical', 95),
                ('cultural', 90),
                ('family_friendly', 85),
                ('photography', 80)
            ]
            
            for category, rating in ratings:
                cur.execute("""
                    INSERT INTO route_ratings (route_id, category, rating)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (route_id, category) DO UPDATE SET rating = EXCLUDED.rating;
                """, (route_id, category, rating))
        
        # Sample route 2: Kapadokya Doğa Yürüyüşü
        cur.execute("""
            INSERT INTO routes (name, description, route_type, difficulty_level, estimated_duration, 
                              total_distance, elevation_gain, is_circular, tags)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING;
        """, (
            "Kapadokya Vadiler Doğa Yürüyüşü",
            "Kapadokya'nın eşsiz jeolojik oluşumlarını keşfeden doğa yürüyüşü. Peribacaları, vadiler ve mağara kiliseler.",
            "hiking",
            4,  # Zor
            240,  # 4 saat
            8.2,  # 8.2 km
            200,  # 200m yükselti
            False,  # Doğrusal rota
            "doğa, peribacaları, vadiler, macera"
        ))
        
        conn.commit()
        print("✅ Sample routes added")
        
        cur.close()
        conn.close()
        
        print("🎉 Routes database setup completed!")
        
    except Exception as e:
        print(f"❌ Error setting up routes database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_routes_database()