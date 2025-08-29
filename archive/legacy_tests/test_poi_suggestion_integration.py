#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integration test for POI Suggestion API
Tests the complete POI suggestion functionality with database
"""

import sys
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_poi_suggestion_with_real_data():
    """Test POI suggestion with real database data"""
    print("🧪 Testing POI Suggestion with Real Data...")
    
    try:
        # Get database connection
        host = os.getenv('POI_DB_HOST', 'localhost')
        port = os.getenv('POI_DB_PORT', '5432')
        database = os.getenv('POI_DB_NAME', 'poi_db')
        user = os.getenv('POI_DB_USER', 'poi_user')
        password = os.getenv('POI_DB_PASSWORD', 'poi_password')
        
        connection_string = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        
        print(f"Connecting to database: {host}:{port}/{database}")
        conn = psycopg2.connect(connection_string)
        
        # Test 1: Check if we have routes in the database
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) as count FROM routes WHERE is_active = true")
            route_count = cur.fetchone()['count']
            print(f"Found {route_count} active routes in database")
            
            if route_count == 0:
                print("⚠️ No active routes found. Creating a test route...")
                # Create a test route
                test_route_geometry = "LINESTRING(34.9115 38.6322,34.9200 38.6350,34.9300 38.6280)"
                cur.execute("""
                    INSERT INTO routes (name, description, route_geometry, distance, is_active)
                    VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s, %s)
                    RETURNING id
                """, (
                    'Test Route for POI Suggestions',
                    'A test route to verify POI suggestion functionality',
                    test_route_geometry,
                    2500.0,  # 2.5km
                    True
                ))
                test_route_id = cur.fetchone()['id']
                conn.commit()
                print(f"Created test route with ID: {test_route_id}")
            else:
                # Get the first active route
                cur.execute("SELECT id, name FROM routes WHERE is_active = true LIMIT 1")
                route = cur.fetchone()
                test_route_id = route['id']
                print(f"Using existing route: {route['name']} (ID: {test_route_id})")
        
        # Test 2: Check if we have POIs in the database
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) as count FROM pois WHERE is_active = true")
            poi_count = cur.fetchone()['count']
            print(f"Found {poi_count} active POIs in database")
            
            if poi_count == 0:
                print("⚠️ No active POIs found. Creating test POIs...")
                # Create test POIs near the route
                test_pois = [
                    ('Test Museum', 'kulturel', 38.6325, 34.9120, 'A test museum for POI suggestions'),
                    ('Test Restaurant', 'gastronomik', 38.6340, 34.9180, 'A test restaurant for POI suggestions'),
                    ('Test Nature Point', 'doga_macera', 38.6285, 34.9290, 'A test nature point for POI suggestions')
                ]
                
                for name, category, lat, lon, description in test_pois:
                    cur.execute("""
                        INSERT INTO pois (name, category, location, description, is_active)
                        VALUES (%s, %s, ST_GeogFromText('POINT(%s %s)'), %s, %s)
                    """, (name, category, lon, lat, description, True))
                
                conn.commit()
                print(f"Created {len(test_pois)} test POIs")
        
        # Test 3: Test the POI suggestion algorithm
        print("\n🔍 Testing POI Suggestion Algorithm...")
        
        from poi_api import POISuggestionEngine
        
        suggestion_engine = POISuggestionEngine(conn)
        suggestions = suggestion_engine.suggest_pois_for_route(test_route_id, limit=10)
        
        print(f"Generated {len(suggestions)} POI suggestions for route {test_route_id}")
        
        if suggestions:
            print("\nTop suggestions:")
            for i, suggestion in enumerate(suggestions[:3], 1):
                print(f"{i}. {suggestion['name']} ({suggestion['category']})")
                print(f"   Distance: {suggestion['distance_from_route']}m")
                print(f"   Compatibility Score: {suggestion['compatibility_score']}")
                print(f"   Reason: {suggestion['suggestion_reason']}")
                print()
            
            # Verify suggestion structure
            required_fields = [
                'poi_id', 'name', 'category', 'description',
                'latitude', 'longitude', 'distance_from_route',
                'compatibility_score', 'avg_rating', 'suggestion_reason'
            ]
            
            for field in required_fields:
                assert field in suggestions[0], f"Missing field: {field}"
            
            # Verify suggestions are sorted by score
            for i in range(len(suggestions) - 1):
                assert suggestions[i]['compatibility_score'] >= suggestions[i + 1]['compatibility_score'], \
                    "Suggestions not sorted by compatibility score"
            
            print("✅ POI suggestion algorithm test passed!")
        else:
            print("⚠️ No suggestions generated. This might be expected if no POIs are near the route.")
        
        # Test 4: Test route coordinate extraction
        print("\n📍 Testing Route Coordinate Extraction...")
        
        coordinates = suggestion_engine.get_route_coordinates(test_route_id)
        print(f"Extracted {len(coordinates)} coordinates from route")
        
        if coordinates:
            print(f"First coordinate: {coordinates[0]}")
            print(f"Last coordinate: {coordinates[-1]}")
            
            # Verify coordinates are valid
            for lat, lon in coordinates:
                assert -90 <= lat <= 90, f"Invalid latitude: {lat}"
                assert -180 <= lon <= 180, f"Invalid longitude: {lon}"
            
            print("✅ Route coordinate extraction test passed!")
        else:
            print("❌ No coordinates extracted from route")
            return False
        
        conn.close()
        print("\n🎉 All integration tests passed!")
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_api_endpoint_response():
    """Test the API endpoint response format"""
    print("\n🌐 Testing API Endpoint Response Format...")
    
    try:
        from poi_api import app
        
        # Create test client
        with app.test_client() as client:
            # Note: This test would require authentication in a real scenario
            # For now, we'll just verify the endpoint exists and has the right structure
            
            # Check if the endpoint is registered
            routes = [rule.rule for rule in app.url_map.iter_rules()]
            poi_suggestion_route = '/api/routes/<int:route_id>/suggest-pois'
            
            # Find the actual route pattern
            matching_routes = [route for route in routes if 'suggest-pois' in route]
            
            assert len(matching_routes) > 0, "POI suggestion endpoint not found"
            print(f"Found POI suggestion endpoint: {matching_routes[0]}")
            
            print("✅ API endpoint structure test passed!")
            return True
            
    except Exception as e:
        print(f"❌ API endpoint test failed: {e}")
        return False

def run_integration_tests():
    """Run all integration tests"""
    print("🧪 Running POI Suggestion Integration Tests...")
    print("=" * 60)
    
    tests = [
        test_poi_suggestion_with_real_data,
        test_api_endpoint_response
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with error: {e}")
            failed += 1
        print()
    
    print("=" * 60)
    print(f"Integration Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All integration tests passed!")
        return True
    else:
        print("❌ Some integration tests failed!")
        return False

if __name__ == '__main__':
    success = run_integration_tests()
    sys.exit(0 if success else 1)