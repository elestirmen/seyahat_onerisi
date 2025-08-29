#!/usr/bin/env python3
"""
Test script to debug the delete location functionality
"""

import os
import sys

# Add the current directory to Python path so we can import the media manager
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from poi_media_manager import POIMediaManager
    print("✅ Successfully imported POIMediaManager")
except ImportError as e:
    print(f"❌ Failed to import POIMediaManager: {e}")
    sys.exit(1)

def test_delete_location():
    """Test the delete location functionality"""
    try:
        print("🔍 Testing delete location functionality...")
        
        # Test parameters
        route_id = 153
        filename = "1503919453408-9ee4386d-5cd0-474f-b43a-6dcc5c8cecc4_.webp"
        
        print(f"📋 Test parameters:")
        print(f"  Route ID: {route_id}")
        print(f"  Filename: {filename}")
        print()
        
        # Initialize media manager
        media_manager = POIMediaManager()
        print("✅ Media manager initialized successfully")
        
        # Test 1: Check current media records
        print("\n🔍 Test 1: Checking current media records...")
        route_media = media_manager.get_route_media(route_id)
        if route_media:
            print(f"✅ Found {len(route_media)} media items")
            for media in route_media:
                if filename in media.get('file_path', ''):
                    print(f"✅ Found target media: {media}")
                    break
        else:
            print("❌ No media items found")
            return
        
        # Test 2: Try to remove location
        print("\n🔍 Test 2: Trying to remove location...")
        result = media_manager.remove_route_media_location(route_id, filename)
        
        if result:
            print(f"✅ Successfully removed location for {filename}")
        else:
            print(f"❌ Failed to remove location for {filename}")
        
        # Test 3: Verify the removal
        print("\n🔍 Test 3: Verifying the removal...")
        route_media_after = media_manager.get_route_media(route_id)
        if route_media_after:
            for media in route_media_after:
                if filename in media.get('file_path', ''):
                    lat = media.get('lat')
                    lng = media.get('lng')
                    print(f"✅ Media after removal: lat={lat}, lng={lng}")
                    if lat is None and lng is None:
                        print("✅ Location successfully removed (set to NULL)")
                    else:
                        print("❌ Location still exists")
                    break
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_delete_location()
