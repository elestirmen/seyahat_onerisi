#!/usr/bin/env python3
"""
Belirli bir rotanın elevation profilini yeniden hesaplar
Geometry kullanarak daha doğru elevation profili oluşturur
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from elevation_service import ElevationService

def recalculate_route_elevation(route_name_pattern=None):
    """Belirli rota(lar) için elevation profile yeniden hesapla"""
    
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
        
        print("🏔️ Recalculating elevation profiles...")
        
        # Build query based on pattern
        if route_name_pattern:
            query = """
                SELECT 
                    id, name, waypoints,
                    ST_AsGeoJSON(route_geometry) as geometry_geojson,
                    ST_Length(route_geometry::geography) as geometry_length_meters
                FROM routes 
                WHERE name ILIKE %s
                AND is_active = true
                ORDER BY id
            """
            cur.execute(query, (f'%{route_name_pattern}%',))
        else:
            query = """
                SELECT 
                    id, name, waypoints,
                    ST_AsGeoJSON(route_geometry) as geometry_geojson,
                    ST_Length(route_geometry::geography) as geometry_length_meters
                FROM routes 
                WHERE is_active = true
                ORDER BY id
            """
            cur.execute(query)
        
        routes = cur.fetchall()
        print(f"📋 Found {len(routes)} routes to process")
        
        if not routes:
            print("❌ No matching routes found")
            return
        
        updated_count = 0
        
        for route in routes:
            try:
                print(f"\n🗺️ Processing route: {route['name']} (ID: {route['id']})")
                
                elevation_profile = None
                elevation_source = None
                
                # Try geometry first (preferred)
                if route['geometry_geojson']:
                    geom = json.loads(route['geometry_geojson'])
                    if geom.get('coordinates') and len(geom['coordinates']) > 1:
                        coordinates = geom['coordinates']
                        elevation_source = "geometry"
                        print(f"   🗺️ Using geometry with {len(coordinates)} points")
                        
                        # Calculate distance for optimal resolution
                        total_distance = 0
                        for i in range(1, len(coordinates)):
                            dist = elevation_service.calculate_distance(
                                coordinates[i-1][1], coordinates[i-1][0],  # lat, lng
                                coordinates[i][1], coordinates[i][0]
                            )
                            total_distance += dist
                        
                        print(f"   📏 Total distance: {total_distance:.1f}m")
                        
                        # Determine resolution (fixed ~10m)
                        resolution = 10
                        print(f"   📊 Optimal resolution: {resolution}m")
                        
                        # Generate elevation profile from geometry
                        elevation_profile = elevation_service.generate_elevation_profile_from_geometry(
                            coordinates, resolution
                        )
                
                # Fallback to waypoints
                if not elevation_profile and route['waypoints']:
                    waypoints_data = route['waypoints']
                    if isinstance(waypoints_data, str):
                        waypoints_data = json.loads(waypoints_data)
                    
                    if waypoints_data and len(waypoints_data) >= 2:
                        elevation_source = "waypoints"
                        print(f"   📍 Using {len(waypoints_data)} waypoints (no geometry)")
                        
                        waypoints_for_elevation = []
                        for i, wp in enumerate(waypoints_data):
                            if 'latitude' in wp and 'longitude' in wp:
                                waypoints_for_elevation.append({
                                    'lat': wp['latitude'],
                                    'lng': wp['longitude'],
                                    'name': wp.get('name', f'Waypoint {i+1}')
                                })
                        
                        if len(waypoints_for_elevation) >= 2:
                            # Calculate distance
                            total_distance = 0
                            for i in range(1, len(waypoints_for_elevation)):
                                dist = elevation_service.calculate_distance(
                                    waypoints_for_elevation[i-1]['lat'], waypoints_for_elevation[i-1]['lng'],
                                    waypoints_for_elevation[i]['lat'], waypoints_for_elevation[i]['lng']
                                )
                                total_distance += dist
                            
                            # Determine resolution (fixed ~10m)
                            resolution = 10
                            
                            elevation_profile = elevation_service.generate_elevation_profile(
                                waypoints_for_elevation, resolution
                            )
                
                if elevation_profile:
                    # Update route in database
                    cur.execute("""
                        UPDATE routes 
                        SET 
                            elevation_profile = %s,
                            elevation_resolution = %s,
                            elevation_gain = %s
                        WHERE id = %s
                    """, (
                        json.dumps(elevation_profile),
                        elevation_profile.get('resolution', 100),
                        elevation_profile['stats']['elevation_gain'],
                        route['id']
                    ))
                    
                    updated_count += 1
                    print(f"   ✅ Updated: {elevation_profile['point_count']} points, "
                          f"{elevation_profile['total_distance']:.1f}m distance")
                    print(f"   📊 Elevation: {elevation_profile['stats']['min_elevation']}-"
                          f"{elevation_profile['stats']['max_elevation']}m, "
                          f"+{elevation_profile['stats']['total_ascent']}m/"
                          f"-{elevation_profile['stats']['total_descent']}m")
                    print(f"   🎯 Source: {elevation_source}")
                else:
                    print(f"   ❌ Could not generate elevation profile")
                
            except Exception as e:
                print(f"   ❌ Error processing route {route['name']}: {e}")
                continue
        
        # Commit all changes
        conn.commit()
        print(f"\n✅ Successfully recalculated elevation profiles for {updated_count} routes")
        
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
    # Get route pattern from command line argument if provided
    route_pattern = sys.argv[1] if len(sys.argv) > 1 else None
    
    if route_pattern:
        print(f"🔍 Searching for routes matching: '{route_pattern}'")
    else:
        print("🔍 Processing all routes")
    
    recalculate_route_elevation(route_pattern)
