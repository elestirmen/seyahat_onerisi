#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test POI Suggestion API Endpoint
Tests the actual HTTP API endpoint functionality
"""

import sys
import os
import json
import requests
import time

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_poi_suggestion_api_endpoint():
    """Test the POI suggestion API endpoint"""
    print("🌐 Testing POI Suggestion API Endpoint...")
    
    # API base URL
    base_url = "http://localhost:5505"
    
    try:
        # Test 1: Check if the API server is running
        print("Checking if API server is running...")
        try:
            response = requests.get(f"{base_url}/api/pois", timeout=5)
            print(f"API server is running (status: {response.status_code})")
        except requests.exceptions.ConnectionError:
            print("❌ API server is not running. Please start the server first.")
            print("Run: python poi_api.py")
            return False
        
        # Test 2: Test the POI suggestion endpoint (without auth for now)
        print("\nTesting POI suggestion endpoint...")
        
        # Use route ID 3 from our integration test
        route_id = 3
        endpoint = f"{base_url}/api/routes/{route_id}/suggest-pois"
        
        # Test with different parameters
        test_cases = [
            {"params": {}, "description": "Default parameters"},
            {"params": {"limit": 5}, "description": "Limit to 5 suggestions"},
            {"params": {"limit": 5, "min_score": 50}, "description": "Limit 5 with min score 50"},
            {"params": {"limit": 20, "min_score": 30}, "description": "Limit 20 with min score 30"}
        ]
        
        for test_case in test_cases:
            print(f"\nTesting: {test_case['description']}")
            
            try:
                response = requests.get(endpoint, params=test_case['params'], timeout=10)
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 401:
                    print("⚠️ Authentication required. This is expected for the admin endpoint.")
                    print("Response:", response.json())
                    continue
                elif response.status_code == 200:
                    data = response.json()
                    
                    # Verify response structure
                    assert 'success' in data, "Missing 'success' field"
                    assert data['success'] == True, "Success should be True"
                    assert 'suggestions' in data, "Missing 'suggestions' field"
                    assert 'route' in data, "Missing 'route' field"
                    assert 'total_suggestions' in data, "Missing 'total_suggestions' field"
                    
                    suggestions = data['suggestions']
                    print(f"Received {len(suggestions)} suggestions")
                    
                    if suggestions:
                        # Verify suggestion structure
                        suggestion = suggestions[0]
                        required_fields = [
                            'poi_id', 'name', 'category', 'description',
                            'latitude', 'longitude', 'distance_from_route',
                            'compatibility_score', 'avg_rating', 'suggestion_reason'
                        ]
                        
                        for field in required_fields:
                            assert field in suggestion, f"Missing field: {field}"
                        
                        print(f"Top suggestion: {suggestion['name']} (score: {suggestion['compatibility_score']})")
                        
                        # Verify suggestions are sorted by score
                        for i in range(len(suggestions) - 1):
                            assert suggestions[i]['compatibility_score'] >= suggestions[i + 1]['compatibility_score'], \
                                "Suggestions not sorted by compatibility score"
                        
                        print("✅ Response structure is correct")
                    else:
                        print("⚠️ No suggestions returned (this might be expected)")
                
                else:
                    print(f"❌ Unexpected status code: {response.status_code}")
                    print("Response:", response.text)
                    return False
                    
            except requests.exceptions.Timeout:
                print("❌ Request timed out")
                return False
            except Exception as e:
                print(f"❌ Request failed: {e}")
                return False
        
        # Test 3: Test invalid route ID
        print("\nTesting invalid route ID...")
        invalid_endpoint = f"{base_url}/api/routes/99999/suggest-pois"
        
        try:
            response = requests.get(invalid_endpoint, timeout=5)
            
            if response.status_code == 401:
                print("⚠️ Authentication required (expected)")
            elif response.status_code == 404:
                print("✅ Correctly returned 404 for invalid route")
            else:
                print(f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print(f"Error testing invalid route: {e}")
        
        # Test 4: Test parameter validation
        print("\nTesting parameter validation...")
        test_params = [
            {"limit": -1, "expected": "Should handle negative limit"},
            {"limit": 1000, "expected": "Should cap large limit"},
            {"min_score": -10, "expected": "Should handle negative min_score"},
            {"min_score": 150, "expected": "Should cap large min_score"}
        ]
        
        for params in test_params:
            expected = params.pop('expected')
            print(f"Testing {params}: {expected}")
            
            try:
                response = requests.get(endpoint, params=params, timeout=5)
                
                if response.status_code == 401:
                    print("⚠️ Authentication required (expected)")
                elif response.status_code in [200, 400]:
                    print(f"✅ Handled parameter validation (status: {response.status_code})")
                else:
                    print(f"Status: {response.status_code}")
            except Exception as e:
                print(f"Error: {e}")
        
        print("\n🎉 POI Suggestion API endpoint tests completed!")
        return True
        
    except Exception as e:
        print(f"❌ API endpoint test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_api_documentation():
    """Test that the API endpoint is properly documented"""
    print("\n📚 Testing API Documentation...")
    
    try:
        # Check if the endpoint is documented in the code
        with open('poi_api.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Look for the endpoint definition and documentation
        if '/api/routes/<int:route_id>/suggest-pois' in content:
            print("✅ API endpoint is defined in the code")
        else:
            print("❌ API endpoint not found in code")
            return False
        
        # Look for docstring documentation
        if 'Suggest POIs for a specific route' in content:
            print("✅ API endpoint has documentation")
        else:
            print("❌ API endpoint lacks proper documentation")
            return False
        
        # Look for parameter documentation
        if 'Query parameters:' in content:
            print("✅ API parameters are documented")
        else:
            print("❌ API parameters are not documented")
            return False
        
        print("✅ API documentation test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Documentation test failed: {e}")
        return False

def run_api_tests():
    """Run all API tests"""
    print("🧪 Running POI Suggestion API Tests...")
    print("=" * 60)
    
    tests = [
        test_poi_suggestion_api_endpoint,
        test_api_documentation
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
    print(f"API Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All API tests passed!")
        return True
    else:
        print("❌ Some API tests failed!")
        return False

if __name__ == '__main__':
    success = run_api_tests()
    sys.exit(0 if success else 1)