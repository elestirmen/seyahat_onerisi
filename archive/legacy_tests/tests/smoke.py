#!/usr/bin/env python3
"""
Smoke tests for critical API endpoints.
These tests ensure the basic functionality is working after deployments.
"""

import requests
import json
import sys
import os
from typing import Dict, Any

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:5000')
TIMEOUT = 10

def test_health_endpoint():
    """Test health check endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/health', timeout=TIMEOUT)
        assert response.status_code == 200, f"Health check failed with status {response.status_code}"
        
        data = response.json()
        assert 'status' in data, "Health response missing 'status' field"
        assert data['status'] in ['healthy', 'unhealthy'], f"Invalid health status: {data['status']}"
        assert 'timestamp' in data, "Health response missing 'timestamp' field"
        
        print("✅ Health endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
        return False

def test_pois_endpoint():
    """Test POI listing endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/api/pois', timeout=TIMEOUT)
        assert response.status_code == 200, f"POI listing failed with status {response.status_code}"
        
        data = response.json()
        assert 'pois' in data, "POI response missing 'pois' field"
        assert isinstance(data['pois'], list), "POI 'pois' field should be a list"
        assert 'total' in data, "POI response missing 'total' field"
        
        print("✅ POI listing endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ POI listing endpoint test failed: {e}")
        return False

def test_search_endpoint():
    """Test POI search endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/api/search?q=test', timeout=TIMEOUT)
        assert response.status_code == 200, f"Search failed with status {response.status_code}"
        
        data = response.json()
        assert 'results' in data, "Search response missing 'results' field"
        assert isinstance(data['results'], list), "Search 'results' field should be a list"
        assert 'total' in data, "Search response missing 'total' field"
        
        print("✅ Search endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ Search endpoint test failed: {e}")
        return False

def test_auth_status_endpoint():
    """Test authentication status endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/auth/status', timeout=TIMEOUT)
        assert response.status_code == 200, f"Auth status failed with status {response.status_code}"
        
        data = response.json()
        assert 'authenticated' in data, "Auth status response missing 'authenticated' field"
        assert isinstance(data['authenticated'], bool), "Auth 'authenticated' field should be boolean"
        
        print("✅ Auth status endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ Auth status endpoint test failed: {e}")
        return False

def test_routes_endpoint():
    """Test predefined routes endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/api/routes', timeout=TIMEOUT)
        assert response.status_code == 200, f"Routes failed with status {response.status_code}"
        
        data = response.json()
        assert 'routes' in data, "Routes response missing 'routes' field"
        assert isinstance(data['routes'], list), "Routes 'routes' field should be a list"
        assert 'total' in data, "Routes response missing 'total' field"
        
        print("✅ Routes endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ Routes endpoint test failed: {e}")
        return False

def run_smoke_tests():
    """Run all smoke tests"""
    print(f"🔥 Running smoke tests against {BASE_URL}")
    print("=" * 50)
    
    tests = [
        test_health_endpoint,
        test_pois_endpoint,
        test_search_endpoint,
        test_auth_status_endpoint,
        test_routes_endpoint
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
            print(f"❌ Test {test.__name__} crashed: {e}")
            failed += 1
    
    print("=" * 50)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total: {passed + failed}")
    
    if failed > 0:
        print("\n💥 Some smoke tests failed! Check the application.")
        sys.exit(1)
    else:
        print("\n🎉 All smoke tests passed!")
        sys.exit(0)

if __name__ == '__main__':
    run_smoke_tests()
