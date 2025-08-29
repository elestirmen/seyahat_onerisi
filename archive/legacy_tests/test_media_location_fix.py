#!/usr/bin/env python3
"""
Test script to verify that the media location update functionality works after the fix.
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

def test_media_manager_connection():
    """Test if the media manager can connect to the database"""
    try:
        print("🔍 Testing media manager connection...")
        media_manager = POIMediaManager()
        print("✅ Media manager initialized successfully")
        return media_manager
    except Exception as e:
        print(f"❌ Failed to initialize media manager: {e}")
        return None

def test_get_route_media(media_manager, route_id):
    """Test getting route media"""
    try:
        print(f"🔍 Testing get_route_media for route {route_id}...")
        route_media = media_manager.get_route_media(route_id)
        print(f"✅ Successfully retrieved {len(route_media)} media items")
        
        if route_media:
            print("📋 Media items found:")
            for i, media in enumerate(route_media[:3]):  # Show first 3
                print(f"  {i+1}. {media.get('filename', 'Unknown')} - {media.get('file_path', 'No path')}")
                if i >= 2:
                    break
        else:
            print("ℹ️ No media items found for this route")
        
        return route_media
    except Exception as e:
        print(f"❌ Failed to get route media: {e}")
        return None

def test_update_media_location(media_manager, route_id, filename, lat, lng):
    """Test updating media location"""
    try:
        print(f"🔍 Testing update_media_location for {filename}...")
        result = media_manager.update_route_media_location(route_id, filename, lat, lng)
        
        if result:
            print(f"✅ Successfully updated location for {filename} to ({lat}, {lng})")
        else:
            print(f"❌ Failed to update location for {filename}")
        
        return result
    except Exception as e:
        print(f"❌ Error updating media location: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Starting media location fix test...")
    
    # Test route ID and filename from the error message
    test_route_id = 154
    test_filename = "1557737a.webp"
    test_lat = 38.6293  # Example coordinates for Urgup
    test_lng = 34.6283
    
    print(f"📋 Test parameters:")
    print(f"  Route ID: {test_route_id}")
    print(f"  Filename: {test_filename}")
    print(f"  Coordinates: ({test_lat}, {test_lng})")
    print()
    
    # Test 1: Media manager connection
    media_manager = test_media_manager_connection()
    if not media_manager:
        print("❌ Cannot proceed without media manager")
        return
    
    print()
    
    # Test 2: Get route media
    route_media = test_get_route_media(media_manager, test_route_id)
    if route_media is None:
        print("❌ Cannot proceed without route media")
        return
    
    print()
    
    # Test 3: Update media location
    if route_media:
        # Find a media item to test with
        test_media = None
        for media in route_media:
            if media.get('filename') == test_filename:
                test_media = media
                break
        
        if test_media:
            print(f"🎯 Found test media: {test_media['filename']}")
            result = test_update_media_location(media_manager, test_route_id, test_filename, test_lat, test_lng)
            
            if result:
                print("🎉 All tests passed! The media location update should now work.")
            else:
                print("❌ Media location update test failed.")
        else:
            print(f"⚠️ Test filename '{test_filename}' not found in route media")
            print("   Available filenames:")
            for media in route_media[:5]:  # Show first 5
                print(f"     - {media.get('filename', 'Unknown')}")
    else:
        print("⚠️ No route media found to test with")
    
    print("\n🏁 Test completed!")

if __name__ == "__main__":
    main()