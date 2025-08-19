#!/usr/bin/env python3
"""
Check database schema for route_media table
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

def check_db_schema():
    """Check the database schema for route_media table"""
    try:
        # Use the connection string from environment
        conn_str = os.getenv("POI_DB_CONNECTION")
        if not conn_str:
            print("❌ POI_DB_CONNECTION not set")
            return
        
        print(f"🔍 Connecting to database...")
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check ID column type
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'route_media' AND column_name = 'id'
        """)
        result = cur.fetchone()
        if result:
            print(f"✅ ID column type: {result['data_type']}")
            print(f"   Is nullable: {result['is_nullable']}")
        else:
            print("❌ Could not find ID column")
            return
        
        # Check sample records
        cur.execute("""
            SELECT id, route_id, file_path 
            FROM route_media 
            WHERE route_id = 153 
            LIMIT 3
        """)
        results = cur.fetchall()
        print(f"\n📊 Sample records for route 153:")
        for r in results:
            print(f"  ID: {r['id']} (type: {type(r['id'])})")
            print(f"  Route ID: {r['route_id']}")
            print(f"  File: {r['file_path']}")
            print()
        
        # Check if there are any UUID records
        cur.execute("""
            SELECT COUNT(*) as count
            FROM route_media 
            WHERE id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        """)
        uuid_count = cur.fetchone()
        print(f"📊 Records with UUID format: {uuid_count['count']}")
        
        # Check if there are any integer records
        cur.execute("""
            SELECT COUNT(*) as count
            FROM route_media 
            WHERE id::text ~ '^[0-9]+$'
        """)
        int_count = cur.fetchone()
        print(f"📊 Records with integer format: {int_count['count']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    check_db_schema()
