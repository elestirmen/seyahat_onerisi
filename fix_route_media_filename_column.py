#!/usr/bin/env python3
"""
Migration script to add the missing filename column to route_media table.
This fixes the issue where the API tries to query by filename but the column doesn't exist.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import sys

def get_db_conn():
    """Get database connection"""
    conn_str = os.getenv("POI_DB_CONNECTION")
    if conn_str:
        return psycopg2.connect(conn_str)
    else:
        return psycopg2.connect(
            host=os.getenv("POI_DB_HOST", "127.0.0.1"),
            port=int(os.getenv("POI_DB_PORT", "5432")),
            dbname=os.getenv("POI_DB_NAME", "poi_db"),
            user=os.getenv("POI_DB_USER", "poi_user"),
            password=os.getenv("POI_DB_PASSWORD", "poi_password"),
        )

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = %s AND column_name = %s
    """, (table_name, column_name))
    return cursor.fetchone() is not None

def add_filename_column():
    """Add filename column to route_media table if it doesn't exist"""
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("🔍 Checking if filename column exists in route_media table...")
        
        if not check_column_exists(cur, 'route_media', 'filename'):
            print("📝 Adding filename column to route_media table...")
            
            # Add the filename column
            cur.execute("""
                ALTER TABLE route_media 
                ADD COLUMN filename VARCHAR(255);
            """)
            
            # Add a comment explaining the column
            cur.execute("""
                COMMENT ON COLUMN route_media.filename IS 
                'Filename extracted from file_path for easier querying';
            """)
            
            # Create an index on filename for better performance
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_route_media_filename 
                ON route_media(filename);
            """)
            
            print("✅ filename column added successfully")
            
            # Now populate existing records with filename extracted from file_path
            print("🔄 Populating filename column for existing records...")
            cur.execute("""
                UPDATE route_media 
                SET filename = CASE 
                    WHEN file_path IS NOT NULL THEN 
                        CASE 
                            WHEN file_path LIKE '%/%' THEN 
                                split_part(file_path, '/', -1)
                            ELSE file_path
                        END
                    ELSE NULL
                END
                WHERE filename IS NULL;
            """)
            
            updated_count = cur.rowcount
            print(f"✅ Updated {updated_count} existing records with filename")
            
            # Make filename NOT NULL after populating
            cur.execute("""
                ALTER TABLE route_media 
                ALTER COLUMN filename SET NOT NULL;
            """)
            
            print("✅ filename column set to NOT NULL")
            
        else:
            print("ℹ️ filename column already exists in route_media table")
        
        # Commit the changes
        conn.commit()
        print("✅ Migration completed successfully")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 Starting route_media filename column migration...")
    add_filename_column()
    print("🎉 Migration completed!")