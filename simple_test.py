#!/usr/bin/env python3
import sys
import os
from pathlib import Path

print("🔍 Simple test starting...")

# Check if we can import the module
try:
    from poi_media_manager import POIMediaManager
    print("✅ POIMediaManager imported successfully")
except Exception as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

# Check if we can create an instance
try:
    media_manager = POIMediaManager()
    print("✅ POIMediaManager instance created")
except Exception as e:
    print(f"❌ Instance creation failed: {e}")
    sys.exit(1)

# Check basic paths
print(f"📁 Base path: {media_manager.base_path}")
print(f"📁 Base path exists: {media_manager.base_path.exists()}")

print(f"📁 Thumbnails path: {media_manager.thumbnails_path}")
print(f"📁 Thumbnails path exists: {media_manager.thumbnails_path.exists()}")

print(f"📁 Previews path: {media_manager.previews_path}")
print(f"📁 Previews path exists: {media_manager.previews_path.exists()}")

# Check route 154 directory
route_dir = media_manager.base_path / "by_route_id"
print(f"📁 Route directory: {route_dir}")
print(f"📁 Route directory exists: {route_dir.exists()}")

if route_dir.exists():
    route_folders = [f for f in route_dir.iterdir() if f.name.startswith("route_154_")]
    print(f"📂 Found {len(route_folders)} route 154 folders:")
    for folder in route_folders:
        print(f"  - {folder.name}")

print("✅ Simple test completed")
