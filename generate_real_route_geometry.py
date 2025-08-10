#!/usr/bin/env python3
"""
Generate real route geometry using OSMnx road networks
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

def generate_real_route_geometry():
    """Generate real route geometry using OSMnx"""
    
    try:
        import osmnx as ox
        import networkx as nx
        print("✅ OSMnx available")
    except ImportError:
        print("❌ OSMnx not available. Installing...")
        os.system("pip install osmnx")
        import osmnx as ox
        import networkx as nx
    
    # Database connection
    db_config = {
        'host': os.getenv('POI_DB_HOST', 'localhost'),
        'port': os.getenv('POI_DB_PORT', '5432'),
        'database': os.getenv('POI_DB_NAME', 'poi_db'),
        'user': os.getenv('POI_DB_USER', 'poi_user'),
        'password': os.getenv('POI_DB_PASSWORD', 'poi_password')
    }
    
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        print("🗺️ Generating real route geometries using OSMnx...")
        
        # Load walking and driving graphs
        print("📥 Loading walking network...")
        try:
            walking_graph = ox.load_graphml('urgup_merkez_walking.graphml')
            print(f"✅ Walking network loaded: {len(walking_graph.nodes)} nodes")
        except:
            print("⚠️ Walking network not found, downloading...")
            walking_graph = ox.graph_from_point((38.6310, 34.9130), dist=3000, network_type='walk')
            ox.save_graphml(walking_graph, 'urgup_merkez_walking.graphml')
        
        print("📥 Loading driving network...")
        try:
            driving_graph = ox.load_graphml('urgup_driving.graphml')
            print(f"✅ Driving network loaded: {len(driving_graph.nodes)} nodes")
        except:
            print("⚠️ Driving network not found, using existing one")
            driving_graph = None
        
        # Route definitions with waypoints
        route_definitions = {
            1: {  # Ürgüp Tarihi Yürüyüş Turu
                'type': 'walking',
                'waypoints': [
                    (38.6310, 34.9130),  # Ürgüp merkez
                    (38.6315, 34.9120),  # Tarihi cami
                    (38.6320, 34.9110),  # Geleneksel ev
                    (38.6325, 34.9105),  # Kültür merkezi
                    (38.6330, 34.9115),  # Tarihi han
                    (38.6325, 34.9125),  # Müze
                    (38.6310, 34.9130)   # Başlangıç (dairesel)
                ]
            },
            2: {  # Kapadokya Vadiler Doğa Yürüyüşü
                'type': 'walking',
                'waypoints': [
                    (38.6310, 34.9130),  # Başlangıç
                    (38.6250, 34.9200),  # Vadi girişi
                    (38.6200, 34.9300),  # Peribacaları
                    (38.6150, 34.9400),  # Mağara kilise
                    (38.6100, 34.9500),  # Panorama noktası
                    (38.6050, 34.9600)   # Bitiş noktası
                ]
            },
            3: {  # Ürgüp Tarihi Merkez Turu (aynı 1 ile)
                'type': 'walking',
                'waypoints': [
                    (38.6310, 34.9130),
                    (38.6315, 34.9120),
                    (38.6320, 34.9110),
                    (38.6325, 34.9105),
                    (38.6330, 34.9115),
                    (38.6325, 34.9125),
                    (38.6310, 34.9130)
                ]
            },
            4: {  # Kapadokya Peribacaları Doğa Yürüyüşü
                'type': 'walking',
                'waypoints': [
                    (38.6310, 34.9130),
                    (38.6250, 34.9200),
                    (38.6200, 34.9300),
                    (38.6150, 34.9400),
                    (38.6100, 34.9500),
                    (38.6050, 34.9600)
                ]
            },
            5: {  # Ürgüp Panoramik Bisiklet Turu
                'type': 'driving',  # Bisiklet için driving network kullan
                'waypoints': [
                    (38.6310, 34.9130),
                    (38.6400, 34.9000),
                    (38.6500, 34.8900),
                    (38.6400, 34.8800),
                    (38.6300, 34.8900),
                    (38.6200, 34.9000),
                    (38.6310, 34.9130)
                ]
            },
            6: {  # Kapadokya Kültür ve Sanat Rotası
                'type': 'driving',
                'waypoints': [
                    (38.6310, 34.9130),  # Ürgüp
                    (38.6500, 34.8500),  # Avanos
                    (38.6800, 34.8000),  # Göreme
                    (38.7000, 34.7500),  # Uçhisar
                    (38.6500, 34.7000),  # Ortahisar
                    (38.6000, 34.8000),  # Mustafapaşa
                    (38.6310, 34.9130)   # Ürgüp dönüş
                ]
            },
            7: {  # Gün Batımı Romantik Yürüyüş
                'type': 'walking',
                'waypoints': [
                    (38.6310, 34.9130),
                    (38.6350, 34.9180),
                    (38.6380, 34.9220),
                    (38.6400, 34.9250)
                ]
            }
        }
        
        for route_id, route_def in route_definitions.items():
            print(f"\n🔄 Processing route {route_id}...")
            
            # Select appropriate graph
            if route_def['type'] == 'walking':
                graph = walking_graph
                print(f"   Using walking network")
            else:
                graph = driving_graph
                print(f"   Using driving network")
            
            if graph is None:
                print(f"   ⚠️ Network not available, skipping")
                continue
            
            waypoints = route_def['waypoints']
            full_route_coords = []
            
            # Generate route through all waypoints
            for i in range(len(waypoints) - 1):
                start_point = waypoints[i]
                end_point = waypoints[i + 1]
                
                try:
                    # Find nearest nodes
                    start_node = ox.nearest_nodes(graph, start_point[1], start_point[0])
                    end_node = ox.nearest_nodes(graph, end_point[1], end_point[0])
                    
                    # Calculate shortest path
                    path = nx.shortest_path(graph, start_node, end_node, weight='length')
                    
                    # Get coordinates for this segment
                    segment_coords = []
                    for node in path:
                        node_data = graph.nodes[node]
                        segment_coords.append([node_data['y'], node_data['x']])  # [lat, lon]
                    
                    # Add to full route (avoid duplicating connection points)
                    if i == 0:
                        full_route_coords.extend(segment_coords)
                    else:
                        full_route_coords.extend(segment_coords[1:])  # Skip first point to avoid duplication
                    
                    print(f"   ✅ Segment {i+1}: {len(segment_coords)} points")
                    
                except Exception as e:
                    print(f"   ⚠️ Segment {i+1} failed: {e}")
                    # Fallback to straight line
                    full_route_coords.extend([list(start_point), list(end_point)])
            
            if full_route_coords:
                # Create LINESTRING from coordinates
                linestring_coords = ', '.join([f'{coord[1]} {coord[0]}' for coord in full_route_coords])
                linestring_wkt = f'LINESTRING({linestring_coords})'
                
                # Update database
                cur.execute("""
                    UPDATE routes 
                    SET route_geometry = ST_GeogFromText(%s)
                    WHERE id = %s
                """, (linestring_wkt, route_id))
                
                print(f"   ✅ Updated route {route_id} with {len(full_route_coords)} coordinates")
            else:
                print(f"   ❌ No coordinates generated for route {route_id}")
        
        conn.commit()
        print("\n🎉 Real route geometries generated successfully!")
        
        # Show summary
        cur.execute("SELECT id, name, ST_NumPoints(route_geometry::geometry) as point_count FROM routes WHERE route_geometry IS NOT NULL ORDER BY id")
        for row in cur.fetchall():
            print(f"📊 Route {row[0]}: {row[1]} - {row[2]} points")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error generating route geometries: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    generate_real_route_geometry()