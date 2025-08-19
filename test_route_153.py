#!/usr/bin/env python3
"""
Test script to check route 153 media in database
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_conn():
    """Get database connection"""
    # Try connection string first
    conn_str = os.getenv("POI_DB_CONNECTION")
    if conn_str:
        try:
            return psycopg2.connect(conn_str)
        except Exception as e:
            print(f"Connection string failed: {e}")
    
    # Fallback to individual environment variables
    db_config = {
        'host': os.getenv("DB_HOST", "127.0.0.1"),
        'port': int(os.getenv("DB_PORT", "5432")),
        'dbname': os.getenv("DB_NAME", "poi_db"),
        'user': os.getenv("DB_USER", "poi_user"),
        'password': os.getenv("DB_PASSWORD", "poi_password"),
    }
    
    print(f"Using database config: {db_config['host']}:{db_config['port']}/{db_config['dbname']}")
    return psycopg2.connect(**db_config)

def check_route_153():
    """Check what media exists for route 153"""
    conn = None
    cur = None
    try:
        conn = get_db_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if route 153 exists
        cur.execute("SELECT id, name FROM public.routes WHERE id=153")
        route = cur.fetchone()
        if route:
            print(f"✅ Route 153 found: {route['name']}")
        else:
            print("❌ Route 153 not found")
            return
        
        # Check route_media for route 153
        cur.execute("""
            SELECT id, file_path, lat, lng, media_type, uploaded_at 
            FROM route_media 
            WHERE route_id = 153
        """)
        media_records = cur.fetchall()
        
        print(f"📊 Found {len(media_records)} media records for route 153:")
        for record in media_records:
            print(f"  - ID: {record['id']}")
            print(f"    File: {record['file_path']}")
            print(f"    Location: ({record['lat']}, {record['lng']})")
            print(f"    Type: {record['media_type']}")
            print(f"    Uploaded: {record['uploaded_at']}")
            print()
        
        # Check if the specific file exists
        target_filename = "1503919453408-9ee4386d-5cd0-474f-b43a-6dcc5c8cecc4_.webp"
        cur.execute("""
            SELECT id, file_path, lat, lng 
            FROM route_media 
            WHERE route_id = 153 AND file_path LIKE %s
        """, (f"%{target_filename}",))
        
        target_record = cur.fetchone()
        if target_record:
            print(f"✅ Found database record for {target_filename}:")
            print(f"  - ID: {target_record['id']}")
            print(f"  - File: {target_record['file_path']}")
            print(f"  - Location: ({target_record['lat']}, {target_record['lng']})")
        else:
            print(f"❌ No database record found for {target_filename}")
            print("This explains the 500 error - the file exists in filesystem but not in database")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    check_route_153()
