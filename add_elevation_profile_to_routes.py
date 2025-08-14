#!/usr/bin/env python3
"""
Veritabanına elevation profile desteği ekler
Routes tablosuna elevation_profile JSONB kolonu ekler
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import json

def add_elevation_profile_column():
    """Routes tablosuna elevation_profile kolonu ekle"""
    
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
        
        print("🏔️ Adding elevation profile support to routes table...")
        
        # Check if column already exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'elevation_profile'
        """)
        
        if cur.fetchone():
            print("⚠️ elevation_profile column already exists")
        else:
            # Add elevation_profile column
            cur.execute("""
                ALTER TABLE routes 
                ADD COLUMN elevation_profile JSONB;
            """)
            print("✅ Added elevation_profile column")
        
        # Check if elevation_resolution column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'elevation_resolution'
        """)
        
        if cur.fetchone():
            print("⚠️ elevation_resolution column already exists")
        else:
            # Add elevation_resolution column (meters between points)
            cur.execute("""
                ALTER TABLE routes 
                ADD COLUMN elevation_resolution INTEGER DEFAULT 100;
            """)
            print("✅ Added elevation_resolution column")
            
        # Add indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_routes_elevation_profile ON routes USING GIN(elevation_profile);")
        print("✅ Added elevation_profile index")
        
        # Add comment
        cur.execute("""
            COMMENT ON COLUMN routes.elevation_profile IS 
            'Elevation profile data as JSONB: {
                "points": [{"distance": 0.0, "elevation": 1050, "lat": 38.123, "lng": 34.456}],
                "stats": {"min": 950, "max": 1200, "gain": 250, "loss": 100},
                "resolution": 100,
                "last_updated": "2024-01-01T00:00:00Z"
            }';
        """)
        
        cur.execute("""
            COMMENT ON COLUMN routes.elevation_resolution IS 
            'Distance in meters between elevation points (default: 100m)';
        """)
        
        conn.commit()
        print("✅ Elevation profile support added successfully")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    add_elevation_profile_column()
