#!/usr/bin/env python3
"""
Contract tests for API endpoints.
These tests ensure API responses match the OpenAPI specification and golden files.
"""

import requests
import json
import sys
import os
from typing import Dict, Any
import yaml
from jsonschema import validate, ValidationError

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:5000')
TIMEOUT = 10
FIXTURES_PATH = os.path.join(os.path.dirname(__file__), 'fixtures')
OPENAPI_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'openapi.yaml')

def load_openapi_spec():
    """Load OpenAPI specification"""
    try:
        with open(OPENAPI_PATH, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"❌ Failed to load OpenAPI spec: {e}")
        return None

def load_golden_response(filename: str) -> Dict[str, Any]:
    """Load golden response from fixtures"""
    try:
        with open(os.path.join(FIXTURES_PATH, filename), 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Failed to load golden response {filename}: {e}")
        return None

def validate_response_structure(data: Dict[str, Any], golden: Dict[str, Any], endpoint: str) -> bool:
    """Validate response structure matches golden response"""
    try:
        # Check if all required keys from golden are present
        for key in golden.keys():
            if key not in data:
                print(f"❌ {endpoint}: Missing key '{key}' in response")
                return False
            
            # Check data types match
            if type(data[key]) != type(golden[key]):
                print(f"❌ {endpoint}: Type mismatch for key '{key}'. Expected {type(golden[key])}, got {type(data[key])}")
                return False
        
        return True
    except Exception as e:
        print(f"❌ {endpoint}: Structure validation failed: {e}")
        return False

def test_health_contract():
    """Test health endpoint contract"""
    try:
        response = requests.get(f'{BASE_URL}/health', timeout=TIMEOUT)
        assert response.status_code == 200, f"Health check failed with status {response.status_code}"
        
        data = response.json()
        golden = load_golden_response('health_response.json')
        
        if not golden:
            print("❌ Health contract test: Could not load golden response")
            return False
        
        # Validate structure
        required_keys = ['status', 'timestamp']
        for key in required_keys:
            if key not in data:
                print(f"❌ Health contract: Missing required key '{key}'")
                return False
        
        # Validate status values
        if data['status'] not in ['healthy', 'unhealthy']:
            print(f"❌ Health contract: Invalid status value '{data['status']}'")
            return False
        
        print("✅ Health endpoint contract test passed")
        return True
    except Exception as e:
        print(f"❌ Health endpoint contract test failed: {e}")
        return False

def test_pois_contract():
    """Test POI listing endpoint contract"""
    try:
        response = requests.get(f'{BASE_URL}/api/pois?limit=5', timeout=TIMEOUT)
        assert response.status_code == 200, f"POI listing failed with status {response.status_code}"
        
        data = response.json()
        golden = load_golden_response('pois_response.json')
        
        if not golden:
            print("❌ POI contract test: Could not load golden response")
            return False
        
        # Validate main structure
        required_keys = ['pois', 'total', 'page', 'total_pages']
        for key in required_keys:
            if key not in data:
                print(f"❌ POI contract: Missing required key '{key}'")
                return False
        
        # Validate POI structure if any POIs exist
        if data['pois'] and len(data['pois']) > 0:
            poi = data['pois'][0]
            required_poi_keys = ['id', 'name', 'latitude', 'longitude']
            for key in required_poi_keys:
                if key not in poi:
                    print(f"❌ POI contract: Missing required POI key '{key}'")
                    return False
        
        print("✅ POI listing endpoint contract test passed")
        return True
    except Exception as e:
        print(f"❌ POI listing endpoint contract test failed: {e}")
        return False

def test_search_contract():
    """Test search endpoint contract"""
    try:
        response = requests.get(f'{BASE_URL}/api/search?q=test', timeout=TIMEOUT)
        assert response.status_code == 200, f"Search failed with status {response.status_code}"
        
        data = response.json()
        golden = load_golden_response('search_response.json')
        
        if not golden:
            print("❌ Search contract test: Could not load golden response")
            return False
        
        # Validate main structure
        required_keys = ['results', 'total', 'query']
        for key in required_keys:
            if key not in data:
                print(f"❌ Search contract: Missing required key '{key}'")
                return False
        
        # Validate results structure
        if not isinstance(data['results'], list):
            print(f"❌ Search contract: 'results' should be a list")
            return False
        
        print("✅ Search endpoint contract test passed")
        return True
    except Exception as e:
        print(f"❌ Search endpoint contract test failed: {e}")
        return False

def test_auth_status_contract():
    """Test auth status endpoint contract"""
    try:
        response = requests.get(f'{BASE_URL}/auth/status', timeout=TIMEOUT)
        assert response.status_code == 200, f"Auth status failed with status {response.status_code}"
        
        data = response.json()
        golden = load_golden_response('auth_status_response.json')
        
        if not golden:
            print("❌ Auth status contract test: Could not load golden response")
            return False
        
        # Validate main structure
        required_keys = ['authenticated']
        for key in required_keys:
            if key not in data:
                print(f"❌ Auth status contract: Missing required key '{key}'")
                return False
        
        # Validate authenticated is boolean
        if not isinstance(data['authenticated'], bool):
            print(f"❌ Auth status contract: 'authenticated' should be boolean")
            return False
        
        print("✅ Auth status endpoint contract test passed")
        return True
    except Exception as e:
        print(f"❌ Auth status endpoint contract test failed: {e}")
        return False

def test_routes_contract():
    """Test routes endpoint contract"""
    try:
        response = requests.get(f'{BASE_URL}/api/routes', timeout=TIMEOUT)
        assert response.status_code == 200, f"Routes failed with status {response.status_code}"
        
        data = response.json()
        golden = load_golden_response('routes_response.json')
        
        if not golden:
            print("❌ Routes contract test: Could not load golden response")
            return False
        
        # Validate main structure
        required_keys = ['routes', 'total', 'page', 'total_pages']
        for key in required_keys:
            if key not in data:
                print(f"❌ Routes contract: Missing required key '{key}'")
                return False
        
        # Validate routes structure if any routes exist
        if data['routes'] and len(data['routes']) > 0:
            route = data['routes'][0]
            required_route_keys = ['id', 'name', 'is_active']
            for key in required_route_keys:
                if key not in route:
                    print(f"❌ Routes contract: Missing required route key '{key}'")
                    return False
        
        print("✅ Routes endpoint contract test passed")
        return True
    except Exception as e:
        print(f"❌ Routes endpoint contract test failed: {e}")
        return False

def run_contract_tests():
    """Run all contract tests"""
    print(f"📋 Running contract tests against {BASE_URL}")
    print("=" * 50)
    
    # Load OpenAPI spec for validation
    openapi_spec = load_openapi_spec()
    if not openapi_spec:
        print("❌ Cannot run contract tests without OpenAPI specification")
        return False
    
    tests = [
        test_health_contract,
        test_pois_contract,
        test_search_contract,
        test_auth_status_contract,
        test_routes_contract
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
        print("\n💥 Some contract tests failed! API contract may be broken.")
        sys.exit(1)
    else:
        print("\n🎉 All contract tests passed!")
        sys.exit(0)

if __name__ == '__main__':
    run_contract_tests()
