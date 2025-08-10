#!/usr/bin/env python3
"""
Add sample routes for testing
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

def add_sample_routes():
    """Add sample routes to database"""
    
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
        
        print("🗺️ Adding sample routes...")
        
        # Sample routes
        sample_routes = [
            {
                'name': 'Ürgüp Tarihi Merkez Turu',
                'description': 'Ürgüp\'ün tarihi merkezindeki önemli yapıları ve kültürel mekanları keşfeden yürüyüş rotası. Tarihi camiler, geleneksel evler ve yerel kültürü deneyimleyin.',
                'route_type': 'walking',
                'difficulty_level': 2,
                'estimated_duration': 90,
                'total_distance': 2.8,
                'elevation_gain': 30,
                'is_circular': True,
                'tags': 'tarihi, kültürel, merkez, yürüyüş, camiler',
                'ratings': {
                    'historical': 95,
                    'cultural': 90,
                    'family_friendly': 85,
                    'photography': 80,
                    'scenic_beauty': 70
                }
            },
            {
                'name': 'Kapadokya Peribacaları Doğa Yürüyüşü',
                'description': 'Kapadokya\'nın eşsiz jeolojik oluşumlarını keşfeden doğa yürüyüşü. Peribacaları, vadiler ve mağara kiliseler arasında unutulmaz bir deneyim.',
                'route_type': 'hiking',
                'difficulty_level': 4,
                'estimated_duration': 180,
                'total_distance': 6.5,
                'elevation_gain': 150,
                'is_circular': False,
                'tags': 'doğa, peribacaları, vadiler, macera, jeoloji',
                'ratings': {
                    'scenic_beauty': 100,
                    'nature': 95,
                    'adventure': 90,
                    'photography': 95,
                    'historical': 75
                }
            },
            {
                'name': 'Ürgüp Panoramik Bisiklet Turu',
                'description': 'Ürgüp çevresindeki manzara noktalarını bisikletle keşfeden orta seviye rota. Şehir manzarası ve doğal güzellikler.',
                'route_type': 'cycling',
                'difficulty_level': 3,
                'estimated_duration': 120,
                'total_distance': 12.3,
                'elevation_gain': 200,
                'is_circular': True,
                'tags': 'bisiklet, manzara, panoramik, spor, doğa',
                'ratings': {
                    'scenic_beauty': 90,
                    'adventure': 80,
                    'nature': 85,
                    'photography': 85,
                    'family_friendly': 60
                }
            },
            {
                'name': 'Kapadokya Kültür ve Sanat Rotası',
                'description': 'Kapadokya\'nın kültürel mirasını keşfeden kapsamlı rota. Müzeler, sanat galerileri, el sanatları atölyeleri ve geleneksel mekanlar.',
                'route_type': 'driving',
                'difficulty_level': 1,
                'estimated_duration': 240,
                'total_distance': 25.7,
                'elevation_gain': 100,
                'is_circular': False,
                'tags': 'kültür, sanat, müze, galeri, el sanatları',
                'ratings': {
                    'cultural': 100,
                    'historical': 85,
                    'photography': 80,
                    'family_friendly': 90,
                    'scenic_beauty': 75
                }
            },
            {
                'name': 'Gün Batımı Romantik Yürüyüş',
                'description': 'Ürgüp\'ün en güzel gün batımı noktalarını keşfeden romantik yürüyüş rotası. Çiftler ve fotoğraf tutkunları için ideal.',
                'route_type': 'walking',
                'difficulty_level': 2,
                'estimated_duration': 75,
                'total_distance': 1.8,
                'elevation_gain': 80,
                'is_circular': False,
                'tags': 'romantik, gün batımı, manzara, fotoğraf, çift',
                'ratings': {
                    'scenic_beauty': 100,
                    'photography': 95,
                    'nature': 80,
                    'family_friendly': 70,
                    'cultural': 60
                }
            }
        ]
        
        for route_data in sample_routes:
            # Insert route
            cur.execute("""
                INSERT INTO routes (name, description, route_type, difficulty_level, 
                                  estimated_duration, total_distance, elevation_gain, 
                                  is_circular, tags)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING id;
            """, (
                route_data['name'],
                route_data['description'],
                route_data['route_type'],
                route_data['difficulty_level'],
                route_data['estimated_duration'],
                route_data['total_distance'],
                route_data['elevation_gain'],
                route_data['is_circular'],
                route_data['tags']
            ))
            
            result = cur.fetchone()
            if result:
                route_id = result[0]
                print(f"✅ Added route: {route_data['name']} (ID: {route_id})")
                
                # Add ratings
                for category, rating in route_data['ratings'].items():
                    cur.execute("""
                        INSERT INTO route_ratings (route_id, category, rating)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (route_id, category) DO UPDATE SET rating = EXCLUDED.rating;
                    """, (route_id, category, rating))
            else:
                print(f"⚠️  Route already exists: {route_data['name']}")
        
        conn.commit()
        print("🎉 Sample routes added successfully!")
        
        # Show summary
        cur.execute("SELECT COUNT(*) FROM routes WHERE is_active = true")
        total_routes = cur.fetchone()[0]
        print(f"📊 Total active routes in database: {total_routes}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error adding sample routes: {e}")
        sys.exit(1)

if __name__ == "__main__":
    add_sample_routes()