#!/usr/bin/env python3
"""
Test script to check database connectivity and help debug connection issues
"""

import os
import sys

def test_database_connection():
    """Test database connection with various methods"""
    
    print("🔍 Testing database connection...")
    
    # Check environment variables
    print("\n📋 Environment variables:")
    db_vars = [
        'POI_DB_CONNECTION',
        'POI_DB_HOST', 
        'POI_DB_PORT',
        'POI_DB_NAME',
        'POI_DB_USER',
        'POI_DB_PASSWORD'
    ]
    
    for var in db_vars:
        value = os.getenv(var)
        if value:
            # Mask password for security
            if 'PASSWORD' in var:
                masked_value = '*' * min(len(value), 8) + value[-4:] if len(value) > 4 else '*'
                print(f"  {var}: {masked_value}")
            else:
                print(f"  {var}: {value}")
        else:
            print(f"  {var}: Not set")
    
    # Try to import required modules
    print("\n📦 Checking required modules:")
    try:
        import psycopg2
        print(f"  ✅ psycopg2: {psycopg2.__version__}")
    except ImportError as e:
        print(f"  ❌ psycopg2: {e}")
        return False
    
    try:
        from psycopg2.extras import RealDictCursor
        print("  ✅ RealDictCursor: Available")
    except ImportError as e:
        print(f"  ❌ RealDictCursor: {e}")
        return False
    
    # Try to connect to database
    print("\n🔌 Testing database connection:")
    
    # Method 1: Using POI_DB_CONNECTION
    conn_str = os.getenv("POI_DB_CONNECTION")
    if conn_str:
        print(f"  🔍 Trying connection string: {conn_str[:20]}...")
        try:
            conn = psycopg2.connect(conn_str)
            print("  ✅ Connection successful using POI_DB_CONNECTION")
            conn.close()
        except Exception as e:
            print(f"  ❌ Connection failed: {e}")
    
    # Method 2: Using individual environment variables
    host = os.getenv("POI_DB_HOST", "127.0.0.1")
    port = int(os.getenv("POI_DB_PORT", "5432"))
    dbname = os.getenv("POI_DB_NAME", "poi_db")
    user = os.getenv("POI_DB_USER", "poi_user")
    password = os.getenv("POI_DB_PASSWORD", "poi_password")
    
    print(f"  🔍 Trying individual params: {user}@{host}:{port}/{dbname}")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password
        )
        print("  ✅ Connection successful using individual params")
        
        # Test basic query
        cur = conn.cursor()
        cur.execute("SELECT version()")
        version = cur.fetchone()
        print(f"  📊 PostgreSQL version: {version[0]}")
        
        # Check if route_media table exists
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'route_media'
        """)
        table_exists = cur.fetchone()
        if table_exists:
            print("  ✅ route_media table exists")
            
            # Check table structure
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'route_media'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            print("  📋 Table structure:")
            for col in columns:
                print(f"    - {col[0]}: {col[1]} ({'NULL' if col[2] == 'YES' else 'NOT NULL'})")
        else:
            print("  ❌ route_media table does not exist")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        return False
    
    return True

def test_media_manager():
    """Test POIMediaManager initialization"""
    
    print("\n📁 Testing POIMediaManager:")
    
    try:
        from poi_media_manager import POIMediaManager
        print("  ✅ POIMediaManager imported successfully")
        
        # Try to initialize
        try:
            manager = POIMediaManager()
            print("  ✅ POIMediaManager initialized successfully")
            
            # Check base paths
            print(f"  📂 Base path: {manager.base_path}")
            print(f"  📂 Thumbnails path: {manager.thumbnails_path}")
            print(f"  📂 Previews path: {manager.previews_path}")
            
            # Check if directories exist
            print(f"  📁 Base path exists: {manager.base_path.exists()}")
            print(f"  📁 Thumbnails path exists: {manager.thumbnails_path.exists()}")
            print(f"  📁 Previews path exists: {manager.previews_path.exists()}")
            
        except Exception as e:
            print(f"  ❌ POIMediaManager initialization failed: {e}")
            return False
            
    except ImportError as e:
        print(f"  ❌ POIMediaManager import failed: {e}")
        return False
    
    return True

def main():
    """Main test function"""
    
    print("🚀 Database Connection Test")
    print("=" * 50)
    
    # Test database connection
    db_ok = test_database_connection()
    
    # Test media manager
    media_ok = test_media_manager()
    
    # Summary
    print("\n📊 Test Summary:")
    print("=" * 50)
    print(f"  Database Connection: {'✅ PASS' if db_ok else '❌ FAIL'}")
    print(f"  Media Manager: {'✅ PASS' if media_ok else '❌ FAIL'}")
    
    if db_ok and media_ok:
        print("\n🎉 All tests passed! The system should work correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        
        if not db_ok:
            print("\n💡 Database Connection Issues:")
            print("  - Make sure PostgreSQL is running")
            print("  - Check environment variables")
            print("  - Verify database credentials")
            print("  - Ensure database and user exist")
        
        if not media_ok:
            print("\n💡 Media Manager Issues:")
            print("  - Check Python dependencies")
            print("  - Verify file permissions")
            print("  - Ensure media directories exist")

if __name__ == "__main__":
    main()