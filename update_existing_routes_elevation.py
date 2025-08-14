#!/usr/bin/env python3
"""
Mevcut rotalara elevation profile ekler
Varolan rotalar için elevation hesaplaması yapar
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from elevation_service import ElevationService

def update_existing_routes_elevation():
    """Mevcut rotalar için elevation profile hesapla ve güncelle"""
    
    # Database connection
    db_config = {
        'host': os.getenv('POI_DB_HOST', 'localhost'),
        'port': os.getenv('POI_DB_PORT', '5432'),
        'database': os.getenv('POI_DB_NAME', 'poi_db'),
        'user': os.getenv('POI_DB_USER', 'poi_user'),
        'password': os.getenv('POI_DB_PASSWORD', 'poi_password')
    }
    
    elevation_service = ElevationService()
    
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("🏔️ Updating elevation profiles for existing routes...")
        
        # Get routes that don't have elevation profile yet
        cur.execute("""
            SELECT id, name, waypoints, total_distance
            FROM routes 
            WHERE elevation_profile IS NULL 
            AND waypoints IS NOT NULL 
            AND is_active = true
            ORDER BY id
        """)
        
        routes = cur.fetchall()
        print(f"📋 Found {len(routes)} routes without elevation profiles")
        
        if not routes:
            print("✅ All routes already have elevation profiles")
            return
        
        updated_count = 0
        
        for route in routes:
            try:
                print(f"\n🗺️ Processing route: {route['name']} (ID: {route['id']})")
                
                # Parse waypoints
                waypoints_data = route['waypoints']
                if isinstance(waypoints_data, str):
                    waypoints_data = json.loads(waypoints_data)
                
                if not waypoints_data or len(waypoints_data) < 2:
                    print(f"⚠️ Skipping route {route['name']}: insufficient waypoints")
                    continue
                
                # Convert to elevation service format
                waypoints_for_elevation = []
                for i, wp in enumerate(waypoints_data):
                    if 'latitude' in wp and 'longitude' in wp:
                        waypoints_for_elevation.append({
                            'lat': wp['latitude'],
                            'lng': wp['longitude'],
                            'name': wp.get('name', f'Waypoint {i+1}')
                        })
                
                if len(waypoints_for_elevation) < 2:
                    print(f"⚠️ Skipping route {route['name']}: insufficient valid coordinates")
                    continue
                
                # Calculate total distance if not available
                total_distance = route['total_distance']
                if not total_distance:
                    total_distance = 0
                    for i in range(1, len(waypoints_for_elevation)):
                        dist = elevation_service.calculate_distance(
                            waypoints_for_elevation[i-1]['lat'], waypoints_for_elevation[i-1]['lng'],
                            waypoints_for_elevation[i]['lat'], waypoints_for_elevation[i]['lng']
                        )
                        total_distance += dist
                
                # Determine optimal resolution
                resolution = elevation_service.optimize_resolution_for_route(
                    total_distance, len(waypoints_for_elevation)
                )
                
                # Generate elevation profile
                print(f"   🏔️ Calculating elevation profile (resolution: {resolution}m)...")
                elevation_profile = elevation_service.generate_elevation_profile(
                    waypoints_for_elevation, resolution
                )
                
                # Update route in database
                cur.execute("""
                    UPDATE routes 
                    SET 
                        elevation_profile = %s,
                        elevation_resolution = %s,
                        elevation_gain = %s,
                        total_distance = %s
                    WHERE id = %s
                """, (
                    json.dumps(elevation_profile),
                    resolution,
                    elevation_profile['stats']['elevation_gain'],
                    total_distance / 1000 if total_distance > 1000 else total_distance,  # Convert to km if needed
                    route['id']
                ))
                
                updated_count += 1
                print(f"   ✅ Updated: {elevation_profile['point_count']} points, "
                      f"{elevation_profile['total_distance']:.1f}m distance")
                print(f"   📊 Elevation: {elevation_profile['stats']['min_elevation']}-"
                      f"{elevation_profile['stats']['max_elevation']}m, "
                      f"+{elevation_profile['stats']['total_ascent']}m/"
                      f"-{elevation_profile['stats']['total_descent']}m")
                
            except Exception as e:
                print(f"❌ Error processing route {route['name']}: {e}")
                continue
        
        # Commit all changes
        conn.commit()
        print(f"\n✅ Successfully updated elevation profiles for {updated_count} routes")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    update_existing_routes_elevation()
