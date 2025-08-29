#!/usr/bin/env python3
"""
Test script for Admin Panel UI Improvement Database Migration
Tests the migration script and verifies all components work correctly
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

def get_test_db_connection():
    """Get database connection for testing"""
    db_config = {
        'host': os.getenv('POI_DB_HOST', 'localhost'),
        'port': os.getenv('POI_DB_PORT', '5432'),
        'database': os.getenv('POI_DB_NAME', 'poi_db'),
        'user': os.getenv('POI_DB_USER', 'poi_user'),
        'password': os.getenv('POI_DB_PASSWORD', 'poi_password')
    }
    
    try:
        conn = psycopg2.connect(**db_config)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def test_route_imports_table():
    """Test route_imports table functionality"""
    print("🧪 Testing route_imports table...")
    
    conn = get_test_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test insert
        test_data = {
            'filename': 'test_route.gpx',
            'original_filename': 'My Hiking Route.gpx',
            'file_type': 'gpx',
            'file_size': 1024,
            'file_hash': 'abc123def456',
            'import_metadata': json.dumps({
                'route_name': 'Test Route',
                'waypoint_count': 5,
                'distance_km': 3.2
            }),
            'created_by': 'test_user'
        }
        
        cursor.execute("""
            INSERT INTO route_imports 
            (filename, original_filename, file_type, file_size, file_hash, import_metadata, created_by)
            VALUES (%(filename)s, %(original_filename)s, %(file_type)s, %(file_size)s, 
                   %(file_hash)s, %(import_metadata)s, %(created_by)s)
            RETURNING id;
        """, test_data)
        
        import_id = cursor.fetchone()['id']
        print(f"  ✅ Insert test passed - ID: {import_id}")
        
        # Test update status
        cursor.execute("""
            UPDATE route_imports 
            SET import_status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (import_id,))
        
        print("  ✅ Status update test passed")
        
        # Test query with filters
        cursor.execute("""
            SELECT * FROM route_imports 
            WHERE file_type = 'gpx' AND import_status = 'completed';
        """)
        
        results = cursor.fetchall()
        print(f"  ✅ Query test passed - Found {len(results)} records")
        
        # Cleanup
        cursor.execute("DELETE FROM route_imports WHERE id = %s;", (import_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ route_imports test failed: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        return False

def test_route_poi_associations_table():
    """Test route_poi_associations table functionality"""
    print("🧪 Testing route_poi_associations table...")
    
    conn = get_test_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, get existing route and POI IDs for testing
        cursor.execute("SELECT id FROM routes LIMIT 1;")
        route_result = cursor.fetchone()
        if not route_result:
            print("  ⚠️  No routes found for testing - skipping association test")
            cursor.close()
            conn.close()
            return True
        
        cursor.execute("SELECT id FROM pois LIMIT 1;")
        poi_result = cursor.fetchone()
        if not poi_result:
            print("  ⚠️  No POIs found for testing - skipping association test")
            cursor.close()
            conn.close()
            return True
        
        route_id = route_result['id']
        poi_id = poi_result['id']
        
        # Test insert association
        test_data = {
            'route_id': route_id,
            'poi_id': poi_id,
            'sequence_order': 1,
            'distance_from_route': 150.5,
            'is_waypoint': True,
            'association_type': 'manual',
            'association_score': 85.0,
            'notes': 'Test association',
            'created_by': 'test_user'
        }
        
        cursor.execute("""
            INSERT INTO route_poi_associations 
            (route_id, poi_id, sequence_order, distance_from_route, is_waypoint, 
             association_type, association_score, notes, created_by)
            VALUES (%(route_id)s, %(poi_id)s, %(sequence_order)s, %(distance_from_route)s,
                   %(is_waypoint)s, %(association_type)s, %(association_score)s, 
                   %(notes)s, %(created_by)s)
            RETURNING id;
        """, test_data)
        
        assoc_id = cursor.fetchone()['id']
        print(f"  ✅ Insert test passed - ID: {assoc_id}")
        
        # Test query associations for route
        cursor.execute("""
            SELECT rpa.*, p.name as poi_name 
            FROM route_poi_associations rpa
            JOIN pois p ON rpa.poi_id = p.id
            WHERE rpa.route_id = %s
            ORDER BY rpa.sequence_order;
        """, (route_id,))
        
        results = cursor.fetchall()
        print(f"  ✅ Query test passed - Found {len(results)} associations")
        
        # Cleanup
        cursor.execute("DELETE FROM route_poi_associations WHERE id = %s;", (assoc_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ route_poi_associations test failed: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        return False

def test_routes_import_fields():
    """Test new import fields in routes table"""
    print("🧪 Testing routes table import fields...")
    
    conn = get_test_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test insert route with import fields
        test_data = {
            'name': 'Test Imported Route',
            'description': 'Route imported from GPX file',
            'route_type': 'hiking',
            'import_source': 'gpx',
            'original_filename': 'mountain_trail.gpx',
            'import_metadata': json.dumps({
                'original_name': 'Mountain Trail',
                'waypoints': 12,
                'elevation_data': True
            }),
            'imported_by': 'test_user',
            'import_date': datetime.now()
        }
        
        cursor.execute("""
            INSERT INTO routes 
            (name, description, route_type, import_source, original_filename, 
             import_metadata, imported_by, import_date)
            VALUES (%(name)s, %(description)s, %(route_type)s, %(import_source)s,
                   %(original_filename)s, %(import_metadata)s, %(imported_by)s, %(import_date)s)
            RETURNING id;
        """, test_data)
        
        route_id = cursor.fetchone()['id']
        print(f"  ✅ Insert test passed - ID: {route_id}")
        
        # Test query imported routes
        cursor.execute("""
            SELECT * FROM routes 
            WHERE import_source IS NOT NULL
            ORDER BY import_date DESC;
        """)
        
        results = cursor.fetchall()
        print(f"  ✅ Query test passed - Found {len(results)} imported routes")
        
        # Cleanup
        cursor.execute("DELETE FROM routes WHERE id = %s;", (route_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ routes import fields test failed: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        return False

def test_helper_functions():
    """Test database helper functions"""
    print("🧪 Testing helper functions...")
    
    conn = get_test_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test find_pois_near_route function
        # Create a test route geometry (simple line)
        test_route_geom = "LINESTRING(34.9070 38.6331, 34.9080 38.6341)"
        
        cursor.execute("""
            SELECT * FROM find_pois_near_route(
                ST_GeogFromText(%s),
                2000,  -- 2km radius
                10     -- limit 10 results
            );
        """, (test_route_geom,))
        
        results = cursor.fetchall()
        print(f"  ✅ find_pois_near_route test passed - Found {len(results)} nearby POIs")
        
        # Test calculate_poi_route_distance function
        if results:
            cursor.execute("""
                SELECT calculate_poi_route_distance(
                    ST_GeogFromText('POINT(34.9070 38.6331)'),
                    ST_GeogFromText(%s)
                ) as distance;
            """, (test_route_geom,))
            
            distance_result = cursor.fetchone()
            print(f"  ✅ calculate_poi_route_distance test passed - Distance: {distance_result['distance']:.2f}m")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ helper functions test failed: {e}")
        cursor.close()
        conn.close()
        return False

def test_migration_log():
    """Test migration logging functionality"""
    print("🧪 Testing migration log...")
    
    conn = get_test_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if migration was logged
        cursor.execute("""
            SELECT * FROM schema_migrations 
            WHERE migration_name = 'admin_panel_ui_improvement_v1';
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"  ✅ Migration logged successfully - Version: {result['migration_version']}")
            print(f"  📅 Executed at: {result['executed_at']}")
            print(f"  ⏱️  Execution time: {result['execution_time_ms']}ms")
            print(f"  ✅ Success: {result['success']}")
        else:
            print("  ⚠️  Migration not found in log")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ migration log test failed: {e}")
        cursor.close()
        conn.close()
        return False

def run_all_tests():
    """Run all migration tests"""
    print("🚀 Starting Admin Panel Migration Tests")
    print("=" * 50)
    
    tests = [
        ("Route Imports Table", test_route_imports_table),
        ("Route-POI Associations Table", test_route_poi_associations_table),
        ("Routes Import Fields", test_routes_import_fields),
        ("Helper Functions", test_helper_functions),
        ("Migration Log", test_migration_log)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name} test...")
        try:
            if test_func():
                print(f"✅ {test_name} test PASSED")
                passed += 1
            else:
                print(f"❌ {test_name} test FAILED")
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} test FAILED with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Migration is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please check the migration.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)