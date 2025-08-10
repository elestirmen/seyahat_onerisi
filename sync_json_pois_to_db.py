#!/usr/bin/env python3
"""
JSON POI'lerini veritabanına senkronize etme script'i
"""

import json
import os
import sys
from poi_database_adapter import POIDatabaseFactory
import hashlib

def get_integer_id_from_string(string_id):
    """String ID'yi tutarlı integer ID'ye çevir"""
    return abs(hash(string_id)) % (10**9)  # 9 haneli pozitif integer

def sync_json_pois_to_database():
    """JSON dosyasındaki POI'leri veritabanına senkronize et"""
    
    # JSON dosyasını yükle
    json_file_path = 'test_data.json'
    if not os.path.exists(json_file_path):
        print(f"❌ JSON dosyası bulunamadı: {json_file_path}")
        return False
    
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            test_data = json.load(f)
    except Exception as e:
        print(f"❌ JSON dosyası okunamadı: {e}")
        return False
    
    # Veritabanına bağlan
    try:
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        db.connect()
        print("✅ Veritabanına bağlanıldı")
        
    except Exception as e:
        print(f"❌ Veritabanına bağlanılamadı: {e}")
        return False
    
    try:
        # Mevcut POI'leri kontrol et
        with db.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM pois")
            existing_count = cur.fetchone()[0]
            print(f"📊 Mevcut POI sayısı: {existing_count}")
        
        # JSON POI'lerini işle
        total_synced = 0
        total_skipped = 0
        
        for category, pois in test_data.items():
            if not isinstance(pois, list):
                continue
                
            print(f"\n📂 Kategori: {category}")
            
            for poi in pois:
                if not poi.get('isActive', True):
                    continue
                
                # String _id'yi integer ID'ye çevir
                string_id = poi.get('_id', '')
                integer_id = get_integer_id_from_string(string_id)
                
                # POI'nin zaten var olup olmadığını kontrol et
                with db.conn.cursor() as cur:
                    cur.execute("SELECT id FROM pois WHERE id = %s", (integer_id,))
                    existing = cur.fetchone()
                
                if existing:
                    print(f"  ⏭️  {poi.get('name', 'İsimsiz')} (ID: {integer_id}) - Zaten var")
                    total_skipped += 1
                    continue
                
                # POI'yi veritabanına ekle
                try:
                    with db.conn.cursor() as cur:
                        insert_query = """
                            INSERT INTO pois (
                                id, name, category, description, 
                                location, tags, is_active, created_at, updated_at
                            ) VALUES (
                                %s, %s, %s, %s, 
                                ST_SetSRID(ST_MakePoint(%s, %s), 4326), 
                                %s, %s, NOW(), NOW()
                            )
                        """
                        
                        cur.execute(insert_query, (
                            integer_id,
                            poi.get('name', ''),
                            poi.get('category', category),
                            poi.get('description', ''),
                            poi.get('longitude', 0),
                            poi.get('latitude', 0),
                            poi.get('tags', []),
                            True
                        ))
                    
                    db.conn.commit()
                    print(f"  ✅ {poi.get('name', 'İsimsiz')} (ID: {integer_id}) - Eklendi")
                    total_synced += 1
                    
                except Exception as e:
                    print(f"  ❌ {poi.get('name', 'İsimsiz')} - Hata: {e}")
                    db.conn.rollback()
        
        print(f"\n📊 Senkronizasyon tamamlandı:")
        print(f"  ✅ Eklenen: {total_synced}")
        print(f"  ⏭️  Atlanan: {total_skipped}")
        
        # Final count
        with db.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM pois")
            final_count = cur.fetchone()[0]
            print(f"  📊 Toplam POI sayısı: {final_count}")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Senkronizasyon hatası: {e}")
        db.disconnect()
        return False

if __name__ == "__main__":
    print("🔄 JSON POI'leri veritabanına senkronize ediliyor...")
    success = sync_json_pois_to_database()
    
    if success:
        print("\n✅ Senkronizasyon başarılı!")
        print("💡 Artık JSON_FALLBACK = False yaparak veritabanını kullanabilirsiniz.")
    else:
        print("\n❌ Senkronizasyon başarısız!")
        sys.exit(1)