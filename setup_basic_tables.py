#!/usr/bin/env python3
"""
Basic database setup script to create the required tables for route media functionality.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_conn():
    """Get database connection"""
    conn_str = os.getenv("POI_DB_CONNECTION")
    if conn_str:
        return psycopg2.connect(conn_str)
    else:
        return psycopg2.connect(
            host=os.getenv("POI_DB_HOST", "localhost"),
            port=int(os.getenv("POI_DB_PORT", "5432")),
            dbname=os.getenv("POI_DB_NAME", "poi_db"),
            user=os.getenv("POI_DB_USER", "poi_user"),
            password=os.getenv("POI_DB_PASSWORD", "poi_password"),
        )

def setup_basic_tables():
    """Setup basic database tables"""
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        
        print("🗺️ Creating basic tables...")
        
        # Create routes table first
        cur.execute("""
            CREATE TABLE IF NOT EXISTS routes (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                route_type VARCHAR(50) DEFAULT 'walking',
                difficulty_level INTEGER DEFAULT 1,
                estimated_duration INTEGER,
                total_distance FLOAT,
                elevation_gain INTEGER,
                is_circular BOOLEAN DEFAULT false,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        """)
        print("✅ Routes table created")
        
        # Create route_media table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS route_media (
                id SERIAL PRIMARY KEY,
                route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
                file_path VARCHAR(255) NOT NULL,
                thumbnail_path VARCHAR(255),
                preview_path VARCHAR(255),
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                caption TEXT,
                is_primary BOOLEAN DEFAULT FALSE,
                media_type VARCHAR(20) DEFAULT 'image',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("✅ Route media table created")
        
        # Create indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_route_media_route_id ON route_media(route_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_route_media_location ON route_media(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;")
        print("✅ Indexes created")
        
        # Insert a test route
        cur.execute("""
            INSERT INTO routes (id, name, description, route_type, difficulty_level)
            VALUES (154, 'Test Route 154', 'Test route for media location testing', 'walking', 2)
            ON CONFLICT (id) DO NOTHING;
        """)
        print("✅ Test route 154 created")
        
        conn.commit()
        print("🎉 Basic tables setup completed!")
        
    except Exception as e:
        print(f"❌ Error setting up basic tables: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 Starting basic database setup...")
    setup_basic_tables()
    print("✅ Setup completed successfully!")