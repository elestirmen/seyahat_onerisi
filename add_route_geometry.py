#!/usr/bin/env python3
"""
Add sample route geometry to existing routes
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

def add_route_geometry():
    """Add sample route geometry to existing routes"""
    
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
        
        print("🗺️ Adding sample route geometries...")
        
        # Sample route geometries (simplified paths around Ürgüp)
        route_geometries = {
            # Ürgüp Tarihi Merkez Turu (ID: 1 ve 3)
            'urgup_historic': [
                [34.9130, 38.6310],  # Ürgüp merkez
                [34.9120, 38.6315],  # Tarihi cami
                [34.9110, 38.6320],  # Geleneksel ev
                [34.9105, 38.6325],  # Kültür merkezi
                [34.9115, 38.6330],  # Tarihi han
                [34.9125, 38.6325],  # Müze
                [34.9130, 38.6310]   # Başlangıç noktası (dairesel)
            ],
            
            # Kapadokya Peribacaları Doğa Yürüyüşü (ID: 2 ve 4)
            'cappadocia_hiking': [
                [34.9130, 38.6310],  # Başlangıç
                [34.9200, 38.6250],  # Vadi girişi
                [34.9300, 38.6200],  # Peribacaları
                [34.9400, 38.6150],  # Mağara kilise
                [34.9500, 38.6100],  # Panorama noktası
                [34.9600, 38.6050],  # Bitiş noktası
            ],
            
            # Ürgüp Panoramik Bisiklet Turu (ID: 5)
            'urgup_cycling': [
                [34.9130, 38.6310],  # Başlangıç
                [34.9000, 38.6400],  # Kuzey rotası
                [34.8900, 38.6500],  # Panorama 1
                [34.8800, 38.6400],  # Panorama 2
                [34.8900, 38.6300],  # Güney rotası
                [34.9000, 38.6200],  # Panorama 3
                [34.9130, 38.6310]   # Başlangıç (dairesel)
            ],
            
            # Kapadokya Kültür ve Sanat Rotası (ID: 6)
            'culture_driving': [
                [34.9130, 38.6310],  # Ürgüp başlangıç
                [34.8500, 38.6500],  # Avanos (çömlek)
                [34.8000, 38.6800],  # Göreme (açık hava müzesi)
                [34.7500, 38.7000],  # Uçhisar (kale)
                [34.7000, 38.6500],  # Ortahisar
                [34.8000, 38.6000],  # Mustafapaşa
                [34.9130, 38.6310]   # Ürgüp dönüş
            ],
            
            # Gün Batımı Romantik Yürüyüş (ID: 7)
            'sunset_walk': [
                [34.9130, 38.6310],  # Başlangıç
                [34.9180, 38.6350],  # Yokuş çıkışı
                [34.9220, 38.6380],  # Seyir tepesi
                [34.9250, 38.6400],  # Gün batımı noktası
            ]
        }
        
        # Update routes with geometry
        route_mappings = [
            (1, 'urgup_historic'),
            (2, 'cappadocia_hiking'),
            (3, 'urgup_historic'),
            (4, 'cappadocia_hiking'),
            (5, 'urgup_cycling'),
            (6, 'culture_driving'),
            (7, 'sunset_walk')
        ]
        
        for route_id, geometry_key in route_mappings:
            if geometry_key in route_geometries:
                coordinates = route_geometries[geometry_key]
                
                # Create LINESTRING from coordinates
                linestring_coords = ', '.join([f'{lon} {lat}' for lon, lat in coordinates])
                linestring_wkt = f'LINESTRING({linestring_coords})'
                
                cur.execute("""
                    UPDATE routes 
                    SET route_geometry = ST_GeogFromText(%s)
                    WHERE id = %s
                """, (linestring_wkt, route_id))
                
                print(f"✅ Updated route {route_id} with {len(coordinates)} coordinates")
        
        conn.commit()
        print("🎉 Route geometries added successfully!")
        
        # Show summary
        cur.execute("SELECT COUNT(*) FROM routes WHERE route_geometry IS NOT NULL")
        routes_with_geometry = cur.fetchone()[0]
        print(f"📊 Routes with geometry: {routes_with_geometry}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error adding route geometries: {e}")
        sys.exit(1)

if __name__ == "__main__":
    add_route_geometry()