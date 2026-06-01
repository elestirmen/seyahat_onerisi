#!/usr/bin/env python3
"""
Check database constraints for route_media table
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

def check_db_constraints():
    """Check the database constraints for route_media table"""
    try:
        # Use the connection string from environment
        conn_str = os.getenv("POI_DB_CONNECTION")
        if not conn_str:
            print("❌ POI_DB_CONNECTION not set")
            return
        
        print(f"🔍 Connecting to database...")
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check constraints
        cur.execute("""
            SELECT conname, contype, pg_get_constraintdef(oid) as definition
            FROM pg_constraint 
            WHERE conrelid = 'route_media'::regclass
        """)
        constraints = cur.fetchall()
        
        print(f"📊 Found {len(constraints)} constraints:")
        for constraint in constraints:
            print(f"  - {constraint['conname']}: {constraint['definition']}")
        
        print(f"\n📊 Media type constraints:")
        media_type_constraints = [
            constraint for constraint in constraints
            if 'media_type' in constraint['definition']
        ]
        if media_type_constraints:
            for constraint in media_type_constraints:
                print(f"  - {constraint['conname']}: {constraint['definition']}")
        else:
            print("  - No media type constraint found")
        
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
    check_db_constraints()
