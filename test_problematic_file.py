#!/usr/bin/env python3
"""
Test script to test the updated media manager with the problematic file
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

def test_problematic_file():
    """Test the problematic file that was causing the 500 error"""
    try:
        print("🔍 Testing problematic file...")
        
        # Test parameters from the error message
        route_id = 153
        filename = "1503919453408-9ee4386d-5cd0-474f-b43a-6dcc5c8cecc4_.webp"
        lat = 38.6293
        lng = 34.6283
        
        print(f"📋 Test parameters:")
        print(f"  Route ID: {route_id}")
        print(f"  Filename: {filename}")
        print(f"  Coordinates: ({lat}, {lng})")
        print()
        
        # Initialize media manager
        media_manager = POIMediaManager()
        print("✅ Media manager initialized successfully")
        
        # Test 1: Find the file path
        print("\n🔍 Test 1: Finding file path...")
        file_path = media_manager._find_media_file_path(route_id, filename)
        if file_path:
            print(f"✅ File found: {file_path}")
        else:
            print("❌ File not found")
            return
        
        # Test 2: Update location
        print("\n🔍 Test 2: Updating location...")
        result = media_manager.update_route_media_location(route_id, filename, lat, lng)
        
        if result:
            print(f"✅ Successfully updated location for {filename} to ({lat}, {lng})")
        else:
            print(f"❌ Failed to update location for {filename}")
        
        # Test 3: Verify the update
        print("\n🔍 Test 3: Verifying the update...")
        route_media = media_manager.get_route_media(route_id)
        if route_media:
            print(f"✅ Found {len(route_media)} media items")
            for media in route_media:
                if filename in media.get('file_path', ''):
                    print(f"✅ Found updated media: {media}")
                    break
        else:
            print("❌ No media items found")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_problematic_file()
