#!/usr/bin/env python3
"""
Integration test for File Upload API endpoints
Tests the actual API endpoints with sample data
"""

import requests
import tempfile
import os
import json
import time
from io import BytesIO


def create_test_gpx_file():
    """Create a test GPX file"""
    gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test Integration" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata>
        <name>Test Integration Route</name>
        <desc>A test route for API integration testing</desc>
        <time>2024-01-15T10:00:00Z</time>
    </metadata>
    <trk>
        <name>Main Track</name>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213">
                <ele>1200</ele>
                <time>2024-01-15T10:00:00Z</time>
            </trkpt>
            <trkpt lat="38.6441" lon="34.8223">
                <ele>1210</ele>
                <time>2024-01-15T10:05:00Z</time>
            </trkpt>
            <trkpt lat="38.6451" lon="34.8233">
                <ele>1220</ele>
                <time>2024-01-15T10:10:00Z</time>
            </trkpt>
            <trkpt lat="38.6461" lon="34.8243">
                <ele>1215</ele>
                <time>2024-01-15T10:15:00Z</time>
            </trkpt>
        </trkseg>
    </trk>
    <wpt lat="38.6436" lon="34.8218">
        <name>Viewpoint</name>
        <desc>Beautiful viewpoint</desc>
        <ele>1205</ele>
    </wpt>
    <wpt lat="38.6456" lon="34.8238">
        <name>Rest Area</name>
        <desc>Shaded rest area</desc>
        <ele>1218</ele>
    </wpt>
</gpx>'''
    
    return gpx_content.encode('utf-8')


def test_file_upload_api():
    """Test the file upload API endpoints"""
    
    print("🧪 File Upload API Integration Test")
    print("=" * 50)
    
    # API base URL (assuming the server is running on localhost:5505)
    base_url = "http://localhost:5505"
    
    # Test data
    test_file_content = create_test_gpx_file()
    
    print("\n📤 Testing file upload endpoint...")
    
    try:
        # Test file upload
        files = {
            'file': ('test_integration_route.gpx', BytesIO(test_file_content), 'application/gpx+xml')
        }
        
        response = requests.post(f"{base_url}/api/routes/import", files=files)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Upload successful!")
            print(f"   📝 Upload ID: {data.get('upload_id', 'N/A')}")
            print(f"   📊 Route points: {data.get('route_data', {}).get('points_count', 'N/A')}")
            print(f"   📍 Waypoints: {data.get('route_data', {}).get('waypoints_count', 'N/A')}")
            
            upload_id = data.get('upload_id')
            
            if upload_id:
                # Test progress endpoint
                print(f"\n📊 Testing progress endpoint...")
                progress_response = requests.get(f"{base_url}/api/routes/import/progress/{upload_id}")
                
                if progress_response.status_code == 200:
                    progress_data = progress_response.json()
                    print(f"   ✅ Progress retrieved successfully!")
                    print(f"   📈 Status: {progress_data.get('progress', {}).get('status', 'N/A')}")
                    print(f"   📊 Progress: {progress_data.get('progress', {}).get('progress', 'N/A')}%")
                else:
                    print(f"   ❌ Progress request failed: {progress_response.status_code}")
                
                # Test import confirmation
                print(f"\n✅ Testing import confirmation...")
                confirm_data = {
                    "upload_id": upload_id,
                    "route_name": "Test Integration Route - Confirmed",
                    "route_description": "This route was imported via integration test",
                    "route_type": "hiking"
                }
                
                confirm_response = requests.post(
                    f"{base_url}/api/routes/import/confirm",
                    json=confirm_data,
                    headers={'Content-Type': 'application/json'}
                )
                
                if confirm_response.status_code == 200:
                    confirm_result = confirm_response.json()
                    print(f"   ✅ Import confirmed successfully!")
                    print(f"   🆔 Route ID: {confirm_result.get('route_data', {}).get('id', 'N/A')}")
                    print(f"   📝 Route Name: {confirm_result.get('route_data', {}).get('name', 'N/A')}")
                else:
                    print(f"   ❌ Import confirmation failed: {confirm_response.status_code}")
                    if confirm_response.headers.get('content-type', '').startswith('application/json'):
                        error_data = confirm_response.json()
                        print(f"   Error: {error_data.get('error', 'Unknown error')}")
        
        elif response.status_code == 401:
            print(f"   ⚠️  Authentication required - this is expected for admin endpoints")
            print(f"   💡 To test with authentication, you need to login first")
        
        else:
            print(f"   ❌ Upload failed with status: {response.status_code}")
            if response.headers.get('content-type', '').startswith('application/json'):
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            else:
                print(f"   Response: {response.text[:200]}...")
    
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Connection failed - make sure the API server is running on {base_url}")
        print(f"   💡 Start the server with: python poi_api.py")
    
    except Exception as e:
        print(f"   ❌ Test failed with error: {str(e)}")
    
    print(f"\n🎉 Integration test completed!")


def test_validation_scenarios():
    """Test various validation scenarios"""
    
    print("\n🔍 Testing validation scenarios...")
    
    base_url = "http://localhost:5505"
    
    # Test cases
    test_cases = [
        {
            'name': 'Invalid file extension',
            'filename': 'test.txt',
            'content': b'This is not a route file',
            'expected_status': 400
        },
        {
            'name': 'Empty file',
            'filename': 'empty.gpx',
            'content': b'',
            'expected_status': 400
        },
        {
            'name': 'Invalid XML',
            'filename': 'invalid.gpx',
            'content': b'This is not valid XML',
            'expected_status': 400
        },
        {
            'name': 'Malicious content',
            'filename': 'malicious.gpx',
            'content': b'<?xml version="1.0"?><gpx><script>alert("xss")</script></gpx>',
            'expected_status': 400
        }
    ]
    
    for test_case in test_cases:
        print(f"\n   Testing: {test_case['name']}")
        
        try:
            files = {
                'file': (test_case['filename'], BytesIO(test_case['content']), 'text/xml')
            }
            
            response = requests.post(f"{base_url}/api/routes/import", files=files)
            
            if response.status_code == test_case['expected_status']:
                print(f"   ✅ Expected status {test_case['expected_status']} received")
            elif response.status_code == 401:
                print(f"   ⚠️  Authentication required (expected for admin endpoints)")
            else:
                print(f"   ⚠️  Unexpected status: {response.status_code} (expected: {test_case['expected_status']})")
        
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Connection failed")
            break
        except Exception as e:
            print(f"   ❌ Test failed: {str(e)}")


def test_websocket_connection():
    """Test WebSocket connection (basic connectivity test)"""
    
    print("\n🔌 Testing WebSocket connectivity...")
    
    try:
        # Test WebSocket health endpoint
        response = requests.get("http://localhost:5506/websocket/health")
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ WebSocket server is healthy!")
            print(f"   👥 Connected clients: {health_data.get('connected_clients', 'N/A')}")
            print(f"   📤 Active uploads: {health_data.get('active_uploads', 'N/A')}")
        else:
            print(f"   ❌ WebSocket health check failed: {response.status_code}")
    
    except requests.exceptions.ConnectionError:
        print(f"   ❌ WebSocket server not running on localhost:5506")
        print(f"   💡 Start WebSocket server with: python route_import_websocket.py")
    except Exception as e:
        print(f"   ❌ WebSocket test failed: {str(e)}")


if __name__ == "__main__":
    # Run integration tests
    test_file_upload_api()
    test_validation_scenarios()
    test_websocket_connection()