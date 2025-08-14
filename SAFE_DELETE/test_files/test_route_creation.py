#!/usr/bin/env python3
"""
Test route creation and geometry saving
"""

import requests
import json

# Test data
test_route = {
    "name": "Test Rota",
    "description": "Test için oluşturulan rota",
    "route_type": "walking",
    "difficulty_level": 2,
    "estimated_duration": 60,
    "total_distance": 2.5,
    "is_circular": False,
    "tags": "test, debug"
}

test_waypoints = [
    {"lat": 38.6434, "lng": 34.9113, "name": "Test Point 1"},
    {"lat": 38.6444, "lng": 34.9123, "name": "Test Point 2"},
    {"lat": 38.6454, "lng": 34.9133, "name": "Test Point 3"}
]

def test_route_api():
    base_url = "http://localhost:5505"
    
    print("🧪 Testing route creation and geometry saving...")
    
    # Test 1: Route/smart API
    print("\n1. Testing route/smart API...")
    try:
        response = requests.post(f"{base_url}/api/route/smart", 
                               json={"waypoints": test_waypoints})
        print(f"   Status: {response.status_code}")
        if response.ok:
            route_data = response.json()
            print(f"   Success: {route_data.get('success')}")
            print(f"   Distance: {route_data.get('route', {}).get('total_distance')} km")
            print(f"   Time: {route_data.get('route', {}).get('estimated_time')} min")
            print(f"   Segments: {len(route_data.get('route', {}).get('segments', []))}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 2: Public routes API
    print("\n2. Testing public routes API...")
    try:
        response = requests.get(f"{base_url}/api/routes")
        print(f"   Status: {response.status_code}")
        if response.ok:
            routes_data = response.json()
            print(f"   Success: {routes_data.get('success')}")
            print(f"   Total routes: {routes_data.get('total', 0)}")
            routes = routes_data.get('routes', [])
            for route in routes[:3]:  # Show first 3
                print(f"     - {route.get('name')} (ID: {route.get('id')})")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")
    
    # Test 3: Route geometry API
    print("\n3. Testing route geometry API...")
    try:
        # Test with route ID 1
        response = requests.get(f"{base_url}/api/routes/1/geometry")
        print(f"   Status: {response.status_code}")
        if response.ok:
            geometry_data = response.json()
            print(f"   Success: {geometry_data.get('success')}")
            if geometry_data.get('success'):
                geometry = geometry_data.get('geometry', {})
                print(f"   Has geometry: {geometry.get('geometry') is not None}")
                print(f"   Distance: {geometry.get('total_distance')} km")
                print(f"   Duration: {geometry.get('estimated_duration')} min")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Exception: {e}")

if __name__ == "__main__":
    test_route_api()