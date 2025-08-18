#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for route media endpoints
"""

import requests
import json
import os
from pathlib import Path

# Test configuration
BASE_URL = "http://127.0.0.1:5560"  # Adjust this to your backend URL
TEST_ROUTE_ID = 153  # Use the route ID from your error message

def test_route_media_endpoints():
    """Test all route media endpoints"""
    print("🧪 Testing Route Media Endpoints")
    print("=" * 50)
    
    # Test 1: Check if route exists
    print(f"\n1️⃣ Testing route existence...")
    try:
        response = requests.get(f"{BASE_URL}/api/routes/{TEST_ROUTE_ID}")
        if response.status_code == 200:
            route_data = response.json()
            print(f"✅ Route {TEST_ROUTE_ID} exists: {route_data.get('name', 'Unknown')}")
        else:
            print(f"❌ Route {TEST_ROUTE_ID} not found (Status: {response.status_code})")
            return
    except Exception as e:
        print(f"❌ Error checking route: {e}")
        return
    
    # Test 2: Test GET endpoint for route media
    print(f"\n2️⃣ Testing GET /api/routes/{TEST_ROUTE_ID}/media...")
    try:
        response = requests.get(f"{BASE_URL}/api/routes/{TEST_ROUTE_ID}/media")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            media_data = response.json()
            print(f"✅ GET endpoint working. Found {len(media_data)} media items")
            if media_data:
                print(f"   First item: {media_data[0]}")
        else:
            print(f"❌ GET endpoint failed: {response.text}")
    except Exception as e:
        print(f"❌ Error testing GET endpoint: {e}")
    
    # Test 3: Test admin GET endpoint for route media
    print(f"\n3️⃣ Testing GET /api/admin/routes/{TEST_ROUTE_ID}/media...")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/routes/{TEST_ROUTE_ID}/media")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            media_data = response.json()
            print(f"✅ Admin GET endpoint working. Found {len(media_data)} media items")
            if media_data:
                print(f"   First item: {media_data[0]}")
        else:
            print(f"❌ Admin GET endpoint failed: {response.text}")
    except Exception as e:
        print(f"❌ Error testing admin GET endpoint: {e}")
    
    # Test 4: Test POST endpoint for uploading route media
    print(f"\n4️⃣ Testing POST /api/admin/routes/{TEST_ROUTE_ID}/media...")
    
    # Create a test image file
    test_image_path = "test_route_image.jpg"
    try:
        # Create a simple test image using PIL if available
        try:
            from PIL import Image
            # Create a simple test image
            img = Image.new('RGB', (100, 100), color='red')
            img.save(test_image_path, 'JPEG')
            print(f"✅ Created test image: {test_image_path}")
        except ImportError:
            # If PIL is not available, create a dummy file
            with open(test_image_path, 'wb') as f:
                f.write(b'fake image data')
            print(f"✅ Created dummy test file: {test_image_path}")
        
        # Test file upload
        with open(test_image_path, 'rb') as f:
            files = {'file': (test_image_path, f, 'image/jpeg')}
            data = {
                'caption': 'Test route media upload',
                'is_primary': 'false',
                'lat': '38.6295',
                'lng': '34.7146'
            }
            
            response = requests.post(
                f"{BASE_URL}/api/admin/routes/{TEST_ROUTE_ID}/media",
                files=files,
                data=data
            )
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(f"✅ POST endpoint working. Media uploaded successfully")
                print(f"   Media info: {result.get('media', {})}")
            else:
                print(f"❌ POST endpoint failed: {response.text}")
                
    except Exception as e:
        print(f"❌ Error testing POST endpoint: {e}")
    
    finally:
        # Clean up test file
        if os.path.exists(test_image_path):
            os.remove(test_image_path)
            print(f"🧹 Cleaned up test file: {test_image_path}")
    
    # Test 5: Test DELETE endpoint (if we have media to delete)
    print(f"\n5️⃣ Testing DELETE endpoint...")
    try:
        # First get the media to see what we can delete
        response = requests.get(f"{BASE_URL}/api/admin/routes/{TEST_ROUTE_ID}/media")
        if response.status_code == 200:
            media_data = response.json()
            if media_data:
                # Try to delete the first media item
                first_media = media_data[0]
                filename = first_media.get('filename', '')
                if filename:
                    print(f"   Attempting to delete: {filename}")
                    delete_response = requests.delete(
                        f"{BASE_URL}/api/admin/routes/{TEST_ROUTE_ID}/media/{filename}"
                    )
                    print(f"   Delete status: {delete_response.status_code}")
                    if delete_response.status_code == 200:
                        print(f"✅ DELETE endpoint working")
                    else:
                        print(f"❌ DELETE endpoint failed: {delete_response.text}")
                else:
                    print("   No filename found in media data")
            else:
                print("   No media items to delete")
        else:
            print("   Could not fetch media for deletion test")
    except Exception as e:
        print(f"❌ Error testing DELETE endpoint: {e}")
    
    print(f"\n🎯 Route Media Endpoint Tests Complete!")
    print("=" * 50)

def test_media_manager():
    """Test the POIMediaManager directly"""
    print("\n🔧 Testing POIMediaManager Directly")
    print("=" * 50)
    
    try:
        from poi_media_manager import POIMediaManager
        
        # Initialize media manager
        manager = POIMediaManager()
        print("✅ POIMediaManager initialized successfully")
        
        # Test directory creation
        print("\n📁 Testing directory creation...")
        manager.ensure_directories()
        
        # Check if route directories exist
        route_dir = manager.base_path / "by_route_id"
        if route_dir.exists():
            print(f"✅ Route directory exists: {route_dir}")
        else:
            print(f"❌ Route directory missing: {route_dir}")
        
        # Test route media methods
        print("\n📸 Testing route media methods...")
        
        # Test get_route_media
        route_media = manager.get_route_media(TEST_ROUTE_ID)
        print(f"✅ get_route_media returned {len(route_media)} items")
        
        # Test add_route_media with a dummy file
        test_file = "test_route_media.txt"
        try:
            with open(test_file, 'w') as f:
                f.write("Test content")
            
            media_info = manager.add_route_media(
                route_id=TEST_ROUTE_ID,
                route_name="Test Route",
                media_file_path=test_file,
                caption="Test caption",
                is_primary=False
            )
            
            if media_info:
                print(f"✅ add_route_media working: {media_info.get('filename', 'Unknown')}")
                
                # Test delete_route_media
                if manager.delete_route_media(TEST_ROUTE_ID, media_info['filename']):
                    print(f"✅ delete_route_media working")
                else:
                    print(f"❌ delete_route_media failed")
            else:
                print(f"❌ add_route_media failed")
                
        finally:
            # Clean up test file
            if os.path.exists(test_file):
                os.remove(test_file)
                print(f"🧹 Cleaned up test file: {test_file}")
        
    except Exception as e:
        print(f"❌ Error testing POIMediaManager: {e}")

if __name__ == "__main__":
    print("🚀 Starting Route Media Endpoint Tests")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"📍 Test Route ID: {TEST_ROUTE_ID}")
    
    # Test the media manager directly
    test_media_manager()
    
    # Test the API endpoints
    test_route_media_endpoints()
    
    print("\n✨ All tests completed!")
