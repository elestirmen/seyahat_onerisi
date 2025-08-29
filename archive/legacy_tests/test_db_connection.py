#!/usr/bin/env python3
"""
Veritabanı bağlantısını test etme script'i
"""

import os
import sys
from poi_database_adapter import POIDatabaseFactory

def test_database_connection():
    """Veritabanı bağlantısını test et"""
    
    print("🔍 Veritabanı bağlantısı test ediliyor...")
    
    try:
        # Çevre değişkenlerini kontrol et
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        
        print(f"📊 DB Type: {db_type}")
        print(f"📊 Connection: {connection_string}")
        print(f"📊 Database: {database_name}")
        
        # Veritabanına bağlan
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        
        db.connect()
        print("✅ Veritabanına başarıyla bağlanıldı!")
        
        # POI sayısını kontrol et
        with db.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM pois WHERE is_active = true")
            poi_count = cur.fetchone()[0]
            print(f"📊 Aktif POI sayısı: {poi_count}")
            
            # Kategorileri kontrol et
            cur.execute("SELECT DISTINCT category FROM pois WHERE is_active = true ORDER BY category")
            categories = [row[0] for row in cur.fetchall()]
            print(f"📊 Kategoriler: {', '.join(categories)}")
            
            # Route-POI ilişkilerini kontrol et
            cur.execute("SELECT COUNT(*) FROM route_pois")
            route_poi_count = cur.fetchone()[0]
            print(f"📊 Route-POI ilişki sayısı: {route_poi_count}")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Veritabanı bağlantı hatası: {e}")
        print("\n💡 Çözüm önerileri:")
        print("1. PostgreSQL'in çalıştığından emin olun")
        print("2. Veritabanı kullanıcısı ve şifresini kontrol edin")
        print("3. Veritabanının oluşturulduğundan emin olun")
        print("4. setup_poi_database.py script'ini çalıştırın")
        return False

if __name__ == "__main__":
    success = test_database_connection()
    
    if not success:
        print("\n🔧 Veritabanını kurmak için:")
        print("python setup_poi_database.py 'postgresql://poi_user:poi_password@localhost/poi_db'")
        sys.exit(1)
    else:
        print("\n✅ Veritabanı hazır! POI'ler veritabanından çekilecek.")