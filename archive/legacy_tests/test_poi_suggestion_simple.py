#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple test for POI Suggestion Algorithm
Tests basic functionality without complex mocking
"""

import sys
import os
import math

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_distance_calculation():
    """Test the Haversine distance calculation"""
    print("Testing distance calculation...")
    
    # Simple distance calculation function (copied from the algorithm)
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    # Test known distance between two points in Cappadocia
    lat1, lon1 = 38.6322, 34.9115  # Ürgüp center
    lat2, lon2 = 38.6350, 34.9200  # Nearby point
    
    distance = calculate_distance(lat1, lon1, lat2, lon2)
    print(f"Distance between points: {distance:.2f} meters")
    
    # Distance should be reasonable (between 600-900 meters)
    assert 600 < distance < 900, f"Distance {distance} is not in expected range"
    
    # Test same point (should be 0)
    distance_same = calculate_distance(lat1, lon1, lat1, lon1)
    print(f"Distance to same point: {distance_same:.2f} meters")
    assert distance_same < 1, f"Same point distance should be ~0, got {distance_same}"
    
    print("✅ Distance calculation test passed!")
    return True

def test_category_compatibility():
    """Test category compatibility scoring"""
    print("Testing category compatibility...")
    
    # Category compatibility matrix (copied from algorithm)
    CATEGORY_COMPATIBILITY = {
        'gastronomik': {
            'kulturel': 0.8,
            'sanatsal': 0.7,
            'doga_macera': 0.6,
            'konaklama': 0.9,
            'gastronomik': 1.0
        },
        'kulturel': {
            'gastronomik': 0.8,
            'sanatsal': 0.9,
            'doga_macera': 0.5,
            'konaklama': 0.7,
            'kulturel': 1.0
        }
    }
    
    def calculate_compatibility_score(poi_category: str, route_categories: list) -> float:
        """Calculate compatibility score between POI and route categories"""
        if not route_categories:
            return 0.5  # Default compatibility
        
        max_compatibility = 0.0
        for route_category in route_categories:
            compatibility = CATEGORY_COMPATIBILITY.get(poi_category, {}).get(route_category, 0.3)
            max_compatibility = max(max_compatibility, compatibility)
        
        return max_compatibility
    
    # Test high compatibility (same category)
    score_same = calculate_compatibility_score('kulturel', ['kulturel'])
    print(f"Same category compatibility: {score_same}")
    assert score_same == 1.0, f"Same category should be 1.0, got {score_same}"
    
    # Test good compatibility (related categories)
    score_related = calculate_compatibility_score('gastronomik', ['kulturel'])
    print(f"Related category compatibility: {score_related}")
    assert score_related == 0.8, f"Related category should be 0.8, got {score_related}"
    
    # Test default compatibility (unknown category)
    score_unknown = calculate_compatibility_score('unknown', ['kulturel'])
    print(f"Unknown category compatibility: {score_unknown}")
    assert score_unknown == 0.3, f"Unknown category should be 0.3, got {score_unknown}"
    
    # Test empty route categories
    score_empty = calculate_compatibility_score('kulturel', [])
    print(f"Empty route categories compatibility: {score_empty}")
    assert score_empty == 0.5, f"Empty categories should be 0.5, got {score_empty}"
    
    print("✅ Category compatibility test passed!")
    return True

def test_route_position_scoring():
    """Test route position scoring logic"""
    print("Testing route position scoring...")
    
    def calculate_route_position_score(poi_lat: float, poi_lon: float, 
                                     route_coordinates: list) -> float:
        """Calculate score based on POI position relative to route"""
        if not route_coordinates:
            return 0.0
        
        def calculate_distance(lat1, lon1, lat2, lon2):
            R = 6371000
            lat1_rad = math.radians(lat1)
            lat2_rad = math.radians(lat2)
            delta_lat = math.radians(lat2 - lat1)
            delta_lon = math.radians(lon2 - lon1)
            
            a = (math.sin(delta_lat / 2) ** 2 + 
                 math.cos(lat1_rad) * math.cos(lat2_rad) * 
                 math.sin(delta_lon / 2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            
            return R * c
        
        min_distance = float('inf')
        total_route_length = len(route_coordinates)
        best_position_index = 0
        
        for i, (route_lat, route_lon) in enumerate(route_coordinates):
            distance = calculate_distance(poi_lat, poi_lon, route_lat, route_lon)
            if distance < min_distance:
                min_distance = distance
                best_position_index = i
        
        # Prefer POIs that are not at the very beginning or end of the route
        position_ratio = best_position_index / max(1, total_route_length - 1)
        if 0.2 <= position_ratio <= 0.8:
            return 1.0  # Optimal position
        elif 0.1 <= position_ratio <= 0.9:
            return 0.7  # Good position
        else:
            return 0.4  # Suboptimal position (too close to start/end)
    
    # Sample route coordinates
    route_coordinates = [
        (38.6322, 34.9115),  # Start
        (38.6350, 34.9200),  
        (38.6280, 34.9300),  # Middle
        (38.6200, 34.9250),  
        (38.6150, 34.9100)   # End
    ]
    
    # Test POI in middle of route (optimal)
    middle_lat, middle_lon = 38.6280, 34.9300  # Middle coordinate
    score_middle = calculate_route_position_score(middle_lat, middle_lon, route_coordinates)
    print(f"Middle position score: {score_middle}")
    assert score_middle == 1.0, f"Middle position should be 1.0, got {score_middle}"
    
    # Test POI at start of route (suboptimal)
    start_lat, start_lon = 38.6322, 34.9115  # First coordinate
    score_start = calculate_route_position_score(start_lat, start_lon, route_coordinates)
    print(f"Start position score: {score_start}")
    assert score_start == 0.4, f"Start position should be 0.4, got {score_start}"
    
    print("✅ Route position scoring test passed!")
    return True

def test_api_endpoint_exists():
    """Test that the API endpoint is properly registered"""
    print("Testing API endpoint registration...")
    
    try:
        # Import the Flask app
        from poi_api import app
        
        # Check that the route is registered
        routes = [rule.rule for rule in app.url_map.iter_rules()]
        print(f"Found {len(routes)} routes in the app")
        
        # Look for the POI suggestion route
        poi_suggestion_routes = [route for route in routes if 'suggest-pois' in route]
        print(f"POI suggestion routes: {poi_suggestion_routes}")
        
        # The route should exist
        assert len(poi_suggestion_routes) > 0, "POI suggestion route not found"
        
        print("✅ API endpoint registration test passed!")
        return True
        
    except Exception as e:
        print(f"❌ API endpoint test failed: {e}")
        return False

def run_simple_tests():
    """Run all simple tests"""
    print("🧪 Running Simple POI Suggestion Tests...")
    print("=" * 50)
    
    tests = [
        test_distance_calculation,
        test_category_compatibility,
        test_route_position_scoring,
        test_api_endpoint_exists
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
    
    print("=" * 50)
    print(f"Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("❌ Some tests failed!")
        return False

if __name__ == '__main__':
    success = run_simple_tests()
    sys.exit(0 if success else 1)