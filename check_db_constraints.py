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
        
        # Check valid media types from constraint
        cur.execute("""
            SELECT unnest(enum_range(NULL::media_type_enum)) as valid_type
        """)
        valid_types = cur.fetchall()
        
        if valid_types:
            print(f"\n📊 Valid media types:")
            for t in valid_types:
                print(f"  - {t['valid_type']}")
        else:
            print(f"\n📊 No enum found, checking constraint definition...")
            # Try to extract from constraint definition
            for constraint in constraints:
                if 'media_type' in constraint['definition']:
                    print(f"  Media type constraint: {constraint['definition']}")
        
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
