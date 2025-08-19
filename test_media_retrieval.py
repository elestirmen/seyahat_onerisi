#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poi_media_manager import POIMediaManager

def test_media_retrieval():
    print("🔍 Testing media retrieval for route 154...")
    
    media_manager = POIMediaManager()
    
    # Test the get_route_media method
    media_files = media_manager.get_route_media(154)
    
    print(f"📊 Found {len(media_files)} media files")
    
    for i, media in enumerate(media_files):
        print(f"\n📁 Media {i+1}:")
        print(f"  ID: {media.get('id')}")
        print(f"  Filename: {media.get('filename')}")
        print(f"  File path: {media.get('file_path')}")
        print(f"  Thumbnail: {media.get('thumbnail_path')}")
        print(f"  Preview: {media.get('preview_path')}")
        print(f"  Media type: {media.get('media_type')}")
        print(f"  File size: {media.get('file_size')}")
        print(f"  Lat: {media.get('lat')}, Lng: {media.get('lng')}")
        print(f"  Caption: {media.get('caption')}")
        print(f"  Is primary: {media.get('is_primary')}")

if __name__ == "__main__":
    test_media_retrieval()
