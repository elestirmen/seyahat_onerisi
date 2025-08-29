#!/usr/bin/env python3
"""
Test script to test the API endpoints that were previously failing
"""

import requests
import json

def test_api_endpoints():
    """Test the API endpoints that were previously failing"""
    
    # Base URL from the error message
    base_url = "https://harita.urgup.keenetic.link"
    
    # Test parameters
    route_id = 153
    filename = "1503919453408-9ee4386d-5cd0-474f-b43a-6dcc5c8cecc4_.webp"
    lat = 38.6293
    lng = 34.6283
    
    print(f"🔍 Testing API endpoints for route {route_id}, file {filename}")
    print(f"Base URL: {base_url}")
    print()
    
    # Test 1: PUT endpoint for updating location
    print("🔍 Test 1: PUT /api/admin/routes/{route_id}/media/{filename}/location")
    try:
        url = f"{base_url}/api/admin/routes/{route_id}/media/{filename}/location"
        data = {
            "latitude": lat,
            "longitude": lng
        }
        
        response = requests.put(url, json=data, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ PUT endpoint working - location updated successfully")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ PUT endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing PUT endpoint: {e}")
    
    print()
    
    # Test 2: DELETE endpoint for removing location
    print("🔍 Test 2: DELETE /api/admin/routes/{route_id}/media/{filename}/location")
    try:
        url = f"{base_url}/api/admin/routes/{route_id}/media/{filename}/location"
        
        response = requests.delete(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ DELETE endpoint working - location removed successfully")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ DELETE endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing DELETE endpoint: {e}")
    
    print()
    
    # Test 3: PATCH endpoint for updating media
    print("🔍 Test 3: PATCH /api/admin/routes/{route_id}/media/{filename}")
    try:
        url = f"{base_url}/api/admin/routes/{route_id}/media/{filename}"
        data = {
            "caption": "Test caption update",
            "is_primary": False
        }
        
        response = requests.patch(url, json=data, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ PATCH endpoint working - media updated successfully")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ PATCH endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing PATCH endpoint: {e}")

if __name__ == "__main__":
    test_api_endpoints()