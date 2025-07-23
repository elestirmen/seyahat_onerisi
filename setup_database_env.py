#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Environment Setup Script
Sets up environment variables and tests database connection
"""

import os
import sys
from database_migration import DatabaseMigration

def setup_environment():
    """Set up environment variables for POI database"""
    
    # Set environment variables
    os.environ['POI_DB_TYPE'] = 'postgresql'
    os.environ['POI_DB_CONNECTION'] = 'postgresql://poi_user:poi_password@localhost/poi_db'
    os.environ['POI_DB_NAME'] = 'poi_db'
    
    print("✅ Environment variables set:")
    print(f"   POI_DB_TYPE: {os.environ.get('POI_DB_TYPE')}")
    print(f"   POI_DB_CONNECTION: {os.environ.get('POI_DB_CONNECTION')}")
    print(f"   POI_DB_NAME: {os.environ.get('POI_DB_NAME')}")
    
    return True

def test_database_connection():
    """Test database connection and schema"""
    
    try:
        connection_string = os.environ.get('POI_DB_CONNECTION')
        print(f"\n🔍 Testing database connection...")
        
        migration = DatabaseMigration(connection_string)
        migration.connect()
        
        print("✅ Database connection successful!")
        
        # Validate schema
        status = migration.validate_schema()
        print(f"\n📋 Schema validation:")
        print(f"   Schema valid: {status.schema_valid}")
        print(f"   PostGIS available: {status.postgis_available}")
        print(f"   Missing tables: {status.missing_tables}")
        print(f"   Missing columns: {status.missing_columns}")
        print(f"   Needs data import: {status.needs_data_import}")
        
        migration.disconnect()
        
        return status.schema_valid
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_api_connection():
    """Test API database connection"""
    
    try:
        print(f"\n🔍 Testing API database connection...")
        
        # Import after setting environment variables
        from poi_api import get_db
        
        db = get_db()
        if db:
            print("✅ API database connection successful!")
            
            # Test a simple query
            pois = db.get_pois_by_category('gastronomik')
            print(f"   Found {len(pois)} gastronomik POIs")
            
            db.disconnect()
            return True
        else:
            print("❌ API database connection failed - using JSON fallback")
            return False
            
    except Exception as e:
        print(f"❌ API connection test failed: {e}")
        return False

def main():
    """Main setup function"""
    
    print("🚀 POI Database Environment Setup")
    print("=" * 50)
    
    # Setup environment
    setup_environment()
    
    # Test database connection
    db_ok = test_database_connection()
    
    # Test API connection
    api_ok = test_api_connection()
    
    print("\n" + "=" * 50)
    if db_ok and api_ok:
        print("✅ Database setup completed successfully!")
        print("\nTo run the API with proper database connection:")
        print("export POI_DB_TYPE=postgresql")
        print("export POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db")
        print("export POI_DB_NAME=poi_db")
        print("python3 poi_api.py")
    else:
        print("❌ Database setup has issues!")
        if not db_ok:
            print("   - Database connection or schema issues")
        if not api_ok:
            print("   - API database integration issues")

if __name__ == "__main__":
    main()